var toposort = require('toposort')
var EventEmitter = require('eventemitter3')

var Factory = require('./factory').Factory
var createUnit = require('./factory').createUnit
var finalize = require('./util').finalize

function Singular(options) {
  EventEmitter.call(this)

  this._isRunning = 0
  this._isStarting = 0
  this._isStopping = 0
  this._resolveOnStop = []

  options = options || {}
  this.config = {}
  this.units = {}
  this.scope = {}

  var config = Object.assign({}, options.config)
  var units = Object.assign({}, options.units)
  var scope = Object.assign({}, options.scope)

  this.refCount = {}
  this.thread = {}
  this.threadId === 0
  this.totalCount = 0

  if (this.units.hasOwnProperty('singular')) {
    throw new Error('Unit factory name "singular" is reserved')
  }

  Object.getOwnPropertyNames(scope)
  .forEach(function(name) {
    var value = scope[name]
    var unit = createUnit(value)

    this._registerUnit(name, unit, config[name])
  }, this)

  Object.getOwnPropertyNames(units)
  .forEach(function(name) {
    this._registerUnit(name, units[name], config[name])
  }, this)

  this.order = getInitializationOrder(this.units)
}

Object.setPrototypeOf(Singular.prototype, EventEmitter.prototype)

Object.defineProperty(Singular.prototype, 'isRunning', {
  get: function() {
    return this._isRunning > 0
  },
})
Object.defineProperty(Singular.prototype, 'isStarting', {
  get: function() {
    return this._isStarting > 0
  },
})
Object.defineProperty(Singular.prototype, 'isStopping', {
  get: function() {
    return this._isStopping > 0
  },
})

Singular.prototype.registerUnit = function(name, unit, config) {
  if (this.hasUnit(name)) {
    throw new Error('Unit "' + name + '" already registered')
  }

  this._registerUnit(name, unit)
  this.order = getInitializationOrder(this.units, config)
}

Singular.prototype._registerUnit = function(name, unit, config) {
  this.units[name] = unit
  this.scope[name] = {}
  this.config[name] = Object.assign({}, unit.defaults, config)
  this.refCount[name] = 0
}

Singular.prototype.unregisterUnit = function(name) {
  if (! this.hasUnit(name)) {
    return
  }
  else if (this.isUnitRunning(name)) {
    throw new Error('Unit "' + name + '" is running')
  }

  this._unregisterUnit(name)
  this.order = getInitializationOrder(this.units)
}

Singular.prototype._unregisterUnit = function(name) {
  delete this.units[name]
  delete this.scope[name]
  delete this.config[name]
  delete this.refCount[name]
}

Singular.prototype.hasUnit = function(name) {
  return this.units.hasOwnProperty(name)
}

Singular.prototype.isUnitRunning = function(name) {
  return this.refCount[name] > 0
}

Singular.prototype.setConfig = function() {
  var args = Array.prototype.slice.call(arguments)
  var update

  if (args.length > 1) {
    update = {}
    update[args[0]] = args[1]
  }
  else {
    update = args[0]
  }

  this.config = Object.assign({}, this.config, update)
  return this
}

Singular.prototype.get = function(name) {
  return this.scope[name]
}

Singular.prototype.start = function(threadId, deps) {
  var self = this

  if (! deps) {
    deps = Object.getOwnPropertyNames(this.units)
  }
  else if (! Array.isArray(deps)) {
    throw new TypeError('Dependencies are not an Array')
  }
  else if (deps.length === 0) {
    throw new TypeError('Dependencies are empty')
  }
  if (threadId in this.thread) {
    throw new Error('Already started "' + threadId + '"')
  }

  this.thread[threadId] = new Thread(this, threadId, deps)

  var thread = this.thread[threadId]

  return new Promise(function(resolve, reject) {
    var units
    if (deps) {
      deps.forEach(function (ref) {
        if (! self.hasUnit(ref)) {
          throw new Error('Required unit "' + ref + '" is not defined')
        }
      })
      units = getRequiredUnits(self.units, deps.slice())
    }
    else {
      units = self.units
    }

    var order = getInitializationOrder(units)
    thread.order = order.slice()

    self.isStarting += 1

    finalize(
      Promise.resolve(self._start(order, thread)),
      function() {
        self.isStarting -= 1
      }
    )
    .catch(function(error) {
      return Promise.resolve(self._stop(thread.ready.slice().reverse()))
      .then(function() {
        throw error
      }, function (stopError) {
        throw stopError
      })
    })
    .then(function () {
      self.emit('started', thread)

      return thread
    })
    .then(resolve, reject)
  })
}

Singular.prototype._start = function(order, thread) {
  if (! order.length) {
    return
  }

  var self = this
  var name = order[0]

  var config = this.config

  if (this.refCount[name] > 0) {
    thread.ready.push(name)
    this.refCount[name] += 1
    return this._start(order.slice(1), thread)
  }

  var unit = this.units[name]

  var exports = this.scope[name]
  var localScope = this.createLocalScope(name)

  return Promise.resolve(unit.startUnit(
    Object.assign({}, unit.defaults, config[name]), localScope, exports
  ))
  .then(function (result) {
    if (result === void 0) {
      result = exports
    }

    thread.scope[name] = result
    thread.ready.push(name)

    self.scope[name] = result
    self.refCount[name] += 1

    self.emit('unit:started', name, result)
    return self._start(order.slice(1), thread)
  })
}

Singular.prototype.stop = function(threadId) {
  var self = this
  if (threadId in this.thread === false) {
    throw new Error('Thread "' + threadId + '" not found')
  }

  var thread = this.thread[threadId]
  var order = thread.order.slice().reverse()

  return new Promise(function(resolve, reject) {

    self._isStopping += 1

    finalize(
      Promise.resolve(self._stop(order)),
      function() {
        self._isStopping -= 1

        delete self.thread[threadId]
        self.emit('thread:stopped', thread)
      }
    )
    .then(resolve, reject)
  })
}

Singular.prototype._stop = function(order) {
  if (order.length < 1) {
    return
  }

  var self = this
  var name = order[0]

  if (this.refCount[name] > 1) {
    this.refCount[name] -= 1
    return this._stop(order.slice(1))
  }

  return Promise.resolve(
    this.units[name].stopUnit(
      this.config[name], this.createLocalScope(name), this.scope[name]
    )
  )
  .then(function() {
    self.refCount[name] -= 1
    delete self.scope[name]
    self.emit('unit:stopped', name)
    return self._stop(order.slice(1))
  })
}

Singular.prototype.run = function(deps, fn) {
  var self = this
  self._isRunning += 1
  var id = ++this.threadId
  return finalize(finalize(
    this.start(id, deps)
    .then(function (thread) {
      return fn(thread.scope)
    }),
    function() {
      return self.stop(id)
    }
  ), function() {
    self._isRunning -= 1
  })
}

Singular.prototype.createLocalScope = function creteLocalScope(name) {
  var localScope = Object.create(null)

  Object.defineProperty(localScope, 'singular', {
    configurable: false,
    value: this,
  })

  Object.defineProperty(localScope, 'unitId', {
    configurable: false,
    value: name,
  })

  var unit = this.units[name]
  var deps = unit.deps
  var layout = unit.layout

  Object.getOwnPropertyNames(deps)
  .forEach(function(depName) {
    var localName = layout[depName]

    if (deps[depName] === false) {
      return
    }

    if (! this.hasUnit(localName)) {
      throw new Error('Unit "' + depName + '" not found')
    }

    localScope[depName] = this.scope[localName]
  }, this)

  return localScope
}

function getUnitDeps(unit) {
  return Object.keys(unit.deps)
  .filter(function(dep) {
    return unit.deps[dep] === true
  })
}

function getDeps(units, list) {
  var resolved = []
  var index = {}

  while (list.length) {
    var item = list.shift()
    var unit = units[item]

    getUnitDeps(unit)
    .map(function(dep) {
      return unit.layout[dep]
    })
    .forEach(function (dep) {
      if (dep in index) {
        return
      }
      list.push(dep)
    })

    index[item] = true
    resolved.push(item)
  }
  return resolved
}

function getRequiredUnits(units, list) {
  var deps = getDeps(units, list.slice())
  return deps.reduce(function(result, name) {
    result[name] = units[name]
    return result
  }, {})
}

function getDepsOrder(units) {
  return toposort(getNodesFromUnits(units))
  .slice(1)
}

function getInitializationOrder(units) {
  return getDepsOrder(units)
  .reverse()
}

function getNodesFromUnits(units) {
  var nodes = []

  Object.getOwnPropertyNames(units)
  .forEach(function(name) {
    var unit = units[name]
    nodes.push(['', name])

    Object.getOwnPropertyNames(unit.deps)
    .forEach(function(dep) {
      var scopeName = unit.layout[dep]
      if (! units.hasOwnProperty(scopeName)) {
        throw new Error(
          'Unknown dependency "'+ scopeName + '" in unit "' + name + '"'
        )
      }

      if (unit.deps[dep]) {
        nodes.push([name, scopeName])
      }
    })
  })

  return nodes
}

function Thread(singular, id, deps) {
  this.singular = singular
  this.id = id
  this.deps = deps
  Object.defineProperty(this, 'deps', {
    value: deps,
    configurable: false,
  })
  Object.freeze(deps)
  this.ready = []
  this.order = []
  this.scope = {}
}

module.exports = Singular

Singular.Factory = Factory

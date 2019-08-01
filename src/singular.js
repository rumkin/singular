var toposort = require('toposort')
var EventEmitter = require('eventemitter3')

var Factory = require('./factory').Factory

function Singular(options) {
  EventEmitter.call(this)

  this._isRunning = 0
  this._isStarting = 0
  this._isStopping = 0
  this._resolveOnStop = []

  options = options || {}
  var config = options.config || {}
  var modules = options.modules || {}

  this.scope = {}
  this.refCount = {}
  this.proc = {}
  this.procId === 0
  this.totalCount = 0
  this.config = Object.assign({}, config)
  this.modules = Object.assign({}, modules)

  if (this.modules.hasOwnProperty('singular')) {
    throw new Error('Module factory name "singular" is reserved')
  }

  Object.getOwnPropertyNames(this.modules)
  .forEach(function(name) {
    this._registerModule(name, modules[name])
  }, this)

  this.order = getInitializationOrder(this.modules)
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

Singular.prototype.registerModule = function(name, module) {
  if (this.hasModule(name)) {
    throw new Error('Module "' + name + '" already registered')
  }

  this._registerModule(name, module)
  this.order = getInitializationOrder(this.modules)
}

Singular.prototype._registerModule = function(name, module) {
  this.modules[name] = module
  this.scope[name] = {}
  this.refCount[name] = 0
}

Singular.prototype.unregisterModule = function(name) {
  if (! this.hasModule(name)) {
    return
  }
  else if (this.isModuleRunning(name)) {
    throw new Error('Module "' + name + '" is running')
  }

  this._unregisterModule(name)
  this.order = getInitializationOrder(this.modules)
}

Singular.prototype._unregisterModule = function(name) {
  delete this.modules[name]
  delete this.scope[name]
  delete this.refCount[name]
}

Singular.prototype.hasModule = function(name) {
  return this.modules.hasOwnProperty(name)
}

Singular.prototype.isModuleRunning = function(name) {
  return this.refsCount[name] > 0
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

Singular.prototype.start = function(procId, refs) {
  var self = this
  if (procId in this.proc) {
    throw new Error('Already started "' + procId + '"')
  }

  this.proc[procId] = {
    id: procId,
    deps: refs,
    ready: [],
    awaits: [],
  }

  var proc = this.proc[procId]

  return new Promise(function(resolve, reject) {
    var modules
    if (refs) {
      refs.forEach(function (ref) {
        if (! self.hasModule(ref)) {
          throw new Error('Required module "' + ref + '" is not defined')
        }
      })
      modules = getRequiredModules(self.modules, refs.slice())
    }
    else {
      modules = self.modules
    }

    var order = getInitializationOrder(modules)

    self.isStarting += 1

    Promise.resolve(self._start(order, proc.ready))
    .finally(function() {
      self.isStarting -= 1
    })
    .then(function() {
      return Object.assign({}, self.scope)
    }, function(error) {
      return Promise.resolve(self._stop(proc.ready.slice().reverse()))
      .then(function() {
        throw error
      }, function (stopError) {
        throw stopError
      })
    })
    .then(function () {
      var scope
      if (refs) {
        scope = refs.reduce(function(items, name) {
          items[name] = self.scope[name]
          return items
        }, {})
      }
      else {
        scope = self.scope
      }
      proc.scope = scope

      self.emit('started', proc)

      return proc
    })
    .then(resolve, reject)
  })
}

Singular.prototype._start = function(order, ready) {
  if (! order.length) {
    return
  }

  var self = this
  var name = order[0]

  var scope = this.scope
  var config = this.config

  if (this.refCount[name] > 0) {
    ready.push(name)
    this.refCount[name] += 1
    return this._start(order.slice(1), ready)
  }

  var module = this.modules[name]

  var exports = this.scope[name]
  var localScope = this.createLocalScope(name, module.layout)

  return Promise.resolve(module.start(
    Object.assign({}, module.defaults, config[name]), localScope, exports
  ))
  .then(function (result) {
    if (result !== void 0) {
      scope[name] = result
    }
    else {
      scope[name] = exports
    }

    ready.push(name)
    self.refCount[name] += 1
    return self._start(order.slice(1), ready)
  })
}

Singular.prototype.createLocalScope = function creteLocalScope(name, layout) {
  var localScope = Object.create(null)

  Object.defineProperty(localScope, 'singular', {
    configurable: false,
    value: this,
  })

  Object.defineProperty(localScope, 'moduleId', {
    configurable: false,
    value: name,
  })

  Object.getOwnPropertyNames(layout)
  .forEach(function(localName) {
    localScope[localName] = this.scope[layout[localName]]
  }, this)

  return localScope
}

Singular.prototype.stop = function(procId) {
  var self = this
  if (procId in this.proc === false) {
    throw new Error('Procedure "' + procId + '" not found')
  }

  var refs = this.proc[procId].refs
  return new Promise(function(resolve, reject) {
    var modules
    if (refs) {
      modules = getRequiredModules(self.modules, refs.filter(
        function (name) {
          return self.refCount[name] > 0
        }
      ))
    }
    else {
      modules = self.modules
    }

    var order = getDepsOrder(modules)

    self._isStopping += 1

    Promise.resolve(self._stop(order))
    .finally(function() {
      self._isStopping -= 1
      var proc = self.proc[procId]
      delete self.proc[procId]
      self.emit('stopped', proc)
    })
    .then(resolve, reject)
  })
}

Singular.prototype._stop = function(order) {
  if (order.length < 1) {
    return
  }

  var self = this
  var name = order[0]
  var layout = this.modules[name].layout

  if (this.refCount[name] > 1) {
    this.refCount[name] -= 1
    return Promise.resolve()
  }

  return Promise.resolve(
    this.modules[name].stop(
      this.config[name], this.createLocalScope(name, layout), this.scope[name]
    )
  )
  .then(function() {
    self.refCount[name] -= 1
    delete self.scope[name]
    return self._stop(order.slice(1))
  })
}

Singular.prototype.run = function(refs, fn) {
  var self = this
  self._isRunning += 1
  var id = ++this.procId
  return this.start(id, refs)
  .then(function (proc) {
    return fn(proc.scope)
  })
  .finally(function() {
    return self.stop(id)
  })
  .finally(function() {
    self._isRunning -= 1
  })
}

function getDeps(modules, list) {
  var resolved = []
  var index = {}

  while (list.length) {
    var item = list.shift()
    var deps = Object.values(modules[item].layout)
    deps.forEach(function (dep) {
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

function getRequiredModules(modules, list) {
  var deps = getDeps(modules, list)
  return deps.reduce(function(result, name) {
    result[name] = modules[name]
    return result
  }, {})
}

function getDepsOrder(modules) {
  return toposort(getNodesFromModules(modules))
  .slice(1)
}

function getInitializationOrder(modules) {
  return getDepsOrder(modules)
  .reverse()
}

function getNodesFromModules(modules) {
  var nodes = []

  Object.getOwnPropertyNames(modules)
  .forEach(function(name) {
    var module = modules[name]
    nodes.push(['', name])

    Object.getOwnPropertyNames(module.layout)
    .forEach(function(localName) {
      var dependency = module.layout[localName]
      if (! modules.hasOwnProperty(dependency)) {
        throw new Error(
          'Unknown dependency "'+ dependency + '" in module "' + name + '"'
        )
      }

      if (module.deps[localName]) {
        nodes.push([name, dependency])
      }
    })
  })

  return nodes
}

module.exports = Singular

Singular.Factory = Factory

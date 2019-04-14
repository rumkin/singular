var toposort = require('toposort')

var Module = require('./module')

function Singular(options) {
  this._isRunning = false
  this._isStarting = false
  this._isStopping = false
  this._resolveOnStop = []

  options = options || {}
  var scope = options.scope || {}
  var config = options.config || {}
  var modules = options.modules || {}

  this.scope = Object.assign({}, scope)
  this.config = Object.assign({}, config)
  this.modules = Object.assign({}, modules)

  Object.assign(this.modules, modulesFromScope(scope))

  if (this.modules.hasOwnProperty('singular')) {
    throw new Error('Module name "singular" is reserved')
  }

  Object.getOwnPropertyNames(this.modules)
  .forEach(function(name) {
    if (name in this.scope === false) {
      this.scope[name] = {}
    }
  }, this)

  this.order = toposort(getNodesFromModules(this.modules))
  .slice(1)
  .reverse()
}

Object.defineProperty(Singular.prototype, 'isRunning', {
  get: function() {
    return this._isRunning
  },
})
Object.defineProperty(Singular.prototype, 'isStarting', {
  get: function() {
    return this._isStarting
  },
})
Object.defineProperty(Singular.prototype, 'isStopping', {
  get: function() {
    return this._isStopping
  },
})

Singular.prototype.setConfig = function(config) {
  this.config = Object.assign({}, this.config, config)
  return this
}

Singular.prototype.start = function() {
  if (this.isRunning || this.isStarting) {
    throw new Error('Already started')
  }

  var self = this
  var ready = []

  return wrapInPromise(this._start(this.order.slice(), ready))
  .then(function() {
    self._isRunning = true
    return Object.assign({}, self.scope)
  }, function(error) {
    self._isStarting = false

    function onStop() {
      self._isRunning = false
      self._isStopping = false
      self._releaseAwaits()
    }

    return wrapInPromise(self._stop(ready.reverse()))
    .then(function() {
      onStop()
      throw error
    }, function (stopError) {
      onStop()
      throw stopError
    })
  })
}

Singular.prototype._start = function(order, ready) {
  if (! order.length) {
    this._isStarting = false

    return
  }

  this._isStarting = true

  var self = this
  var name = order[0]

  var scope = this.scope
  var config = this.config

  var module = this.modules[name]

  var exports = this.scope[name]
  var localScope = Object.create({
    singular: this,
  })

  Object.getOwnPropertyNames(module.layout)
  .forEach(function(localName) {
    localScope[localName] = scope[module.layout[localName]]
  })

  return wrapInPromise(module.start(
    Object.assign({}, config[name], module.defaults), localScope, exports
  ))
  .then(function (result) {
    if (result !== void 0) {
      scope[name] = result
    }
    else {
      scope[name] = exports
    }

    ready.push(name)
    // console.log({name, order, ready})
    return self._start(order.slice(1), ready)
  })
}

Singular.prototype.stop = function() {
  if (! this.isRunning || this.isStopping) {
    return
  }

  var self = this

  function onStop() {
    self._isRunning = false
    self._isStopping = false
    self._releaseAwaits()
  }

  this._isStopping = true

  return wrapInPromise(this._stop(this.order.slice().reverse()))
  .then(onStop, function (error) {
    onStop()
    throw error
  })
}

Singular.prototype._stop = function(order) {
  if (order.length < 1) {
    return
  }

  var self = this
  var name = order[0]

  return wrapInPromise(this.modules[name].stop(this.scope[name]))
  .then(function() {
    delete self.scope[name]
    return self._stop(order.slice(1))
  })
}

Singular.prototype._releaseAwaits = function() {
  var resolveOnStop = this._resolveOnStop
  this._resolveOnStop = []

  resolveOnStop.forEach(function(resolve) {
    resolve()
  })
}

Singular.prototype.has = function(name) {
  return this.modules.hasOwnProperty(name)
}

Singular.prototype.get = function(name) {
  if (! this.has(name)) {
    throw new Error('Service "' + name + '" not found')
  }

  return this.scope[name]
}

Singular.prototype.wait = function() {
  return new Promise((resolve) => {
    this._resolveOnStop = [...this._resolveOnStop, resolve]
  })
}

function modulesFromScope(scope) {
  const modules = {}
  Object.getOwnPropertyNames(scope)
  .forEach(function(name) {
    var instance = scope[name]

    modules[name] = {
      defaults: {},
      layout: {},
      start() {
        return instance
      },
      stop() {},
    }
  })

  return modules
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

function wrapInPromise(value) {
  if (value !== void 0 && typeof value.then === 'function') {
    return value
  }
  else {
    return  Promise.resolve(value)
  }
}

module.exports = Singular

Singular.Module = Module

var toposort = require('toposort')

var Factory = require('./factory').Factory

function Singular(options) {
  this._isRunning = false
  this._isStarting = false
  this._isStopping = false
  this._resolveOnStop = []

  options = options || {}
  var config = options.config || {}
  var modules = options.modules || {}

  this.scope = {}
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
}

Singular.prototype.unregisterModule = function(name) {
  if (! this.hasModule(name)) {
    return
  }

  this._unregisterModule(name)
  this.order = getInitializationOrder(this.modules)
}

Singular.prototype._unregisterModule = function(name) {
  delete this.modules[name]
  delete this.scope[name]
}

Singular.prototype.hasModule = function(name) {
  return this.modules.hasOwnProperty(name)
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

Singular.prototype.start = function() {
  var self = this
  return new Promise(function(resolve, reject) {
    if (self.isRunning || self.isStarting) {
      reject(new Error('Already started'))
      return
    }

    self.ready = []

    Promise.resolve(self._start(self.order.slice()))
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

      return Promise.resolve(self._stop(self.ready.reverse()))
      .then(function() {
        onStop()
        throw error
      }, function (stopError) {
        onStop()
        throw stopError
      })
    })
    .then(resolve, reject)
  })
}

Singular.prototype._start = function(order) {
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

    self.ready.push(name)
    return self._start(order.slice(1))
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

Singular.prototype.stop = function() {
  var self = this

  return new Promise(function(resolve, reject) {
    if (! self.isRunning || self.isStopping) {
      resolve()
      return
    }

    function onStop() {
      self._isRunning = false
      self._isStopping = false
      self._releaseAwaits()
    }

    self._isStopping = true

    Promise.resolve(self._stop(self.ready.slice().reverse()))
    .then(onStop, function (error) {
      onStop()
      throw error
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
  var module = this.modules[name]
  var config = Object.assign({}, module.defaults, this.config[name])

  return Promise.resolve(
    module.stop(
      config, this.createLocalScope(name, layout), this.scope[name]
    )
  )
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

Singular.prototype.wait = function() {
  var self = this
  return new Promise(function (resolve) {
    this._resolveOnStop = self._resolveOnStop.concat(resolve)
  })
}

function getInitializationOrder(modules) {
  return toposort(getNodesFromModules(modules))
  .slice(1)
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

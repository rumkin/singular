function Factory (layout) {
  this.deps = Object.assign({}, this.constructor.deps)
  if (! layout) {
    layout = layoutFromDeps(this.deps)
  }
  else {
    var deps = this.deps
    Object.getOwnPropertyNames(layout)
    .forEach(function(name) {
      if (! deps.hasOwnProperty(name)) {
        throw new Error('Unknown dependency in layout "' + name + '"')
      }
    })
  }

  this.layout = layout
  this.defaults = this.constructor.defaults
}

function layoutFromDeps(deps) {
  var layout = {}
  Object.getOwnPropertyNames(deps)
  .forEach(function(name) {
    layout[name] = name
  })
  return layout
}

Factory.deps = {}
Factory.defaults = {}
Factory.prototype.start = function() {}
Factory.prototype.stop = function() {}

function assembleFactory(start, stop) {
  if (typeof start !== 'function') {
    throw new Error('Arugment `start` should be a function')
  }

  if (stop && typeof stop !== 'function') {
    throw new Error('Arugment `stop` should be undefined or a function')
  }

  function SimpleFactory() {
    Factory.apply(this, arguments)
  }

  Object.setPrototypeOf(SimpleFactory.prototype, Factory.prototype)

  SimpleFactory.defaults = {}
  SimpleFactory.prototype.start = start
  if (stop) {
    SimpleFactory.prototype.stop = stop
  }
  return SimpleFactory
}

Factory.from = function from(source) {
  return Object.assign(
    assembleFactory(source.start, source.stop),
    {
      defaults: source.defaults || {},
      deps: source.deps || {},
    }
  )
}

exports.Factory = Factory
exports.assembleFactory = assembleFactory

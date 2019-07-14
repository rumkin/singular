function ModuleFactory (layout) {
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

ModuleFactory.deps = {}
ModuleFactory.defaults = {}
ModuleFactory.prototype.start = function() {}
ModuleFactory.prototype.stop = function() {}

module.exports = ModuleFactory

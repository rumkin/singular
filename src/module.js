function Module(layout) {
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
}

function layoutFromDeps(deps) {
  var layout = {}
  Object.getOwnPropertyNames(deps)
  .forEach(function(name) {
    layout[name] = name
  })
  return layout
}

Module.deps = {}
Module.defaults = {}
Module.prototype.start = function() {}
Module.prototype.stop = function() {}

module.exports = Module

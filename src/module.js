function Module(layout) {
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

Module.prototype.deps = []
Module.prototype.defaults = {}
Module.prototype.start = function() {}
Module.prototype.stop = function() {}

module.exports = Module

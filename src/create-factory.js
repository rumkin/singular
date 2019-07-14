const ModuleFactory = require('./module-factory.js')

function createFactory(layout, start) {
  if (typeof start !== 'function') {
    throw new Error('Arugment #1 should be a function')
  }

  function SimpleFactory() {
    ModuleFactory.apply(this, arguments)
  }

  Object.setPrototypeOf(SimpleFactory.prototype, ModuleFactory.prototype)

  SimpleFactory.layout = layout
  SimpleFactory.prototype.start = start

  return SimpleFactory
}

module.exports = createFactory

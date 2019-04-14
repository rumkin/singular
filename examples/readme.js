import Singular from 'singular'

const singular = new Singular({
  config: {

  },
  modules: {

  },
})

// Inject value and factory
singular.start(({value, factory}) => {
  console.log('Value is %s', value) // -> Value is 1
  console.log('Factory is %s', factory) // -> Factory is 1
})

const assert = require('assert')
const Singular = require('../')

function createUnit({layout = {}, deps, defaults = {}, start, stop = () => {}, value} = {}) {
  if (! start) {
    start = () => value
  }

  const Class = class TestFactory extends Singular.Factory {
    static get defaults() {
      return defaults
    }

    static get deps() {
      return deps || Object.getOwnPropertyNames(layout)
      .reduce(function (result, name) {
        result[name] = true
        return result
      }, {})
    }

    start(...args) {
      return start(...args)
    }

    stop(...args) {
      return stop(...args)
    }
  }

  return new Class(layout)
}

module.exports = ({describe, it}) => describe('Singular', () => {
  describe('#start()', () => {
    // This test checks initialization order, layouts, and configuration
    // resolution
    it('Should resolve dependencies', () => {
      const singular = new Singular({
        config: {
          b: {
            value: 2,
          },
          c: {
            value: 3,
          },
        },
        units: {
          a: createUnit({value: 1}),
          b: createUnit({
            layout: {
              x: 'a',
            },
            start({value}, {x}) {
              return x + value
            },
          }),
          c: createUnit({
            layout: {
              x: 'b',
            },
            start({value}, {x}) {
              return x * value
            },
          }),
        },
      })

      return singular.start(1)
      .then(({scope}) => {
        const {a, b, c} = scope

        assert.equal(a, 1, 'a is 1')
        assert.equal(b, 3, 'b is 3')
        assert.equal(c, 9, 'c is 9')
      })
    })

    it('Should use defaults', () => {
      const service = createUnit({
        defaults: {
          a: 1,
        },
        start(config, scope, exports) {
          exports.value = config.a
        },
      })

      const singular = new Singular({
        units: {
          service,
        },
      })

      return singular.start(1)
      .then(({scope: {service: {value}}}) => value)
      .then((result) => {
        assert.equal(result, 1, 'Value passed to config')
      })
    })

    it('Should overwrite defaults', () => {
      const service = createUnit({
        defaults: {
          a: 0,
        },
        start(config, scope, exports) {
          exports.value = config.a
        },
      })

      const singular = new Singular({
        config: {
          service: {
            a: 1,
          },
        },
        units: {
          service,
        },
      })

      return singular.start(1)
      .then(({scope: {service: {value}}}) => value)
      .then((result) => {
        assert.equal(result, 1, 'Value passed to config')
      })
    })

    it('Should resolve cycle dependencies when weak flags set', () => {
      const serviceA = createUnit({
        layout: {
          dep: 'b',
        },
        deps: {
          dep: false,
        },
        start(config, {dep}, exports) {
          exports.value = 1
          exports.sum = function () {
            return this.value + dep.value
          }
        },
      })

      const serviceB = createUnit({
        layout: {
          dep: 'a',
        },
        deps: {
          dep: false,
        },
        start(config, {dep}, exports) {
          exports.value = 1
          exports.sum = function () {
            return this.value + dep.value
          }
        },
      })

      const singular = new Singular({
        units: {
          a: serviceA,
          b: serviceB,
        },
      })

      return singular.start(1)
      .then(({scope}) => {
        const {a, b} = scope
        assert.equal(a.sum(), 2, 'a.sum() is 2')
        assert.equal(b.sum(), 2, 'b.sum() is 2')
      })
    })

    it('Should fail on cycle dependencies', () => {
      let caught

      const serviceA = createUnit({
        layout: {
          dep: 'b',
        },
      })

      const serviceB = createUnit({
        layout: {
          dep: 'a',
        },
      })

      try {
        new Singular({
          units: {
            a: serviceA,
            b: serviceB,
          },
        })
      }
      catch (error) {
        caught = error
      }

      assert.ok(caught !== void 0, 'Error caught')
      assert.ok(/Cyclic/.test(caught.message), 'Cyclic dependency error')
    })

    it('Should use predefined units', () => {
      const serviceA = createUnit({
        deps: {
          b: true,
        },
        layout: {
          b: 'b',
        },
        start(cfg, scope) {
          return scope.b + 1
        },
      })

      const singular = new Singular({
        scope: {
          b: 1,
        },
        units: {
          a: serviceA,
        },
      })

      return singular.start(1, ['a'])
      .then((thread) => {
        assert.equal(thread.scope.a, 2, 'a is 2')
      })
    })

    it('Should start only required deps', () => {
      const singular = new Singular({
        units: {
          a: createUnit({
            layout: {b: 'b'},
            deps: {b: true},
            start: (cfg, {b}) => 'a' + b,
          }),
          b: createUnit({value: 'b'}),
          c: createUnit({value: 'c'}),
        },
      })

      return singular.start(1, ['a'])
      .then(({scope: {a}}) => {
        assert.equal(a, 'ab', 'b has been required')
        assert.equal(singular.refCount.a, 1, 'a ref count is 1')
        assert.equal(singular.refCount.b, 1, 'b ref count is 1')
        assert.equal(singular.refCount.c, 0, 'c ref count is 0')
      })
    })

    it('Should emit started event', () => {
      const singular = new Singular({
        units: {a: createUnit()},
      })
      let beenStarted = false

      singular.on('started', () => {
        beenStarted = true
      })

      return singular.start(1)
      .then(() => {
        assert.ok(beenStarted, 'Started is true')
      })
    })

    it('Should call Service#stop() on failure', () => {
      let stopCalled = false
      let thrown = false

      const singular = new Singular({
        config: {
          b: {
            value: 2,
          },
        },
        units: {
          a: createUnit({
            stop() {
              stopCalled = true
            },
          }),
          b: createUnit({
            layout: {
              x: 'a',
            },
            start() {
              throw new Error('TEST_ERROR')
            },
          }),
        },
      })

      return singular.start()
      .catch((error) => {
        thrown = true
        assert.equal(error.message, 'TEST_ERROR')
      })
      .then(() => {
        assert.ok(stopCalled, 'stop called')
        assert.ok(thrown, 'thrown')
      })
    })
  })

  describe('#stop()', () => {
    it('Should call Service#stop() in proper order', () => {
      let count = 0
      let aStopCalled = 0
      let bStopCalled = 0

      const singular = new Singular({
        units: {
          a: createUnit({
            stop() {
              console.log('A stopped')
              aStopCalled = ++count
            },
          }),
          b: createUnit({
            layout: {
              x: 'a',
            },
            stop() {
              console.log('B stopped')
              bStopCalled = ++count
            },
          }),
        },
      })

      return singular.start(1)
      .then(() => singular.stop(1))
      .then(() => {
        assert.ok(count > 0, 'Stop called')
        assert.equal(aStopCalled, 2, 'A stopped last')
        assert.equal(bStopCalled, 1, 'B stopped first')
      })
    })

    it('Should emit stopped event', () => {
      const singular = new Singular({
        units: {a: createUnit()},
      })
      let beenStopped = false

      singular.on('thread:stopped', () => {
        beenStopped = true
      })

      return singular.start(1)
      .then(() => singular.stop(1))
      .then(() => {
        assert.ok(beenStopped, 'Stopped is true')
      })
    })
  })

  describe('#run()', () => {
    it('should start units', () => {
      let beenStarted = false
      const singular = new Singular({
        units: {
          a: createUnit({
            start() {
              beenStarted = true
            },
          }),
        },
      })

      return singular.run(['a'], () => {})
      .then(() => {
        assert.ok(beenStarted, 'a been started')
      })
    })

    it('should stop units', () => {
      let beenStopped = false
      const singular = new Singular({
        units: {
          a: createUnit({
            stop() {
              beenStopped = true
            },
          }),
        },
      })

      return singular.run(['a'], () => {})
      .then(() => {
        assert.ok(beenStopped, 'a been started')
      })
    })
  })

  describe('Singular.Factory.from()', () => {
    it('should create functional unit factory', () => {
      const factory = Singular.Factory.from({
        start: () => 'factory works',
      })

      const singular = new Singular({
        units: {
          test: new factory(),
        },
      })

      return singular.start(1)
      .then(({scope}) => {
        assert.equal(scope.test, 'factory works', 'unit is initialized')
      })
    })
  })
})

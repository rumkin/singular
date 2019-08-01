Singular is dependency manager for modular applications. Its' modules are
CommonJS-alike classes.

Singular can load modules in runtime for example WASM modules or mock any module
in test environment.

## Installation

* Install from NPM:

  ```shell
  npm i singular
  ```
* Inject using unpkg.com:

  ```html
  <script src="https://unpkg.com/singular@3/dist/singular.js"></script>
  <script src="https://unpkg.com/singular@3/dist/singular.min.js"></script>
  ```
  > ⚠️ Remember about security! Add [subresource integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) (SRI) checksum
  > from [checksum.txt](https://unpkg.com/singular@3/dist/checksum.txt).

## Example

Singular is made for simple configuration and initialization:

```javascript
import Singular from 'singular'

const singular = new Singular({
  modules: {
    mongo: new MongoModule(),
    sqlite: new SqliteModule(),
    user: new UserModule({
      // User module layout requires mongo `db` which is `mongo` in current app
      db: 'mongo',
    }),
    transactions: [TransactionsModule, {
      // Transactions module layout requires sqlite `db` which is `sqlite`
      // in current app
      db: 'sqlite',
    }],
  },
})
```

Usage and API
===

Instantiate and configure new singular instance.

```javascript
import Singular from 'singular'

const config = {
  logger: {
    level: 'INFO',
  },
  mongo: {
    connect: 'mongodb://...'
  },
  sql: {
    type: 'sqlite',
    dbPath: './db.sqlite',
  },
}

const singular = new Singular({
  config,
})
```

Inject dependencies with `start` method.

```javascript
// Inject logger and log something
singular.start()
.then(({ mongo, sqlite }) => {

})
```

### Module Example

Define module using ES2019 syntax:

```javascript
class GreetingModule extends Singular.Module {
  static deps = {
    // Logger is required
    logger: true,
  }

  static defaults = {
    name: 'World'
  }

  async start(config, scope, exports) {
    const {logger} = scope

    exports.greet = function(name) {
      logger.log('Hello, %s!', name || config.name)
    }

    // Or

    return {
      greet(name = config.name) {
        logger.log('Hello, %s!', name)
      },
    }
  }

  async stop(config, scope, exports) {
    // ... Do something to shutdown module gracefully ...
    // ℹ️ exports here is an entry created by start() call.
  }
}
```

## License

MIT © [Rumkin](https://rumk.in)

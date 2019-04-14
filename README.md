Singular is application dependency manager. Its' modules are CommonJS-alike
classes. Each module is using custom layout to avoid module names collision.

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
    transactions: new TransactionsModule({
      // Transactions module layout requires sqlite `db` which is `sqlite`
      // in current app
      db: 'sqlite',
    }),
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

const singular = new Singular({config})
```

Inject dependencies with `inject` method. Inject has aliases `configure` and `run`.

```javascript
// Inject logger and log something
singular.start()
.then(({ mongo, sqlite }) => {

})
```

### Module Example

Define module using ES2019 syntax:

```javascript
class UserModule extends Singular.Module {
  deps = {
    // Logger is required
    logger: true,
    // Db is required too
    db: true,
  }

  defaults = {
    collection: 'users'
  }

  start(config), {db, logger}, exports) {
    exports.getById = function(id) {
      return db.getCollection(config.collection)
      .getById(id)
      .then((result) => {
        logger.info('User %s found: %s', id, result !== null)
        return result
      })
    }

    // ... other methods ...
  }
}
```

## License

MIT © [Rumkin](https://rumk.in)

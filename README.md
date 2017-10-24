Singular is modular applications boilerplate. It's using for dependency injection
in angular-like way with dependency resolving and asynchronous lazy initialization.

## Installation

Singular could be installed with NPM:

```shell
npm i singular
```

## Example

Singular is made for simple configuration and initialization:

```javascript
const Singular = require('singular');
const singular = new Singular({
  config: {    
    mongo: {
      host: 'localhost',
      port: 27017,
      base: 'testBase',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    users: {
      minAge: 18,
    },
  },
});

singular.module(require('./mongo.js'));
singular.module(require('./redis.js'));

async function addUser(name, age) {
  // Get config and initialized mongo and redis clients
  const [config, db, redis] = await singular.inject('config', 'mongo', 'redis');

  config.users.minAge; // => 18
  // ...
}

// ...
```

Usage and API
===

Instantiate and configure new singular instance.

```javascript
const Singular = require('singular');

const config = {
  debug: true,
  dir: __dirname,
};

const singular = new Singular({config});
```

Define factories and values using method `module`. You can do it with methods `value` or `factory` too.

```javascript
singular.module({
  // Simple value
  value: 1,
  // Define value factory
  oneFactory() {
    return 1;
  },
  // Define logger options
  loggerOptions(app) {
    return {
      ...app.config.logger,
      verbose: !! app.config.debug
    };
  },
  // Define logger function with loggerOptions
  logger(loggerOptions) {
    return function(message) {
      if (loggerOptions.verbose) console.log(message);
    };
  }
});
```

Inject dependencies with `inject` method. Inject has aliases `configure` and `run`.

```javascript
// Inject logger and log something
singular.inject((logger) => {
    logger('Hello world'); // -> 'Hello world'
});

// Regular promise
singular.inject(['mongo', 'redis'])
.then(([mongo, redis]) => {
  // do something with mongo and redis
});
```

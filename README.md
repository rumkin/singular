Singular is modular applications boilerplate. It used for dependency injection
in angular-like way with dependency resolving. It simplifies asynchronous
initialization and lazy initialization.

```javascript
const Singular = require('singular');
const singular = new Singular({
	config: {
		mongo: {
			host: 'localhost',
			port: 27017,
			base: 'testBase'
		},
		redis: {
			host: 'localhost',
			port: 6379
		},
	}
});

singular.module(require('./mongo.js'));
singular.module(require('./redis.js'));

async function addUser(user) {
	// Get initialized mongo and redis clients
	var [db, redis] = await singular.inject('mongo', 'redis');
	// ...
}

// ...
```

Installation
===

Singular could be installed with NPM:

```shell
npm i singular
```

Usage
===

Instantiate and configure new singular instance.

```javascript
var Singular = require('singular');

var config = {
	debug : true,
	dir : __dirname
};

var singular = new Singular(config);
```

Define factories and values using method `module`. You can do it with methods `value` or `factory` too.

```javascript
singular.module({
	// Simple value
	value : 1,
	// Define value factory
	factory : function() {
		return 1;
	},
	// Define logger options
	loggerOptions : function(app) {
		return {
			verbose : !! app.config.debug
		};
	},
	// Define logger which uses loggerOptions
	logger : function(loggerOptions) {
		return function(message) {
			if (loggerOptions.verbose) console.log(message);
		};
	}
});
```

Inject dependencies with `run` method. Singular has methods `configure` and `inject` which are semantic aliases
to method `run`.

```javascript
// Inject value and factory
singular.run(function(value, factory){
    console.log('Value is %s', value); // -> Value is 1
    console.log('Factory is %s', factory); // -> Factory is 1
});

// Inject singular itself and get config value
singular.configure(function(app){
    console.log(app.config.dir); // -> __dirname
});

// Inject logger and log something
singular.inject(function(logger){
    logger('Hello world'); // -> 'Hello world'
});
```

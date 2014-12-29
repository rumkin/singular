Singular is an entry point for modular applications. It used for dependency injection in angular-like way.

Installation
===

Singular could be installed with NPM:

````bash
npm install singular

````

Usage
===

Instantiate and configure new singular instance

````javascript
var Singular = require('singular');

var config = {
	debug : true,
	dir : __dirname
};

var singular = new Singular(config);
```

Define factories and values using module. You can do it with methods `value` or `factory` too.

```javascript
singular.module({
	// Simple value
	value : 1,
	// Define value factory
	factory : function() {
		return 1;
	},
	// Define logger options
	loggerOptions : function($$) {
		return {
			verbose : !! $$.config.debug
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

```javacript
// Inject value and factory
singular.run(function(value, factory){
    console.log('Value is %s', value); // -> Value is 1
    console.log('Factory is %s', factory); // -> Factory is 1
});

// Inject singular itself and get config value
singular.configure(function($$){
    console.log($$.config.dir); // -> __dirname
});

// Inject logger and log something
singular.inject(function(logger){
    logger('Hello world'); // -> 'Hello world'
});

````
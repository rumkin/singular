var Singular = require('../src/singular');

var config = {
    debug : true,
    dir : __dirname
};

var singular = new Singular(config);

// Define module
singular.module({
    // Simple value
    value : 1,
    // Define value factory
    factory : function() {
        return 1;
    },
    // Define logger options
    loggerOptions : function(self) {
        return {
            verbose : !! self.config.debug
        };
    },
    // Define logger which uses loggerOptions
    logger : function(loggerOptions) {
        return function(message) {
            if (loggerOptions.verbose) console.log(message);
        };
    }
});

// Inject value and factory
singular.run(function(value, factory){
    console.log('Value is %s', value); // -> Value is 1
    console.log('Factory is %s', factory); // -> Factory is 1
});

// Inject singular itself and get config value
singular.configure(function(self){
    console.log(self.config.dir); // -> __dirname value
});

// Inject logger and log something
singular.inject(function(logger){
    logger('Hello world'); // -> 'Hello world'
});

'use strict';

var assert = require('assert');
var Singular = require('../src/singular');


var config = {
    debug: true
};

var singular = Singular.new(config);

singular.module({
    testValue: 1,
    testFactory: function() {
        return 1;
    }
});

singular.inject(function(testValue){
    assert(testValue === 1, 'testValue is 1');
});

singular.inject(function(testFactory){
    assert(testFactory === 1, 'testFactory is 1');
});

singular.inject(['testValue','testFactory'], function(testValue, testFactory){
    assert(testValue === 1, 'testValue is 1');
    assert(testFactory === 1, 'testValue is 1');
});

singular.inject('testValue', 'testFactory', function(testValue, testFactory){
    assert(testValue === 1, 'testValue is 1');
    assert(testFactory === 1, 'testValue is 1');
});

singular.inject(function(self){
    assert(singular === self, '$$ equals to singular instance');
});

singular.configure(function(self){
    assert(self.config.debug === true, '$$.config.debug equals true');
});

console.log('Test OK');

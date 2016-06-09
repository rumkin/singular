'use strict';

const assert = require('assert');
const Singular = require('../');


const config = {
    debug: true
};

const singular = Singular.new(config);

describe('Singular', function(){
    it('It should create injector', function(){
        var injector = Singular.injector();

        assert.equal(typeof injector, 'function', 'Injector is function');
    });

    it('Should throw error on empty module() call', function(){
        assert.throws(
            function(){
                singular.module();
            },
            /be an object/,
            'Throw on non object module'
        );
    });

    describe('Values', function(){
        it('Should add value with module()', function(){
            singular.module({
                testValue: 1
            });

            assert.ok(singular.hasValue('testValue'), 'testValue exists');
            assert.ok(! singular.hasFactory('testValue'), 'testValue is not a factory');
            assert.equal(singular.get('testValue'), 1, 'testValue is 1');
        });

        it('Should add value with value()', function(){
            singular.value('testValue2', 2);

            assert.ok(singular.hasValue('testValue2'), 'testValue2 exists');
            assert.equal(singular.get('testValue2'), 2, 'testValue2 is 2');
        });

        it('Should throw when value not exists', function(){
            assert.throws(
                function(){
                    singular.get('unexistedValue');
                },
                /unexistedValue/,
                'Throw on non existing value'
            );
        });

        it('Should throw when value already exists', function(){
            assert.throws(
                function(){
                    singular.value('testValue');
                },
                /in use/,
                'Throw on duplicated value'
            );
        });
    });

    describe('Factories', function(){
        it('Should add factory', function(){
            singular.module({
                testFactory: function() {
                    return 1;
                }
            });

            assert.ok(singular.hasFactory('testFactory'), 'has testFactory');
            assert.ok(! singular.hasValue('testFactory'), 'testFactory is not a value');
        });

        it('Should throw when factory exists', function(){
            assert.throws(
                function(){
                    singular.factory('testValue', function(){});
                },
                /overwriting/i,
                'Throw on non existing value'
            );
        });

        it('Should throw when factory is not a function', function(){
            assert.throws(
                function(){
                    singular.factory('fakeFactory', 1);
                },
                /should be a function/i,
                'Throw on non existing value'
            );
        });

        it('Should instantiate factory and call callback', function(){
            return singular.inject('testFactory', function(value){
                assert.equal(value, 1, 'testFactory result is 1');
            });
        });

        it('Should resolve factory returned promise', function(){
            singular.module({
                promised() {
                    return new Promise(function(resolve){
                        setImmediate(resolve, 1);
                    });
                }
            });

            return singular.inject(function(promised){
                assert.equal(promised, 1, 'Promised value is 1');
            });
        });

        it('Should instantiate factory and return promise', function(){
            var promise = singular.inject('testFactory');

            assert.ok(typeof promise === 'object', 'Return object');
            assert.ok(typeof promise.then === 'function', 'Return thenable');

            return promise.spread(function(value){
                assert.equal(value, 1, 'testFactory returned as 1');
            });
        });
    });

    describe('Resolving', function(){
        it('Should resolve dependencies', function(){
            singular.module({
                a() {
                    return 1;
                },
                b(a) {
                    return a + 1;
                },
            });

            return singular.inject(function(a, b){
                assert.equal(a, 1, 'a is 1');
                assert.equal(b, 2, 'b is 2');
            });
        });

        it('Should inject empty deps list', function(){
            return singular.inject(function(){
                // Do nothing...
            });
        });

        it('Should inject list of strings', function(){
            return singular.inject('a', 'b', function(a, b){
                assert.ok(a, 'a is defined');
                assert.ok(b, 'b is defined');
            });
        });

        it('Should inject array of strings', function(){
            return singular.inject(['a', 'b'], function(a, b){
                assert.ok(a, 'a is defined');
                assert.ok(b, 'b is defined');
            });
        });

        it('Should inject array of strings w/o callback', function(){
            singular.inject(['a', 'b']);
        });

        it('Should inject array of strings w/o callback', function(){
            singular.inject('a', 'b');
        });

        it('Should properly return resolved dependencies', function(){
            return singular.inject(function(a, b){
                assert.equal(a, 1, 'a is 1');
                assert.equal(b, 2, 'b is 2');
            });
        });

    });

    describe('Errors', function(){
        it('Should catch error from callback', function(){
            return singular.inject(function(a){
                throw new Error('test_error');
            })
            .catch(function(error){
                return error;
            })
            .then(function(error){
                assert.equal(error.message, 'test_error', 'Catch test error');
            });
        });

        it('Should throw on cycle dependencies', function(){
            singular.module({
                d(c) {
                    return 1 + c;
                },
                c(d) {
                    return 1 + d;
                },
            });

            return singular.inject(['d'])
            .catch(function(error){
                assert.ok(/cyclic/i.test(error.message), 'Cycle dependency detected');
            });
        });

        it('Should throw on unexisted dependency', function(){
            return singular.inject(['unexistedDependency'])
            .catch(function(error){
                assert.ok(/unknown dependency/i.test(error.message), 'Cycle dependency detected');
            });
        });

        it('Should throw on unmet depended dependency', function(){
            singular.module({
                x1(x2) {
                    return 1 + c;
                }
            });

            return singular.inject(['x1'])
            .catch(function(error){
                assert.ok(/unknown dependency/i.test(error.message), 'Cycle dependency detected');
            });
        });
    });
});

'use strict';

const toposort = require('toposort');
const invoke = require('./invoke');
const fnArgs = require('function-arguments');
const bluebird = require('bluebird');
const EventEmitter = require('events').EventEmitter;

module.exports = Singular;
module.exports.new = function(config) {
    return new Singular(config);
};
module.exports.injector = function(config) {
    var singular = new Singular(config);

    return singular.injector();
};

/**
 * Singular is an angular-like dependency injector
 * @param {object} config Configuration object
 * @constructor
 */
function Singular(options) {
    EventEmitter.call(this);
    var self = this;
    var opts = Object.assign({config: {}}, options);

    this.factories = {};
    this.config = opts.config;
    this.scope = invoke.newScope({
        get app() {
            return self;
        },
        get config() {
            return self.config;
        }
    });
}

Object.setPrototypeOf(Singular.prototype, EventEmitter.prototype);

/**
 * Batch add items to singular scope. Module should be an object and each
 * property is a value or a factory. Each property of source object is value or
 * factory. If property is a function than it used as a factory otherwise
 * it's a value.
 *
 * @param {object} source Target object
 * @returns {Singular}
 */
Singular.prototype.module = function(source) {
    if (!source || typeof source !== 'object') {
        throw new Error('Argument #1 should be an object');
    }

    var self = this;

    Object.getOwnPropertyNames(source).forEach(function(name){
        var value = source[name];
        if (typeof value === 'function') {
            self.factory(name, value);
        } else {
            self.scope[name] = value;
        }
    });

    return this;
};

/**
 * Define value/instantiated service with name
 * @param {string} name Item name
 * @param {*} value Item value
 * @returns {Singular}
 */
Singular.prototype.value = function(name, value) {
    if (this.hasEntity(name)) {
      throw new Error('Name "' + name + '" already in use.');
    }

    this.scope[name] = value;
    return this;
};

/**
 * Check if value/instance already exists
 * @param name
 * @returns {boolean}
 */
Singular.prototype.hasValue = function(name) {
    return name in this.scope;
};

/**
 * Get value with name. Invoke target and dependant factories if needed.
 * @param {string} name Value/instance name
 * @returns {*}
 */
Singular.prototype.get = function(name) {
    if (name in this.scope === false) {
        throw new Error('No value "' + name + '"');
    }

    return this.scope[name];
};

/**
 * Register factory
 * @param {string} name
 * @param {function} factory
 * @returns {Singular}
 */
Singular.prototype.factory = function(name, factory) {
    if (name in this.scope) {
      throw new Error('Instantiated values overwriting is deprecated');
    }

    if (typeof factory !== 'function') {
      throw new Error('Factory should be a function');
    }

    this.factories[name] = {
        deps: fnArgs(factory),
        factory: factory,
    };

    return this;
};

/**
 * Check if factory exists
 * @param {string} name
 * @returns {boolean}
 */
Singular.prototype.hasFactory = function(name) {
    return name in this.factories === true;
};

/**
 * Inject dependencies and pass it to angular-like function
 * @param {string[]} list List of dependencies.
 * @param {function} callback Function to invoke with listed values as arguments
 * @returns {*|exports}
 */
Singular.prototype.run =
Singular.prototype.configure =
Singular.prototype.inject = function(list, callback) {
    if (arguments.length === 1 && typeof list === 'function') {
        callback = list;
        list = fnArgs(callback);
    } else if (typeof list === 'string') {
        list = Array.prototype.slice.call(arguments);
        if (typeof list[list.length - 1] === 'function') {
            callback = list.pop();
        } else {
            callback = null;
        }
    }

    var self = this;
    var queue;

    try {
        queue = this._resolveOrdered(list);
    } catch (err) {
        return Promise.reject(err);
    }

    return bluebird.mapSeries(queue, function(item){
        var result = item;
        if (item in self.scope) {
            return self.scope[item];
        }

        var result = invoke(self.scope, self.factories[item].factory);

        return Promise.resolve(result).then(function(instance){
            self.scope[item] = instance;
            return instance;
        });
    })
    .then(function(){
        var values = list.map(function(item) {
            return self.scope[item];
        });

        if (callback) {
            return callback.apply(null, values);
        }

        return values;
    });
};

/**
 * Resolve and sort dependencies with list of value names
 * @param {Array} list
 * @returns {String[]} List of values ordered by dependency topology.
 * @private
 */
Singular.prototype._resolveOrdered = function(list) {
    var fulfil = [];
    var self = this;
    var topo = {};

    list.forEach(function(name){
        if (! self.hasEntity(name)) {
          throw new Error('Unknown dependency ' + name);
        }

        topo[name] = null;
    });

    do {
        Object.getOwnPropertyNames(topo).forEach(function(name){
            var value = topo[name];
            if (value === null) {
                if (name in self.scope) {
                    topo[name] = [];
                    if (fulfil.indexOf(name) > -1) {
                        fulfil.splice(fulfil.indexOf(name),1);
                    }
                } else if (name in self.factories) {
                    value = topo[name] = self.factories[name].deps;
                    value.forEach(function(dep){
                        if (dep in topo === false) {
                            if (! self.hasEntity(dep)) {
                                throw new Error ('Unknown dependency ' + dep + ' of ' + name);
                            }
                            topo[dep] = null;
                            fulfil.push(dep);
                        }
                    });
                    if (fulfil.indexOf(name) > -1) {
                        fulfil.splice(fulfil.indexOf(name),1);
                    }
                } else {
                    throw new Error('Unknown dependecy ' + name);
                }
            }
        });
    } while (fulfil.length);

    var links = [];
    Object.getOwnPropertyNames(topo).forEach(function(name){
        var value = topo[name];
        if (value.length) {
            value.forEach(function(dep){
                links.push([name, dep]);
            });
        } else {
            links.push([name, null]);
        }
    });

    return toposort(links).reverse().slice(1);
};

/**
 * Check if entity exists in values or factories.
 * @param {string} name Entity name
 * @returns {boolean}
 */
Singular.prototype.hasEntity = function(name) {
    if (name in this.scope) {
      return true;
    } else if (name in this.factories) {
      return true;
    }

    return false;
};

/**
 * Return standalone inject method to direct usage.
 *
 * @return {function} Inject function.
 * @example
 *
 * var inject = singular.injector();
 *
 * await inject('cofig', 'redis', 'etc');
 */
Singular.prototype.injector = function (){
    var injector = this.inject.bind(this);
    injector.get = this.get.bind(this);
    injector.value = this.value.bind(this);
    injector.module = this.module.bind(this);

    return injector;
};

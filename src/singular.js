var toposort = require('toposort');
var invoke = require('./invoke');
var util = require('util');

module.exports = Singular;
module.exports.new = function(config) {
    return new Singular(config);
};

/**
 * Singular is an angular-like dependency injector
 * @param {object} config Configuration object
 * @constructor
 */
function Singular(config) {
    this.factories = {};
    this.config = config;
    var self = this;
    this.scope = {
        get $$() {
            return self;
        }
    };
}

/**
 * Batch add items to singular scope. Module should be an object and each property is a value or a factory. Each property
 * of source object is value or factory. If property is a function than it used as a factory otherwise it's a value.
 * @param {object} source Target object
 * @returns {Singular}
 */
Singular.prototype.module = function(source) {
    if (!source || typeof source !== 'object') throw new Error('Argument #1 should be an object');
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
    if (this.hasEntity(name)) throw new Error('Name "' + name + '" already in use.');

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
    if (name in this.scope) return this.scope[name];

    var queue = this._resolveOrdered([name]);
    var item;
    while(queue.length) {
        item = queue.shift();
        if (item in this.scope === false) {
            try {
                this.scope[item] = invoke(this.scope, this.factories[item].factory);
            } catch (err) {
                // TODO Add error processing
                var error = new Error('Invalid factory "' + item + "':" + err.message);
                error.name = 'Factory Error';
                error.sub = [err];
                throw error;
            }
        }
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
    if (name in this.scope) throw new Error('Overriding instantiated values deprecated');
    if (typeof factory !== 'function') throw new Error('Factory should be a function');

    this.factories[name] = {
        deps:invoke.getArgs(factory),
        factory:factory
    };
    return this;
};

/**
 * Check if factory exists
 * @param {string} name
 * @returns {boolean}
 */
Singular.prototype.hasFactory = function(name) {
    return name in this.factories;
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
    if (arguments.length == 1) {
        callback = list;
        list = invoke.getArgs(callback);
    } else if (typeof list === 'string') {
        list = Array.prototype.slice.call(arguments);
        callback = list.pop();
    }

    callback.$inject = list;

    var queue = this._resolveOrdered(list);

    var item;
    while(queue.length) {
        item = queue.shift();
        if (item in this.scope === false) {
            try {
                this.scope[item] = invoke(this.scope, this.factories[item].factory);
            } catch (err) {
                // TODO Add error processing
                var error = new Error('Invalid factory "' + item + "':" + err.message);
                error.name = 'Factory Error';
                error.sub = [err];
                throw error;
            }
        }
    }

    return invoke(this.scope, callback);
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
        if (! self.hasEntity(name)) throw new Error('Unknown dependency ' + name);
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
    if (name in this.scope) return true;
    else if (name in this.factories) return true;

    return false;
};
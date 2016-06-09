'use strict';

const fnArgs = require('function-arguments');

module.exports = invoke;
module.exports.newScope = newScope.bind(null);

/**
 * Call callback with arguments passed as properties from scope.
 *
 * @param soft {Boolean} Trigger error if argument not found in scope object.
 * @param scope {Object} Data to add as variables to callback
 * @param {Function} callback Function to invoke
 * @return {*} Return result of callback
 */
function invoke(soft, scope, callback) {
    if (arguments.length < 3) {
        callback = scope;
        scope = soft;
        soft = false;
    }

    var _scope = newScope.call(scope);

    Object.keys(scope).forEach(function(key){
      Object.defineProperty(_scope, key, {
        value: scope[key]
      });
    });

    var args = fnArgs(callback).map(function(name){
        if (! soft && name in _scope === false) {
            throw new Error('Dependency "' + name + '" not found');
        }
        return _scope[name];
    });

    return callback.apply(null, args);
}

/**
 * Create child scope with values from data object and __proto__ as self
 *
 * @param {Object} data
 * @return {Object} Child scope
 */
function newScope(data) {
    var subScope = {};

    subScope.__proto__ = this;
    if (typeof data === 'object') {
        for (var name in data) {
            if (data.hasOwnProperty(name)) {
                subScope[name] = data[name];
            }
        }
    }
    subScope.$new = newScope;
    return subScope;
}

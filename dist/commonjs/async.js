'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = asyncProcess;

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function asyncProcess(functions, _ref, callback) {
    var isCancelled = _ref.isCancelled;
    var toState = _ref.toState;
    var fromState = _ref.fromState;
    var additionalArgs = _ref.additionalArgs;

    var remainingFunctions = Array.isArray(functions) ? functions : Object.keys(functions);

    var isState = function isState(obj) {
        return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj.name !== undefined && obj.params !== undefined && obj.path !== undefined;
    };
    var hasStateChanged = function hasStateChanged(state) {
        return state.name !== toState.name || state.params !== toState.params || state.path !== toState.path;
    };

    var processFn = function processFn(done) {
        if (!remainingFunctions.length) return true;

        var isMapped = typeof remainingFunctions[0] === 'string';
        var errVal = isMapped ? remainingFunctions[0] : {};
        var stepFn = isMapped ? functions[remainingFunctions[0]] : remainingFunctions[0];

        // const len = stepFn.length;
        var res = stepFn.apply(null, additionalArgs.concat([toState, fromState, done]));

        if (isCancelled()) {
            done(null);
        } else if (typeof res === 'boolean') {
            done(res ? null : errVal);
        } else if (res && typeof res.then === 'function') {
            res.then(function (resVal) {
                return done(null, resVal);
            }, function () {
                return done(errVal);
            });
        }
        // else: wait for done to be called

        return false;
    };

    var iterate = function iterate(err, val) {
        if (err) callback(err);else {
            if (val && isState(val)) {
                if (hasStateChanged(val)) console.error('[router5][transition] State values changed during transition process and ignored.');else toState = val;
            }
            remainingFunctions = remainingFunctions.slice(1);
            next();
        }
    };

    var next = function next() {
        if (isCancelled()) {
            callback(null);
        } else {
            var finished = processFn(iterate);
            if (finished) callback(null, toState);
        }
    };

    next();
}
module.exports = exports['default'];
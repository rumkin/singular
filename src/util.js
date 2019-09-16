function isThenable(value) {
  return typeof value.then === 'function'
}

function no(fn, after) {
  var result = fn()

  if (!result || !isThenable(result)) {
    return after()
  }

  return result.then(after)
}

function finalize(promise, fn) {
  return promise
  .then(function onFinalizationResult(result) {
    return no(fn, function() {
      return result
    })
  }, function onFinalizationError(error) {
    return no(fn, function onFinalizationRethrow() {
      throw error
    })
  })
}

exports.finalize = finalize

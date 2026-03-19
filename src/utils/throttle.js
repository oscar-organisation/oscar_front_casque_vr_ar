/**
 * Throttle utility — limits function execution to once per interval.
 * Critical for controlling API call frequency (MimicX rate limits).
 * @param {Function} fn
 * @param {number} interval - minimum ms between calls
 * @returns {Function}
 */
export function throttle(fn, interval) {
  let lastCall = 0;

  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

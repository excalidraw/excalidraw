/**
 * Shared leading + trailing edge throttle (tta_rewrite_final.md §2.4).
 *
 * - A call outside the window invokes immediately (leading edge).
 * - A call inside the window parks the *latest* args and schedules a trailing
 *   invocation for when the window elapses — a parked update never has to wait
 *   for the next call to render (M1: no more frozen canvas on provider
 *   stalls).
 * - `flush()` invokes any parked call immediately.
 * - `cancel()` drops any parked call and fully resets the throttle, so the
 *   next call is a leading-edge immediate invoke.
 */
export type ThrottledFunction<Args extends unknown[]> = {
  (...args: Args): void;
  flush: () => void;
  cancel: () => void;
};

export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): ThrottledFunction<Args> => {
  let lastInvokeTime = -Infinity;
  let pendingArgs: Args | null = null;
  let trailingTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearTrailingTimeout = () => {
    if (trailingTimeout !== null) {
      clearTimeout(trailingTimeout);
      trailingTimeout = null;
    }
  };

  const invoke = (args: Args) => {
    pendingArgs = null;
    lastInvokeTime = Date.now();
    fn(...args);
  };

  const throttled = (...args: Args) => {
    const remaining = wait - (Date.now() - lastInvokeTime);
    if (remaining <= 0) {
      clearTrailingTimeout();
      invoke(args);
      return;
    }

    pendingArgs = args;
    if (trailingTimeout === null) {
      trailingTimeout = setTimeout(() => {
        trailingTimeout = null;
        if (pendingArgs) {
          invoke(pendingArgs);
        }
      }, remaining);
    }
  };

  throttled.flush = () => {
    clearTrailingTimeout();
    if (pendingArgs) {
      invoke(pendingArgs);
    }
  };

  throttled.cancel = () => {
    clearTrailingTimeout();
    pendingArgs = null;
    lastInvokeTime = -Infinity;
  };

  return throttled;
};

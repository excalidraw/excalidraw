// Throttle a callback to execute at most once per animation frame
export const throttleRAF = <T extends any[]>(
    fn: (...args: T) => void,
    opts?: { trailing?: boolean },
  ) => {
    let timerId: number | null = null;
    let lastArgs: T | null = null;
  
    const schedule = () => {
      timerId = requestAnimationFrame(() => {
        timerId = null;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      });
    };
  
    const ret = (...args: T) => {
      lastArgs = args;
      if (timerId === null) {
        schedule();
      }
    };
  
    ret.cancel = () => {
      if (timerId !== null) {
        cancelAnimationFrame(timerId);
      }
      timerId = null;
      lastArgs = null;
    };
  
    ret.flush = () => {
      if (timerId !== null) {
        cancelAnimationFrame(timerId);
      }
      timerId = null;
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    };
  
    return ret;
  };
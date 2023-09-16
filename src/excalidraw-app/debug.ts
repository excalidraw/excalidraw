declare global {
  interface Window {
    debug: typeof Debug;
  }
}

const lessPrecise = (num: number, precision = 5) =>
  parseFloat(num.toPrecision(precision));

const getAvgFrameTime = (times: number[]) =>
  lessPrecise(times.reduce((a, b) => a + b) / times.length);

const getFps = (frametime: number) => lessPrecise(1000 / frametime);

export class Debug {
  public static DEBUG_LOG_TIMES = true;

  private static TIMES_AGGR: Record<string, { t: number; times: number[] }> =
    {};
  private static TIMES_AVG: Record<
    string,
    { t: number; times: number[]; avg: number | null }
  > = {};
  private static LAST_DEBUG_LOG_CALL = 0;
  private static DEBUG_LOG_INTERVAL_ID: null | number = null;

  private static setupInterval = () => {
    if (Debug.DEBUG_LOG_INTERVAL_ID === null) {
      console.info("%c(starting perf recording)", "color: lime");
      Debug.DEBUG_LOG_INTERVAL_ID = window.setInterval(Debug.debugLogger, 1000);
    }
    Debug.LAST_DEBUG_LOG_CALL = Date.now();
  };

  private static debugLogger = () => {
    if (
      Date.now() - Debug.LAST_DEBUG_LOG_CALL > 600 &&
      Debug.DEBUG_LOG_INTERVAL_ID !== null
    ) {
      window.clearInterval(Debug.DEBUG_LOG_INTERVAL_ID);
      Debug.DEBUG_LOG_INTERVAL_ID = null;
      for (const [name, { avg }] of Object.entries(Debug.TIMES_AVG)) {
        if (avg != null) {
          console.info(
            `%c${name} run avg: ${avg}ms (${getFps(avg)} fps)`,
            "color: blue",
          );
        }
      }
      console.info("%c(stopping perf recording)", "color: red");
      Debug.TIMES_AGGR = {};
      Debug.TIMES_AVG = {};
      return;
    }
    if (Debug.DEBUG_LOG_TIMES) {
      for (const [name, { t, times }] of Object.entries(Debug.TIMES_AGGR)) {
        if (times.length) {
          console.info(
            name,
            lessPrecise(times.reduce((a, b) => a + b)),
            times.sort((a, b) => a - b).map((x) => lessPrecise(x)),
          );
          Debug.TIMES_AGGR[name] = { t, times: [] };
        }
      }
      for (const [name, { t, times, avg }] of Object.entries(Debug.TIMES_AVG)) {
        if (times.length) {
          const avgFrameTime = getAvgFrameTime(times);
          console.info(name, `${avgFrameTime}ms (${getFps(avgFrameTime)} fps)`);
          Debug.TIMES_AVG[name] = {
            t,
            times: [],
            avg:
              avg != null ? getAvgFrameTime([avg, avgFrameTime]) : avgFrameTime,
          };
        }
      }
    }
  };

  public static logTime = (time?: number, name = "default") => {
    Debug.setupInterval();
    const now = performance.now();
    const { t, times } = (Debug.TIMES_AGGR[name] = Debug.TIMES_AGGR[name] || {
      t: 0,
      times: [],
    });
    if (t) {
      times.push(time != null ? time : now - t);
    }
    Debug.TIMES_AGGR[name].t = now;
  };
  public static logTimeAverage = (time?: number, name = "default") => {
    Debug.setupInterval();
    const now = performance.now();
    const { t, times } = (Debug.TIMES_AVG[name] = Debug.TIMES_AVG[name] || {
      t: 0,
      times: [],
    });
    if (t) {
      times.push(time != null ? time : now - t);
    }
    Debug.TIMES_AVG[name].t = now;
  };

  private static logWrapper =
    (type: "logTime" | "logTimeAverage") =>
    <T extends any[], R>(fn: (...args: T) => R, name = "default") => {
      return (...args: T) => {
        const t0 = performance.now();
        const ret = fn(...args);
        Debug.logTime(performance.now() - t0, name);
        return ret;
      };
    };

  public static logTimeWrap = Debug.logWrapper("logTime");
  public static logTimeAverageWrap = Debug.logWrapper("logTimeAverage");

  public static perfWrap = <T extends any[], R>(
    fn: (...args: T) => R,
    name = "default",
  ) => {
    return (...args: T) => {
      // eslint-disable-next-line no-console
      console.time(name);
      const ret = fn(...args);
      // eslint-disable-next-line no-console
      console.timeEnd(name);
      return ret;
    };
  };
}
//@ts-ignore
window.debug = Debug;

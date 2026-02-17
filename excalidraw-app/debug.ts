declare global {
  interface Window {
    debug: typeof Debug;
  }
}

const lessPrecise = (num: number, precision = 5) =>
  parseFloat(num.toPrecision(precision));

const getAvgFrameTime = (times: number[]) =>
  lessPrecise(times.reduce((a, b) => a + b) / times.length);

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

  private static LAST_FRAME_TIMESTAMP = 0;
  private static FRAME_COUNT = 0;
  private static ANIMATION_FRAME_ID: null | number = null;

  private static scheduleAnimationFrame = () => {
    if (Debug.DEBUG_LOG_INTERVAL_ID !== null) {
      Debug.ANIMATION_FRAME_ID = requestAnimationFrame((timestamp) => {
        if (Debug.LAST_FRAME_TIMESTAMP !== timestamp) {
          Debug.LAST_FRAME_TIMESTAMP = timestamp;
          Debug.FRAME_COUNT++;
        }

        if (Debug.DEBUG_LOG_INTERVAL_ID !== null) {
          Debug.scheduleAnimationFrame();
        }
      });
    }
  };

  private static setupInterval = () => {
    if (Debug.DEBUG_LOG_INTERVAL_ID === null) {
      console.info("%c(starting perf recording)", "color: lime");
      Debug.DEBUG_LOG_INTERVAL_ID = window.setInterval(Debug.debugLogger, 1000);
      Debug.scheduleAnimationFrame();
    }
    Debug.LAST_DEBUG_LOG_CALL = Date.now();
  };

  private static debugLogger = () => {
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
          // const avgFrameTime = getAvgFrameTime(times);
          const totalTime = times.reduce((a, b) => a + b);
          const avgFrameTime = lessPrecise(totalTime / Debug.FRAME_COUNT);
          console.info(
            name,
            `- ${times.length} calls - ${avgFrameTime}ms/frame across ${
              Debug.FRAME_COUNT
            } frames (${lessPrecise(
              (avgFrameTime / 16.67) * 100,
              1,
            )}% of frame budget)`,
          );
          Debug.TIMES_AVG[name] = {
            t,
            times: [],
            avg:
              avg != null ? getAvgFrameTime([avg, avgFrameTime]) : avgFrameTime,
          };
        }
      }
    }
    Debug.FRAME_COUNT = 0;

    // Check for stop condition after logging
    if (
      Date.now() - Debug.LAST_DEBUG_LOG_CALL > 600 &&
      Debug.DEBUG_LOG_INTERVAL_ID !== null
    ) {
      console.info("%c(stopping perf recording)", "color: red");
      window.clearInterval(Debug.DEBUG_LOG_INTERVAL_ID);
      window.cancelAnimationFrame(Debug.ANIMATION_FRAME_ID!);
      Debug.ANIMATION_FRAME_ID = null;
      Debug.FRAME_COUNT = 0;
      Debug.LAST_FRAME_TIMESTAMP = 0;

      Debug.DEBUG_LOG_INTERVAL_ID = null;
      Debug.TIMES_AGGR = {};
      Debug.TIMES_AVG = {};
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
        Debug[type](performance.now() - t0, name);
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

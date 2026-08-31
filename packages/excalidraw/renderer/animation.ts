import { isRenderThrottlingEnabled } from "../reactUtils";

/** String keys are shared process-wide; symbols are created per owning
 * instance, which lets concurrent instances run the same named animation
 * independently. */
export type AnimationKey = string | symbol;

export type Animation<R extends object> = (params: {
  deltaTime: number;
  state?: R;
}) => R | null | undefined;

type AnimationRecord = {
  animation: Animation<any>;
  lastTime: number;
  state: any;
  scheduler: AnimationScheduler;
};

export type AnimationScheduler = Pick<
  Window,
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
  | "setTimeout"
  | "clearTimeout"
>;

type ScheduledFrame =
  | { id: number; type: "raf" }
  | { id: number; type: "timeout" };

export class AnimationController {
  private static scheduledFrames = new Map<
    AnimationScheduler,
    ScheduledFrame
  >();
  private static animations = new Map<AnimationKey, AnimationRecord>();
  private static readonly schedulerCleanups = new WeakMap<Window, void>();

  static start<R extends object>(
    key: AnimationKey,
    animation: Animation<R>,
    scheduler: AnimationScheduler = window,
  ) {
    if (AnimationController.animations.has(key)) {
      return;
    }

    const record: AnimationRecord = {
      animation,
      lastTime: 0,
      state: undefined,
      scheduler,
    };
    AnimationController.animations.set(key, record);

    let initialState: R | null | undefined;
    try {
      initialState = animation({
        deltaTime: 0,
        state: undefined,
      });
    } catch (error) {
      if (AnimationController.animations.get(key) === record) {
        AnimationController.animations.delete(key);
        AnimationController.cancelScheduledFrameIfIdle(record.scheduler);
      }
      throw error;
    }

    // The initial callback may synchronously cancel this animation or replace
    // it with another animation under the same key. Never resurrect or
    // overwrite it after control returns.
    if (AnimationController.animations.get(key) !== record) {
      return;
    }

    if (!initialState) {
      AnimationController.animations.delete(key);
      AnimationController.cancelScheduledFrameIfIdle(record.scheduler);
      return;
    }

    record.state = initialState;
    AnimationController.scheduleNextFrame(record.scheduler);
  }

  private static scheduleNextFrame(scheduler: AnimationScheduler) {
    if (AnimationController.scheduledFrames.has(scheduler)) {
      return;
    }
    AnimationController.registerSchedulerCleanup(scheduler);

    if (isRenderThrottlingEnabled()) {
      AnimationController.scheduledFrames.set(scheduler, {
        id: scheduler.requestAnimationFrame(() =>
          AnimationController.tick(scheduler),
        ),
        type: "raf",
      });
    } else {
      AnimationController.scheduledFrames.set(scheduler, {
        id: scheduler.setTimeout(() => AnimationController.tick(scheduler), 0),
        type: "timeout",
      });
    }
  }

  private static cancelScheduledFrame(scheduler: AnimationScheduler) {
    const scheduledFrame = AnimationController.scheduledFrames.get(scheduler);
    if (!scheduledFrame) {
      return;
    }

    if (scheduledFrame.type === "raf") {
      scheduler.cancelAnimationFrame(scheduledFrame.id);
    } else {
      scheduler.clearTimeout(scheduledFrame.id);
    }

    AnimationController.scheduledFrames.delete(scheduler);
  }

  private static cancelScheduledFrameIfIdle(scheduler: AnimationScheduler) {
    if (
      [...AnimationController.animations.values()].some(
        (animation) => animation.scheduler === scheduler,
      )
    ) {
      return false;
    }

    AnimationController.cancelScheduledFrame(scheduler);
    return true;
  }

  private static registerSchedulerCleanup(scheduler: AnimationScheduler) {
    const win = scheduler as Window;
    if (typeof win.addEventListener !== "function") {
      return;
    }
    if (AnimationController.schedulerCleanups.has(win)) {
      return;
    }
    const drop = () => {
      for (const [key, record] of AnimationController.animations) {
        if (record.scheduler === scheduler) {
          AnimationController.animations.delete(key);
        }
      }
      // The scheduled frame lives in the closing window and never fires
      AnimationController.scheduledFrames.delete(scheduler);
    };
    win.addEventListener("pagehide", drop);
    AnimationController.schedulerCleanups.set(win, undefined);
  }

  private static tick(scheduler: AnimationScheduler) {
    AnimationController.scheduledFrames.delete(scheduler);

    const animations = [...AnimationController.animations].filter(
      ([, animation]) => animation.scheduler === scheduler,
    );

    if (animations.length > 0) {
      // A callback may synchronously add, cancel, or replace animations. Work
      // from the frame's starting set so newly started animations begin on the
      // next frame and every record runs at most once per tick.
      for (const [key, animation] of animations) {
        if (AnimationController.animations.get(key) !== animation) {
          continue;
        }

        const now = performance.now();
        const deltaTime =
          animation.lastTime === 0 ? 0 : now - animation.lastTime;

        const state = animation.animation({
          deltaTime,
          state: animation.state,
        });

        // The callback may have cancelled or replaced itself. Only the record
        // that was invoked is allowed to update or remove its registration.
        if (AnimationController.animations.get(key) !== animation) {
          continue;
        }

        if (!state) {
          AnimationController.animations.delete(key);

          if (AnimationController.cancelScheduledFrameIfIdle(scheduler)) {
            return;
          }
        } else {
          animation.lastTime = now;
          animation.state = state;
        }
      }

      if (AnimationController.cancelScheduledFrameIfIdle(scheduler)) {
        return;
      }

      AnimationController.scheduleNextFrame(scheduler);
    }
  }

  static running(key: AnimationKey) {
    return AnimationController.animations.has(key);
  }

  static cancel(key: AnimationKey) {
    const record = AnimationController.animations.get(key);
    AnimationController.animations.delete(key);
    if (record) {
      AnimationController.cancelScheduledFrameIfIdle(record.scheduler);
    }
  }

  static reset() {
    AnimationController.animations.clear();
    for (const scheduler of [...AnimationController.scheduledFrames.keys()]) {
      AnimationController.cancelScheduledFrame(scheduler);
    }
  }
}

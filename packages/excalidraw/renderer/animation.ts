import { isRenderThrottlingEnabled } from "../reactUtils";

export type Animation<R extends object> = (params: {
  deltaTime: number;
  state?: R;
}) => R | null | undefined;

type AnimationRecord = {
  animation: Animation<any>;
  lastTime: number;
  state: any;
};

export class AnimationController {
  private static scheduledFrame:
    | { id: ReturnType<typeof requestAnimationFrame>; type: "raf" }
    | { id: ReturnType<typeof setTimeout>; type: "timeout" }
    | null = null;
  private static animations = new Map<string, AnimationRecord>();

  static start<R extends object>(key: string, animation: Animation<R>) {
    if (AnimationController.animations.has(key)) {
      return;
    }

    const record: AnimationRecord = {
      animation,
      lastTime: 0,
      state: undefined,
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
        AnimationController.cancelScheduledFrameIfIdle();
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
      AnimationController.cancelScheduledFrameIfIdle();
      return;
    }

    record.state = initialState;
    AnimationController.scheduleNextFrame();
  }

  private static scheduleNextFrame() {
    if (AnimationController.scheduledFrame) {
      return;
    }

    if (isRenderThrottlingEnabled()) {
      AnimationController.scheduledFrame = {
        id: requestAnimationFrame(AnimationController.tick),
        type: "raf",
      };
    } else {
      AnimationController.scheduledFrame = {
        id: setTimeout(AnimationController.tick, 0),
        type: "timeout",
      };
    }
  }

  private static cancelScheduledFrame() {
    if (!AnimationController.scheduledFrame) {
      return;
    }

    if (AnimationController.scheduledFrame.type === "raf") {
      cancelAnimationFrame(AnimationController.scheduledFrame.id);
    } else {
      clearTimeout(AnimationController.scheduledFrame.id);
    }

    AnimationController.scheduledFrame = null;
  }

  private static cancelScheduledFrameIfIdle() {
    if (AnimationController.animations.size > 0) {
      return false;
    }

    AnimationController.cancelScheduledFrame();
    return true;
  }

  private static tick() {
    AnimationController.scheduledFrame = null;

    if (AnimationController.animations.size > 0) {
      // A callback may synchronously add, cancel, or replace animations. Work
      // from the frame's starting set so newly started animations begin on the
      // next frame and every record runs at most once per tick.
      const animations = [...AnimationController.animations];
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

          if (AnimationController.cancelScheduledFrameIfIdle()) {
            return;
          }
        } else {
          animation.lastTime = now;
          animation.state = state;
        }
      }

      if (AnimationController.cancelScheduledFrameIfIdle()) {
        return;
      }

      AnimationController.scheduleNextFrame();
    }
  }

  static running(key: string) {
    return AnimationController.animations.has(key);
  }

  static cancel(key: string) {
    AnimationController.animations.delete(key);
    AnimationController.cancelScheduledFrameIfIdle();
  }

  static reset() {
    AnimationController.animations.clear();
    AnimationController.cancelScheduledFrame();
  }
}

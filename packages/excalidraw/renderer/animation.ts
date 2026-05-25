import { isRenderThrottlingEnabled } from "../reactUtils";

export type Animation<R extends object> = (params: {
  deltaTime: number;
  state?: R;
}) => R | null | undefined;

export class AnimationController {
  private static scheduledFrame:
    | { id: ReturnType<typeof requestAnimationFrame>; type: "raf" }
    | { id: ReturnType<typeof setTimeout>; type: "timeout" }
    | null = null;
  private static animations = new Map<
    string,
    {
      animation: Animation<any>;
      lastTime: number;
      state: any;
    }
  >();

  static start<R extends object>(key: string, animation: Animation<R>) {
    if (AnimationController.animations.has(key)) {
      return;
    }

    const initialState = animation({
      deltaTime: 0,
      state: undefined,
    });

    if (initialState) {
      AnimationController.animations.set(key, {
        animation,
        lastTime: 0,
        state: initialState,
      });

      AnimationController.scheduleNextFrame();
    }
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
      for (const [key, animation] of AnimationController.animations) {
        const now = performance.now();
        const deltaTime =
          animation.lastTime === 0 ? 0 : now - animation.lastTime;

        const state = animation.animation({
          deltaTime,
          state: animation.state,
        });

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
}

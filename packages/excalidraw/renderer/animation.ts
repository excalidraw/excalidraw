import { isRenderThrottlingEnabled } from "../reactUtils";

export type Animation<R extends object> = (params: {
  deltaTime: number;
  state?: R;
}) => R | null | undefined;

export class AnimationController {
  private static isRunning = false;
  private static animations = new Map<
    string,
    {
      animation: Animation<any>;
      lastTime: number;
      state: any;
    }
  >();

  static start<R extends object>(key: string, animation: Animation<R>) {
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

      if (!AnimationController.isRunning) {
        AnimationController.isRunning = true;

        if (isRenderThrottlingEnabled()) {
          requestAnimationFrame(AnimationController.tick);
        } else {
          setTimeout(AnimationController.tick, 0);
        }
      }
    }
  }

  private static tick() {
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

          if (AnimationController.animations.size === 0) {
            AnimationController.isRunning = false;
            return;
          }
        } else {
          animation.lastTime = now;
          animation.state = state;
        }
      }

      if (isRenderThrottlingEnabled()) {
        requestAnimationFrame(AnimationController.tick);
      } else {
        setTimeout(AnimationController.tick, 0);
      }
    }
  }

  static running(key: string) {
    return AnimationController.animations.has(key);
  }

  static cancel(key: string) {
    AnimationController.animations.delete(key);
  }
}

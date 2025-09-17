export type Animation<R extends object> = (params: {
  deltaTime: number;
  state?: R;
}) => R | null | undefined;

export class AnimationController {
  private static animations = new Map<
    string,
    {
      animation: Animation<any>;
      lastTime: number;
      state?: any;
    }
  >();

  static start<R extends object>(key: string, animation: Animation<R>) {
    AnimationController.animations.set(key, {
      animation,
      lastTime: 0,
    });
    requestAnimationFrame(AnimationController.tick);
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
        } else {
          animation.lastTime = now;
          animation.state = state;
        }
      }
      requestAnimationFrame(AnimationController.tick);
    }
  }

  static cancel(key: string) {
    AnimationController.animations.delete(key);
  }
}

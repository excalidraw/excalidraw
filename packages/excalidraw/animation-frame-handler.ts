export type AnimationCallback = (timestamp: number) => void | boolean;

export type AnimationTarget = {
  callback: AnimationCallback;
  stopped: boolean;
};

export class AnimationFrameHandler {
  private targets = new WeakMap<object, AnimationTarget>();
  private rafIds = new WeakMap<object, number>();
  private frameHandlers = new WeakMap<object, FrameRequestCallback>();

  register(key: object, callback: AnimationCallback) {
    this.targets.set(key, { callback, stopped: true });
  }

  start(key: object) {
    const target = this.targets.get(key);

    if (!target) {
      return;
    }

    if (this.rafIds.has(key)) {
      return;
    }

    this.targets.set(key, { ...target, stopped: false });

    const frameHandler = this.constructFrameRequestCallback(key);
    this.frameHandlers.set(key, frameHandler);

    this.scheduleFrame(key);
  }

  stop(key: object) {
    const target = this.targets.get(key);
    if (target && !target.stopped) {
      this.targets.set(key, { ...target, stopped: true });
    }

    this.cancelFrame(key);
  }

  private constructFrameRequestCallback(key: object): FrameRequestCallback {
    return (timestamp: number) => {
      const target = this.targets.get(key);

      if (!target) {
        return;
      }

      const shouldAbort = this.onFrame(target, timestamp);

      if (!target.stopped && !shouldAbort) {
        this.scheduleFrame(key);
      } else {
        this.cancelFrame(key);
      }
    };
  }

  private scheduleFrame(key: object) {
    const frameHandler = this.frameHandlers.get(key);
    if (frameHandler) {
      const rafId = requestAnimationFrame(frameHandler);
      this.rafIds.set(key, rafId);
    }
  }

  private cancelFrame(key: object) {
    if (this.rafIds.has(key)) {
      const rafId = this.rafIds.get(key)!;

      cancelAnimationFrame(rafId);
    }

    this.rafIds.delete(key);
  }

  private onFrame(target: AnimationTarget, timestamp: number): boolean {
    const shouldAbort = target.callback(timestamp);

    return shouldAbort ?? false;
  }
}

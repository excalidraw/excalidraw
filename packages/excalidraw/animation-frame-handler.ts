export type AnimationCallback = (timestamp: number) => void | boolean;

export type AnimationTarget = {
  callback: AnimationCallback;
  stopped: boolean;
};

export class AnimationFrameHandler {
  private targets = new WeakMap<WeakKey, AnimationTarget>();
  private rafIds = new WeakMap<WeakKey, number>();

  register(key: WeakKey, callback: AnimationCallback) {
    this.targets.set(key, { callback, stopped: true });
  }

  start(key: WeakKey) {
    const target = this.targets.get(key);

    if (!target) {
      return;
    }

    if (this.rafIds.has(key)) {
      return;
    }

    this.targets.set(key, { ...target, stopped: false });
    this.scheduleFrame(key, target);
  }

  stop(key: WeakKey) {
    if (this.targets.has(key)) {
      const target = this.targets.get(key)!;
      this.targets.set(key, { ...target, stopped: true });
    }

    this.cancelFrame(key);
  }

  private constructFrame(key: WeakKey): FrameRequestCallback {
    return (timestamp: number) => {
      const target = this.targets.get(key);

      if (!target) {
        return;
      }

      const shouldAbort = this.onFrame(target, timestamp);

      if (!target.stopped && !shouldAbort) {
        this.scheduleFrame(key, target);
      } else {
        this.cancelFrame(key);
      }
    };
  }

  private scheduleFrame(key: WeakKey, target: AnimationTarget) {
    const rafId = requestAnimationFrame(this.constructFrame(key));

    this.rafIds.set(key, rafId);
  }

  private cancelFrame(key: WeakKey) {
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

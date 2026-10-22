import type { UnsubscribeCallback } from "@excalidraw/excalidraw/types";

type Subscriber<T extends any[]> = (...payload: T) => void;

export class Emitter<T extends any[] = []> {
  public subscribers: Subscriber<T>[] = [];

  /**
   * Attaches subscriber
   *
   * @returns unsubscribe function
   */
  on(...handlers: Subscriber<T>[] | Subscriber<T>[][]): UnsubscribeCallback {
    const _handlers = handlers
      .flat()
      .filter((item) => typeof item === "function");

    this.subscribers.push(..._handlers);

    return () => this.off(_handlers);
  }

  once(...handlers: Subscriber<T>[] | Subscriber<T>[][]): UnsubscribeCallback {
    const _handlers = handlers
      .flat()
      .filter((item) => typeof item === "function");

    let fired = false;
    const detach = this.on((...payload: T) => {
      // A nested trigger can consume this listener before an outer trigger reaches it.
      if (fired) {
        return;
      }
      fired = true;
      detach();
      for (const handler of _handlers) {
        handler(...payload);
      }
    });
    return detach;
  }

  off(...handlers: Subscriber<T>[] | Subscriber<T>[][]) {
    const _handlers = handlers.flat();
    this.subscribers = this.subscribers.filter(
      (handler) => !_handlers.includes(handler),
    );
  }

  trigger(...payload: T) {
    for (const handler of this.subscribers) {
      handler(...payload);
    }
    return this;
  }

  clear() {
    this.subscribers = [];
  }
}

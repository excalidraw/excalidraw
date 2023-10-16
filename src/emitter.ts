type Subscriber<T extends any[]> = (...payload: T) => void;

export class Emitter<T extends any[] = []> {
  public subscribers: Subscriber<T>[] = [];
  public value: T | undefined;
  private updateOnChangeOnly: boolean;

  constructor(opts?: { initialState?: T; updateOnChangeOnly?: boolean }) {
    this.updateOnChangeOnly = opts?.updateOnChangeOnly ?? false;
    this.value = opts?.initialState;
  }

  /**
   * Attaches subscriber
   *
   * @returns unsubscribe function
   */
  on(...handlers: Subscriber<T>[] | Subscriber<T>[][]) {
    const _handlers = handlers
      .flat()
      .filter((item) => typeof item === "function");

    this.subscribers.push(..._handlers);

    return () => this.off(_handlers);
  }

  off(...handlers: Subscriber<T>[] | Subscriber<T>[][]) {
    const _handlers = handlers.flat();
    this.subscribers = this.subscribers.filter(
      (handler) => !_handlers.includes(handler),
    );
  }

  trigger(...payload: T): any[] {
    if (this.updateOnChangeOnly && this.value === payload) {
      return [];
    }
    this.value = payload;
    return this.subscribers.map((handler) => handler(...payload));
  }

  destroy() {
    this.subscribers = [];
    this.value = undefined;
  }
}

type Subscriber<T extends any[]> = (...args: T) => void;

export class Emitter<T extends any[]> {
  private listeners: Subscriber<T>[] = [];
  subscribe(cb: Subscriber<T>) {
    this.listeners.push(cb);
  }
  unsubscribe(cb: Subscriber<T>) {
    this.listeners = this.listeners.filter((_cb) => _cb !== cb);
  }
  emit(...args: T) {
    this.listeners.forEach((cb) => {
      cb(...args);
    });
  }
}

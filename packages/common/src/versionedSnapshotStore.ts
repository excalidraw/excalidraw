export type VersionedSnapshot<T> = Readonly<{
  version: number;
  value: T;
}>;

export class VersionedSnapshotStore<T> {
  private version = 0;
  private value: T;
  private readonly waiters = new Set<
    (snapshot: VersionedSnapshot<T>) => void
  >();
  private readonly subscribers = new Set<
    (snapshot: VersionedSnapshot<T>) => void
  >();

  constructor(
    initialValue: T,
    private readonly isEqual: (prev: T, next: T) => boolean = Object.is,
  ) {
    this.value = initialValue;
  }

  public getSnapshot(): VersionedSnapshot<T> {
    return { version: this.version, value: this.value };
  }

  public set(nextValue: T): boolean {
    if (this.isEqual(this.value, nextValue)) {
      return false;
    }

    this.value = nextValue;
    this.version += 1;

    const snapshot = this.getSnapshot();

    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
    for (const waiter of this.waiters) {
      waiter(snapshot);
    }
    this.waiters.clear();

    return true;
  }

  public update(updater: (prev: T) => T): boolean {
    return this.set(updater(this.value));
  }

  public subscribe(
    subscriber: (snapshot: VersionedSnapshot<T>) => void,
  ): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public pull(sinceVersion = -1): Promise<VersionedSnapshot<T>> {
    if (this.version !== sinceVersion) {
      return Promise.resolve(this.getSnapshot());
    }

    return new Promise((resolve) => {
      this.waiters.add(resolve);
    });
  }
}

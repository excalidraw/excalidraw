import Pool from "es6-promise-pool";

// extending the missing types
// relying on the [Index, T] to keep a correct order
type TPromisePool<T, Index = number> = Pool<[Index, T][]> & {
  addEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => (event: { data: { result: [Index, T] } }) => void;
  removeEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => void;
};

export class PromisePool<T> {
  private readonly pool: TPromisePool<T>;
  private readonly entries: Record<number, T> = {};

  constructor(
    source: IterableIterator<Promise<void | readonly [number, T]>>,
    concurrency: number,
  ) {
    this.pool = new Pool(
      source as unknown as () => void | PromiseLike<[number, T][]>,
      concurrency,
    ) as TPromisePool<T>;
  }

  public all() {
    const listener = (event: { data: { result: void | [number, T] } }) => {
      if (event.data.result) {
        // by default pool does not return the results, so we are gathering them manually
        // with the correct call order (represented by the index in the tuple)
        const [index, value] = event.data.result;
        this.entries[index] = value;
      }
    };

    this.pool.addEventListener("fulfilled", listener);

    return this.pool.start().then(() => {
      setTimeout(() => {
        this.pool.removeEventListener("fulfilled", listener);
      });

      return Object.values(this.entries);
    });
  }
}

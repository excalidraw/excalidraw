import { debounce } from "@excalidraw/common";

import { WorkerInTheMainChunkError, WorkerUrlNotDefinedError } from "./errors";

class IdleWorker {
  public instance: Worker;

  constructor(workerUrl: URL) {
    this.instance = new Worker(workerUrl, { type: "module" });
  }

  /**
   * Use to prolong the worker's life by `workerTTL` or terminate it with a flush immediately.
   */
  public debounceTerminate!: ReturnType<typeof debounce>;
}

/**
 * Pool of idle short-lived workers, so that they can be reused in a short period of time (`ttl`), instead of having to create a new worker from scratch.
 */
export class WorkerPool<T, R> {
  private idleWorkers: Set<IdleWorker> = new Set();
  private activeWorkers: Set<IdleWorker> = new Set();

  private readonly workerUrl: URL;
  private readonly workerTTL: number;
  private readonly maxPoolSize: number;

  private constructor(
    workerUrl: URL,
    options: {
      ttl?: number;
      maxPoolSize?: number;
    },
  ) {
    this.workerUrl = workerUrl;
    // by default, active & idle workers will be terminated after 1s of inactivity
    this.workerTTL = options.ttl || 1000;
    // by default, active workers are limited to 3 instances
    this.maxPoolSize = options.maxPoolSize || 3;
  }

  /**
   * Create a new worker pool.
   *
   * @param workerUrl - The URL of the worker file.
   * @param options - The options for the worker pool.
   * @throws If the worker is bundled into the main chunk.
   * @returns A new worker pool instance.
   */
  public static create<T, R>(
    workerUrl: URL | undefined,
    options: {
      ttl?: number;
      maxPoolSize?: number;
    } = {},
  ): WorkerPool<T, R> {
    if (!workerUrl) {
      throw new WorkerUrlNotDefinedError();
    }

    if (!import.meta.url || workerUrl.toString() === import.meta.url) {
      // in case the worker code is bundled into the main chunk
      throw new WorkerInTheMainChunkError();
    }

    return new WorkerPool(workerUrl, options);
  }

  /**
   * Take idle worker from the pool or create a new one and post a message to it.
   */
  public async postMessage(
    data: T,
    options: StructuredSerializeOptions,
  ): Promise<R> {
    let worker: IdleWorker;

    const idleWorker = Array.from(this.idleWorkers).shift();

    if (idleWorker) {
      this.idleWorkers.delete(idleWorker);
      worker = idleWorker;
    } else if (this.activeWorkers.size < this.maxPoolSize) {
      worker = await this.createWorker();
    } else {
      worker = await this.waitForActiveWorker();
    }

    this.activeWorkers.add(worker);

    return new Promise((resolve, reject) => {
      worker.instance.onmessage = this.onMessageHandler(worker, resolve);
      worker.instance.onerror = this.onErrorHandler(worker, reject);

      worker.instance.postMessage(data, options);
      worker.debounceTerminate(() =>
        reject(
          new Error(`Active worker did not respond for ${this.workerTTL}ms!`),
        ),
      );
    });
  }

  /**
   * Terminate the idle workers in the pool.
   */
  public async clear() {
    for (const worker of this.idleWorkers) {
      worker.debounceTerminate.cancel();
      worker.instance.terminate();
    }

    for (const worker of this.activeWorkers) {
      worker.debounceTerminate.cancel();
      worker.instance.terminate();
    }

    this.idleWorkers.clear();
    this.activeWorkers.clear();
  }

  /**
   * Used to get a worker from the pool or create a new one if there is no idle available.
   */
  private async createWorker(): Promise<IdleWorker> {
    const worker = new IdleWorker(this.workerUrl);

    worker.debounceTerminate = debounce((reject?: () => void) => {
      worker.instance.terminate();

      if (this.idleWorkers.has(worker)) {
        this.idleWorkers.delete(worker);

        // eslint-disable-next-line no-console
        console.debug(
          "Job finished! Idle worker has been released from the pool.",
        );
      } else if (reject) {
        reject();
      } else {
        console.error("Worker has been terminated!");
      }
    }, this.workerTTL);

    return worker;
  }

  private waitForActiveWorker(): Promise<IdleWorker> {
    return Promise.race(
      Array.from(this.activeWorkers).map(
        (worker) =>
          new Promise<IdleWorker>((resolve) => {
            const originalOnMessage = worker.instance.onmessage;
            worker.instance.onmessage = (e) => {
              worker.instance.onmessage = originalOnMessage;
              resolve(worker);
            };
          }),
      ),
    );
  }

  private onMessageHandler(worker: IdleWorker, resolve: (value: R) => void) {
    return (e: { data: R }) => {
      worker.debounceTerminate();
      this.activeWorkers.delete(worker);
      this.idleWorkers.add(worker);
      resolve(e.data);
    };
  }

  private onErrorHandler(
    worker: IdleWorker,
    reject: (reason: ErrorEvent) => void,
  ) {
    return (e: ErrorEvent) => {
      this.activeWorkers.delete(worker);

      // terminate the worker immediately before rejection
      worker.debounceTerminate(() => reject(e));
      worker.debounceTerminate.flush();

      // clear the worker pool in case there are some idle workers left
      this.clear();
    };
  }
}

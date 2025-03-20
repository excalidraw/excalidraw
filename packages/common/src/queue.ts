import { promiseTry, resolvablePromise } from ".";

import type { ResolvablePromise } from ".";

import type { MaybePromise } from "./utility-types";

type Job<T, TArgs extends unknown[]> = (...args: TArgs) => MaybePromise<T>;

type QueueJob<T, TArgs extends unknown[]> = {
  jobFactory: Job<T, TArgs>;
  promise: ResolvablePromise<T>;
  args: TArgs;
};

export class Queue {
  private jobs: QueueJob<any, any[]>[] = [];
  private running = false;

  private tick() {
    if (this.running) {
      return;
    }
    const job = this.jobs.shift();
    if (job) {
      this.running = true;
      job.promise.resolve(
        promiseTry(job.jobFactory, ...job.args).finally(() => {
          this.running = false;
          this.tick();
        }),
      );
    } else {
      this.running = false;
    }
  }

  push<TValue, TArgs extends unknown[]>(
    jobFactory: Job<TValue, TArgs>,
    ...args: TArgs
  ): Promise<TValue> {
    const promise = resolvablePromise<TValue>();
    this.jobs.push({ jobFactory, promise, args });

    this.tick();

    return promise;
  }
}

import { PromisePool } from "../src/promise-pool";
import { resolvablePromise } from "../src/utils";

describe("PromisePool", () => {
  /**
   * Creates `count` tasks that each finish on the next microtask, and records
   * when each one starts and ends. The pool pulls the next task from the
   * iterator only when a slot is free, so the code before `yield` runs at the
   * moment the task starts.
   */
  const createTrackedTasks = (count: number) => {
    const stats = { running: 0, maxRunning: 0, log: [] as string[] };

    function* tasks() {
      for (let index = 0; index < count; index++) {
        stats.running++;
        stats.maxRunning = Math.max(stats.maxRunning, stats.running);
        stats.log.push(`start ${index}`);

        yield Promise.resolve().then(() => {
          stats.running--;
          stats.log.push(`end ${index}`);
          return [index, index] as const;
        });
      }
    }

    return { tasks: tasks(), stats };
  };

  it("should resolve with values ordered by index, regardless of completion order", async () => {
    const deferreds = [0, 1, 2].map(() => resolvablePromise<string>());
    const finished: number[] = [];

    function* tasks() {
      for (const [index, deferred] of deferreds.entries()) {
        yield deferred.then((value) => {
          finished.push(index);
          return [index, value] as const;
        });
      }
    }

    const result = new PromisePool(tasks(), deferreds.length).all();

    deferreds[2].resolve("c");
    deferreds[0].resolve("a");
    deferreds[1].resolve("b");

    expect(await result).toEqual(["a", "b", "c"]);
    expect(finished).toEqual([2, 0, 1]);
  });

  it("should never have more than `concurrency` tasks in flight", async () => {
    const { tasks, stats } = createTrackedTasks(6);

    await new PromisePool(tasks, 2).all();

    expect(stats.maxRunning).toBe(2);
  });

  it("should run all tasks when there are more tasks than the concurrency limit", async () => {
    const { tasks, stats } = createTrackedTasks(10);

    const result = await new PromisePool(tasks, 3).all();

    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(stats.log.filter((entry) => entry.startsWith("start"))).toHaveLength(
      10,
    );
    expect(stats.running).toBe(0);
  });

  it("should run tasks one after another when concurrency is 1", async () => {
    const { tasks, stats } = createTrackedTasks(3);

    await new PromisePool(tasks, 1).all();

    expect(stats.log).toEqual([
      "start 0",
      "end 0",
      "start 1",
      "end 1",
      "start 2",
      "end 2",
    ]);
  });

  it("should resolve to an empty array when there are no tasks", async () => {
    function* noTasks() {}

    expect(await new PromisePool<string>(noTasks(), 3).all()).toEqual([]);
  });

  it("should skip tasks that resolve to undefined", async () => {
    function* tasks() {
      yield Promise.resolve([0, "a"] as const);
      yield Promise.resolve();
      yield Promise.resolve([2, "c"] as const);
    }

    expect(await new PromisePool(tasks(), 2).all()).toEqual(["a", "c"]);
  });

  it("should reject when a task rejects", async () => {
    const error = new Error("task failed");

    function* tasks() {
      yield Promise.resolve([0, "a"] as const);
      yield Promise.reject(error);
    }

    await expect(new PromisePool<string>(tasks(), 2).all()).rejects.toBe(error);
  });
});

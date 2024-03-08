import { Queue } from "./queue";

describe("Queue", () => {
  const calls: any[] = [];

  const createJobFactory =
    <T>(
      // for purpose of this test, Error object will become a rejection value
      resolutionOrRejectionValue: T,
      ms = 1,
    ) =>
    () => {
      return new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (resolutionOrRejectionValue instanceof Error) {
            reject(resolutionOrRejectionValue);
          } else {
            resolve(resolutionOrRejectionValue);
          }
        }, ms);
      }).then((x) => {
        calls.push(x);
        return x;
      });
    };

  beforeEach(() => {
    calls.length = 0;
  });

  it("should await and resolve values in order of enqueueing", async () => {
    const queue = new Queue();

    const p1 = queue.push(createJobFactory("A", 50));
    const p2 = queue.push(createJobFactory("B"));
    const p3 = queue.push(createJobFactory("C"));

    expect(await p3).toBe("C");
    expect(await p2).toBe("B");
    expect(await p1).toBe("A");

    expect(calls).toEqual(["A", "B", "C"]);
  });

  it("should reject a job if it throws, and not affect other jobs", async () => {
    const queue = new Queue();

    const err = new Error("B");

    queue.push(createJobFactory("A", 50));
    const p2 = queue.push(createJobFactory(err));
    const p3 = queue.push(createJobFactory("C"));

    const p2err = p2.catch((err) => err);

    await p3;

    expect(await p2err).toBe(err);

    expect(calls).toEqual(["A", "C"]);
  });
});

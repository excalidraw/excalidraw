import { AppEventBus } from "./appEventBus";

type TestEvents = {
  initialize: [api: number];
  pointerUp: [pointerId: string];
  viewState: [zoom: number];
};

const behavior = {
  initialize: { cardinality: "once", replay: "last" },
  pointerUp: { cardinality: "many", replay: "none" },
  viewState: { cardinality: "many", replay: "last" },
} as const;

const flushMicrotasks = async () => Promise.resolve();

describe("AppEventBus", () => {
  it("replays once events to late callback and Promise subscribers", async () => {
    const bus = new AppEventBus<TestEvents, typeof behavior>(behavior);
    bus.emit("initialize", 42);

    const calls: number[] = [];
    bus.on("initialize", (value) => {
      calls.push(value);
    });

    expect(calls).toEqual([]);
    await flushMicrotasks();
    expect(calls).toEqual([42]);

    await expect(bus.on("initialize")).resolves.toBe(42);
  });

  it("does not replay stream events to late subscribers", async () => {
    const bus = new AppEventBus<TestEvents, typeof behavior>(behavior);
    bus.emit("pointerUp", "first");

    const calls: string[] = [];
    bus.on("pointerUp", (pointerId) => {
      calls.push(pointerId);
    });

    await flushMicrotasks();
    expect(calls).toEqual([]);

    bus.emit("pointerUp", "second");
    expect(calls).toEqual(["second"]);
  });

  it("replays replay-last stream events and stays subscribed", async () => {
    const bus = new AppEventBus<TestEvents, typeof behavior>(behavior);
    bus.emit("viewState", 1);

    const calls: number[] = [];
    bus.on("viewState", (zoom) => {
      calls.push(zoom);
    });

    await flushMicrotasks();
    expect(calls).toEqual([1]);

    bus.emit("viewState", 2);
    expect(calls).toEqual([1, 2]);
  });

  it("throws when emitting a once event twice", () => {
    const bus = new AppEventBus<TestEvents, typeof behavior>(behavior);
    bus.emit("initialize", 1);

    expect(() => {
      bus.emit("initialize", 2);
    }).toThrow('Event "initialize" can only be emitted once');
  });
});

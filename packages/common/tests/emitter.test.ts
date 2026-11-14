import { Emitter } from "../src/emitter";

describe("Emitter.once", () => {
  it("does not call the listener again when it triggers a nested event", () => {
    const emitter = new Emitter<[number]>();
    const listener = vi.fn((value: number) => {
      if (value === 1) {
        emitter.trigger(2);
      }
    });
    emitter.once(listener);

    emitter.trigger(1);
    emitter.trigger(3);

    expect(listener.mock.calls).toEqual([[1]]);
  });

  it("does not call a listener consumed by an earlier nested event", () => {
    const emitter = new Emitter<[number]>();
    emitter.on((value) => {
      if (value === 1) {
        emitter.trigger(2);
      }
    });
    const listener = vi.fn();
    emitter.once(listener);

    emitter.trigger(1);

    expect(listener.mock.calls).toEqual([[2]]);
  });

  it("keeps a persistent registration of the same listener", () => {
    const emitter = new Emitter<[number]>();
    const listener = vi.fn();
    emitter.on(listener);
    emitter.once(listener);

    emitter.trigger(1);
    emitter.trigger(2);

    expect(listener.mock.calls).toEqual([[1], [1], [2]]);
  });

  it("unsubscribes even when the listener throws", () => {
    const emitter = new Emitter();
    const listener = vi.fn(() => {
      throw new Error("listener failed");
    });
    emitter.once(listener);

    expect(() => emitter.trigger()).toThrow("listener failed");
    expect(() => emitter.trigger()).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("can unsubscribe before the first event", () => {
    const emitter = new Emitter();
    const listener = vi.fn();
    const unsubscribe = emitter.once(listener);

    unsubscribe();
    emitter.trigger();

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls each supplied listener once with the original payload", () => {
    const emitter = new Emitter<[number]>();
    const first = vi.fn((value: number) => {
      if (value === 1) {
        emitter.trigger(2);
      }
    });
    const second = vi.fn();
    emitter.once([first, second]);

    emitter.trigger(1);
    emitter.trigger(3);

    expect(first.mock.calls).toEqual([[1]]);
    expect(second.mock.calls).toEqual([[1]]);
  });
});

import {
  isTransparent,
  mapFind,
  reduceToCommonValue,
  throttleRAF,
} from "@excalidraw/common";

describe("@excalidraw/common/utils", () => {
  describe("throttleRAF()", () => {
    let originalMode: string;
    let rafCallbacks: Array<FrameRequestCallback>;
    let rafIdCounter: number;

    beforeEach(() => {
      originalMode = import.meta.env.MODE;
      // Override test env so throttleRAF uses requestAnimationFrame
      import.meta.env.MODE = "development";

      rafCallbacks = [];
      rafIdCounter = 0;

      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return ++rafIdCounter;
      });

      vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        // Remove the callback with matching id
        if (id > 0 && id <= rafCallbacks.length) {
          rafCallbacks[id - 1] = () => {}; // replace with no-op
        }
      });
    });

    afterEach(() => {
      import.meta.env.MODE = originalMode;
      vi.restoreAllMocks();
    });

    const flushRAF = () => {
      const callbacks = [...rafCallbacks];
      rafCallbacks = [];
      callbacks.forEach((cb) => cb(performance.now()));
    };

    it("should use the latest arguments when RAF fires", () => {
      const fn = vi.fn();
      const throttled = throttleRAF(fn);

      // Call multiple times before RAF fires
      throttled(1);
      throttled(2);
      throttled(3);

      // Only one RAF should be scheduled
      expect(rafCallbacks).toHaveLength(1);

      // Fire the RAF
      flushRAF();

      // Should have been called with the latest args (3), not the first (1)
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
    });

    it("should call fn immediately for single call", () => {
      const fn = vi.fn();
      const throttled = throttleRAF(fn);

      throttled("only");

      flushRAF();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("only");
    });

    it("should handle trailing option with latest trailing args", () => {
      const fn = vi.fn();
      const throttled = throttleRAF(fn, { trailing: true });

      // First call schedules RAF
      throttled("first");
      // Subsequent calls with trailing update trailing args
      throttled("second");
      throttled("third");

      // Fire the first RAF
      flushRAF();

      // First call should use latest args at time of RAF
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("third");

      // The trailing call should have been scheduled
      // (lastArgsTrailing was "third", which becomes the next scheduled call)
    });

    it("flush should use the latest args", () => {
      const fn = vi.fn();
      const throttled = throttleRAF(fn);

      throttled("first");
      throttled("second");

      throttled.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("second");
    });

    it("cancel should prevent execution", () => {
      const fn = vi.fn();
      const throttled = throttleRAF(fn);

      throttled("value");
      throttled.cancel();

      flushRAF();

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("isTransparent()", () => {
    it("should return true when color is rgb transparent", () => {
      expect(isTransparent("#ff00")).toEqual(true);
      expect(isTransparent("#fff00000")).toEqual(true);
      expect(isTransparent("transparent")).toEqual(true);
    });

    it("should return false when color is not transparent", () => {
      expect(isTransparent("#ced4da")).toEqual(false);
    });
  });

  describe("reduceToCommonValue()", () => {
    it("should return the common value when all values are the same", () => {
      expect(reduceToCommonValue([1, 1])).toEqual(1);
      expect(reduceToCommonValue([0, 0])).toEqual(0);
      expect(reduceToCommonValue(["a", "a"])).toEqual("a");
      expect(reduceToCommonValue(new Set([1]))).toEqual(1);
      expect(reduceToCommonValue([""])).toEqual("");
      expect(reduceToCommonValue([0])).toEqual(0);

      const o = {};
      expect(reduceToCommonValue([o, o])).toEqual(o);

      expect(
        reduceToCommonValue([{ a: 1 }, { a: 1, b: 2 }], (o) => o.a),
      ).toEqual(1);
      expect(
        reduceToCommonValue(new Set([{ a: 1 }, { a: 1, b: 2 }]), (o) => o.a),
      ).toEqual(1);
    });

    it("should return `null` when values are different", () => {
      expect(reduceToCommonValue([1, 2, 3])).toEqual(null);
      expect(reduceToCommonValue(new Set([1, 2]))).toEqual(null);
      expect(reduceToCommonValue([{ a: 1 }, { a: 2 }], (o) => o.a)).toEqual(
        null,
      );
    });

    it("should return `null` when some values are nullable", () => {
      expect(reduceToCommonValue([1, null, 1])).toEqual(null);
      expect(reduceToCommonValue([null, 1])).toEqual(null);
      expect(reduceToCommonValue([1, undefined])).toEqual(null);
      expect(reduceToCommonValue([undefined, 1])).toEqual(null);
      expect(reduceToCommonValue([null])).toEqual(null);
      expect(reduceToCommonValue([undefined])).toEqual(null);
      expect(reduceToCommonValue([])).toEqual(null);
    });
  });

  describe("mapFind()", () => {
    it("should return the first mapped non-null element", () => {
      {
        let counter = 0;

        const result = mapFind(["a", "b", "c"], (value) => {
          counter++;
          return value === "b" ? 42 : null;
        });
        expect(result).toEqual(42);
        expect(counter).toBe(2);
      }

      expect(mapFind([1, 2], (value) => value * 0)).toBe(0);
      expect(mapFind([1, 2], () => false)).toBe(false);
      expect(mapFind([1, 2], () => "")).toBe("");
    });

    it("should return undefined if no mapped element is found", () => {
      expect(mapFind([1, 2], () => undefined)).toBe(undefined);
      expect(mapFind([1, 2], () => null)).toBe(undefined);
    });
  });
});

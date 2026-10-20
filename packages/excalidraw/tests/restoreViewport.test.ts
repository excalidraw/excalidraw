import { getDefaultAppState } from "../appState";
import { restoreAppState } from "../data/restore";

const defaults = getDefaultAppState();

const restoreViewport = (appState: any) => {
  const restored = restoreAppState(appState, null);
  return {
    scrollX: restored.scrollX,
    scrollY: restored.scrollY,
    zoom: restored.zoom.value,
  };
};

describe("restoreAppState viewport sanitization", () => {
  it("keeps finite values as they are", () => {
    expect(
      restoreViewport({ scrollX: 100, scrollY: -50, zoom: { value: 2 } }),
    ).toEqual({ scrollX: 100, scrollY: -50, zoom: 2 });
  });

  it("falls back when scroll is not finite", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(restoreViewport({ scrollX: bad, scrollY: bad })).toEqual({
        scrollX: defaults.scrollX,
        scrollY: defaults.scrollY,
        zoom: defaults.zoom.value,
      });
    }
  });

  it("falls back per axis, not all or nothing", () => {
    expect(restoreViewport({ scrollX: NaN, scrollY: 42 })).toMatchObject({
      scrollX: defaults.scrollX,
      scrollY: 42,
    });
  });

  it("falls back when zoom value is not finite", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(restoreViewport({ zoom: { value: bad } }).zoom).toBe(
        defaults.zoom.value,
      );
    }
  });

  it("falls back when the legacy numeric zoom is not finite", () => {
    expect(restoreViewport({ zoom: NaN }).zoom).toBe(defaults.zoom.value);
  });

  it("still clamps finite but out of range zoom", () => {
    expect(restoreViewport({ zoom: { value: 0 } }).zoom).toBe(0.1);
    expect(restoreViewport({ zoom: { value: 9999 } }).zoom).toBe(30);
  });

  it("still accepts the legacy numeric zoom", () => {
    expect(restoreViewport({ zoom: 2 }).zoom).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import {
  applySlideOrder,
  getSlides,
  moveSlide,
  nextSlideRect,
  renameSlide,
} from "./slides";

const frame = (id: string, x: number, y: number, extra: object = {}) => ({
  id,
  type: "frame",
  x,
  y,
  width: 400,
  height: 300,
  name: null,
  isDeleted: false,
  version: 1,
  versionNonce: 1,
  updated: 1,
  ...extra,
});

describe("getSlides", () => {
  it("only includes live frames", () => {
    const els = [
      frame("a", 0, 0),
      frame("b", 500, 0, { isDeleted: true }),
      { id: "r", type: "rectangle", x: 0, y: 0 },
    ];
    expect(getSlides(els).map((s) => s.id)).toEqual(["a"]);
  });
  it("defaults to reading order (rows, then left to right) and names slides", () => {
    const els = [
      frame("c", 500, 400),
      frame("b", 500, 10),
      frame("a", 0, 0),
      frame("d", 0, 400),
    ];
    const slides = getSlides(els);
    expect(slides.map((s) => s.id)).toEqual(["a", "b", "d", "c"]);
    expect(slides[0]!.name).toBe("Slide 1");
    expect(getSlides([frame("n", 0, 0, { name: "Intro" })])[0]!.name).toBe(
      "Intro",
    );
  });
  it("explicit customData.slide wins, ahead of unordered frames", () => {
    const els = [
      frame("a", 0, 0),
      frame("b", 500, 0, { customData: { slide: 1 } }),
      frame("c", 900, 0, { customData: { slide: 0 } }),
    ];
    expect(getSlides(els).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("reordering", () => {
  it("moveSlide handles edges and no-ops", () => {
    expect(moveSlide(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveSlide(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveSlide(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(moveSlide(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
  it("applySlideOrder writes stable positions, bumps versions only where needed, keeps other data", () => {
    const els = [
      frame("a", 0, 0, { customData: { keep: true } }),
      frame("b", 500, 0),
      { id: "r", type: "rectangle", version: 1, versionNonce: 1 },
    ];
    const out = applySlideOrder(els, ["b", "a"]);
    expect(getSlides(out).map((s) => s.id)).toEqual(["b", "a"]);
    expect((out[0] as any).customData).toEqual({ keep: true, slide: 1 });
    expect((out[0] as any).version).toBeGreaterThan(1); // bumped so collaborators/persistence pick it up
    expect(out[2]).toBe(els[2]); // untouched elements are the same object
    // idempotent: re-applying the same order changes nothing
    const again = applySlideOrder(out, ["b", "a"]);
    expect(again.every((el, i) => el === out[i])).toBe(true);
  });
  it("renameSlide only touches the target", () => {
    const els = [frame("a", 0, 0), frame("b", 500, 0)];
    const out = renameSlide(els, "b", "Roadmap");
    expect(out[0]).toBe(els[0]);
    expect((out[1] as any).name).toBe("Roadmap");
  });
});

describe("nextSlideRect", () => {
  it("places new slides to the right of the last slide", () => {
    const slides = getSlides([frame("a", 100, 50)]);
    expect(nextSlideRect(slides, { x: 0, y: 0 })).toMatchObject({
      x: 100 + 400 + 80,
      y: 50,
      width: 1280,
      height: 720,
    });
  });
  it("centers the first slide on the fallback point", () => {
    expect(nextSlideRect([], { x: 1000, y: 1000 })).toMatchObject({
      x: 360,
      y: 640,
    });
  });
});

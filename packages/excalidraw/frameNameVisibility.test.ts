import { frameNameOpacities } from "./frameNameVisibility";

import type { FrameNameLayout } from "./frameNameVisibility";

const viewport = { width: 390, height: 844 };

const frame = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  labelWidth = 50,
): FrameNameLayout => ({ id, x, y, width, height, labelWidth });

describe("frameNameOpacities", () => {
  let frames: FrameNameLayout[];
  let pinned: Set<string>;
  let result: Map<string, number>;

  beforeEach(() => {
    pinned = new Set();
  });

  describe("when a frame is narrower than twice its label", () => {
    beforeEach(() => {
      frames = [frame("frame-thimble", 100, 100, 99, 200)];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should hide its name", () => {
      expect(result.get("frame-thimble")).toBe(0);
    });
  });

  describe("when a frame is three times as wide as its label", () => {
    beforeEach(() => {
      frames = [frame("frame-rusty-conquistador", 100, 100, 150, 200)];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should show its name fully", () => {
      expect(result.get("frame-rusty-conquistador")).toBe(1);
    });
  });

  describe("when a frame is two and a half times as wide as its label", () => {
    beforeEach(() => {
      frames = [frame("frame-half-lit", 100, 100, 125, 200)];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should be halfway faded in", () => {
      expect(result.get("frame-half-lit")).toBeCloseTo(0.5);
    });
  });

  describe("when a frame is wide but under 60px tall", () => {
    beforeEach(() => {
      frames = [frame("frame-letterbox", 100, 100, 300, 59)];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should hide its name", () => {
      expect(result.get("frame-letterbox")).toBe(0);
    });
  });

  describe("when a frame big enough for its name sits inside a parent too small for its own", () => {
    beforeEach(() => {
      frames = [
        frame("frame-valley-of-the-sun", 50, 50, 300, 300, 200),
        frame("frame-the-lair", 100, 200, 200, 120, 20),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should hide the nested name too", () => {
      expect(result.get("frame-the-lair")).toBe(0);
    });
  });

  describe("when two shown names would sit within 120px of each other", () => {
    beforeEach(() => {
      frames = [
        frame("frame-thunderwrench-small", 150, 160, 160, 100),
        frame("frame-thunderwrench-big", 100, 100, 280, 400),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should keep only the bigger frame's name", () => {
      expect([
        result.get("frame-thunderwrench-big"),
        result.get("frame-thunderwrench-small"),
      ]).toEqual([1, 0]);
    });
  });

  describe("when two names sit more than 120px apart", () => {
    beforeEach(() => {
      frames = [
        frame("frame-left-bank", 20, 100, 160, 100),
        frame("frame-right-bank", 200, 100, 160, 100),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should show both", () => {
      expect([
        result.get("frame-left-bank"),
        result.get("frame-right-bank"),
      ]).toEqual([1, 1]);
    });
  });

  describe("when a bigger frame's name is off screen", () => {
    beforeEach(() => {
      frames = [
        frame("frame-offstage", -40, -10, 2000, 2000),
        frame("frame-onstage", 20, 40, 160, 100),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should not crowd out the name on screen", () => {
      expect(result.get("frame-onstage")).toBe(1);
    });
  });

  describe("when a frame too small for its name is pinned", () => {
    beforeEach(() => {
      frames = [
        frame("frame-valley-of-the-sun", 50, 50, 300, 300, 200),
        frame("frame-speck", 60, 60, 4, 3),
      ];
      pinned.add("frame-speck");
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should show its name", () => {
      expect(result.get("frame-speck")).toBe(1);
    });
  });

  describe("when the view sits inside a frame whose name crowds its parent's", () => {
    beforeEach(() => {
      frames = [
        frame("frame-outer-keep", 0, 30, 390, 800),
        frame("frame-inner-keep", 10, 40, 370, 700),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should show the name of the frame you are in", () => {
      expect(result.get("frame-inner-keep")).toBe(1);
    });
  });
  describe("when a small frame in a section's corner is pinned", () => {
    beforeEach(() => {
      frames = [
        frame("frame-section-rusty", 20, 100, 350, 450),
        frame("frame-corner-note", 22, 102, 15, 10),
        frame("frame-sibling-far", 150, 300, 200, 200),
      ];
      pinned.add("frame-corner-note");
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should leave the other names as they were", () => {
      expect([
        result.get("frame-section-rusty"),
        result.get("frame-sibling-far"),
      ]).toEqual([1, 1]);
    });
  });

  describe("when a parent's name is crowded out but the parent is big enough", () => {
    beforeEach(() => {
      frames = [
        frame("frame-grand-hall", 20, 100, 190, 400),
        frame("frame-anteroom", 30, 110, 170, 380),
        frame("frame-far-closet", 60, 300, 120, 100, 30),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should still show its child's name", () => {
      expect(result.get("frame-far-closet")).toBe(1);
    });
  });

  describe("when a barely visible name sits near a name with room to show", () => {
    beforeEach(() => {
      frames = [
        frame("frame-faint-parlour", 20, 100, 205, 300, 100),
        frame("frame-bright-nook", 40, 150, 150, 120),
      ];
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should dim the nearby name only as much as the faint one shows", () => {
      expect(result.get("frame-bright-nook")).toBeCloseTo(0.95);
    });
  });
  describe("when a frame whose name crowds its child's is pinned", () => {
    beforeEach(() => {
      frames = [
        frame("frame-hovered-hall", 20, 100, 300, 225),
        frame("frame-shy-alcove", 34, 114, 125, 100),
      ];
      pinned.add("frame-hovered-hall");
      result = frameNameOpacities(frames, viewport, pinned);
    });

    it("should keep the child's name hidden", () => {
      expect(result.get("frame-shy-alcove")).toBe(0);
    });
  });
});

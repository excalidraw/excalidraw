import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { newElement } from "../src/newElement";
import { isBlurLensElement } from "../src/renderElement";

describe("blur lens feature", () => {
  describe("element defaults", () => {
    it("new rectangle has blur defaults", () => {
      const el = newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      expect(el.blurStyle).toBe("none");
      expect(el.blurRadius).toBe(0);
    });

    it("new diamond has blur defaults", () => {
      const el = newElement({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      expect(el.blurStyle).toBe("none");
      expect(el.blurRadius).toBe(0);
    });

    it("new ellipse has blur defaults", () => {
      const el = newElement({
        type: "ellipse",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      expect(el.blurStyle).toBe("none");
      expect(el.blurRadius).toBe(0);
    });

    it("explicit values are preserved", () => {
      const el = newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        blurStyle: "gaussian",
        blurRadius: 16,
      });
      expect(el.blurStyle).toBe("gaussian");
      expect(el.blurRadius).toBe(16);
    });

    it("DEFAULT_ELEMENT_PROPS exposes blur defaults", () => {
      expect(DEFAULT_ELEMENT_PROPS.blurStyle).toBe("none");
      expect(DEFAULT_ELEMENT_PROPS.blurRadius).toBe(0);
    });
  });

  describe("isBlurLensElement", () => {
    const baseEl = (overrides: Record<string, unknown>) =>
      newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        ...overrides,
      });

    it("returns false for blurStyle=none", () => {
      expect(
        isBlurLensElement(baseEl({ blurStyle: "none", blurRadius: 14 })),
      ).toBe(false);
    });

    it("returns false for blurRadius=0", () => {
      expect(
        isBlurLensElement(baseEl({ blurStyle: "gaussian", blurRadius: 0 })),
      ).toBe(false);
    });

    it("returns true for rectangle with gaussian + radius>0", () => {
      expect(
        isBlurLensElement(baseEl({ blurStyle: "gaussian", blurRadius: 14 })),
      ).toBe(true);
    });

    it("returns true for rectangle with pixelate + radius>0", () => {
      expect(
        isBlurLensElement(baseEl({ blurStyle: "pixelate", blurRadius: 8 })),
      ).toBe(true);
    });

    it("returns true for diamond with blur", () => {
      const el = newElement({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        blurStyle: "gaussian",
        blurRadius: 14,
      });
      expect(isBlurLensElement(el)).toBe(true);
    });

    it("returns true for ellipse with blur", () => {
      const el = newElement({
        type: "ellipse",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        blurStyle: "gaussian",
        blurRadius: 14,
      });
      expect(isBlurLensElement(el)).toBe(true);
    });
  });
});

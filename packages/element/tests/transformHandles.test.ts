import { type Radians } from "@excalidraw/math";

import { SIDE_RESIZING_THRESHOLD } from "@excalidraw/common";

import type { EditorInterface } from "@excalidraw/common";
import type { Bounds } from "@excalidraw/common";
import type { Zoom } from "@excalidraw/excalidraw/types";

import {
  getTransformHandlesFromCoords,
  getOmitSidesForEditorInterface,
  DEFAULT_OMIT_SIDES,
} from "../src/transformHandles";
import { getTransformHandleTypeFromCoords } from "../src/resizeTest";

import type { TransformHandleType } from "../src/transformHandles";

// Fills the confirmed unit-test gap for handle-quadrant selection: which resize
// handle a pointer position resolves to. Pure geometry, no App/DOM.

const zoom = { value: 1 } as Zoom;

const desktop: EditorInterface = {
  formFactor: "desktop",
  desktopUIMode: "full",
  userAgent: { isMobileDevice: false, platform: "other" },
  isTouchScreen: false,
  canFitSidebar: true,
  isLandscape: true,
};

// Rectangle bounds, well clear of the origin so handle rects don't overlap.
const bounds: Bounds = [100, 100, 300, 200];
const [x1, y1, x2, y2] = bounds;

const handleCenters = () => {
  const handles = getTransformHandlesFromCoords(
    [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
    0 as Radians,
    zoom,
    "mouse",
    getOmitSidesForEditorInterface(desktop),
  );
  return Object.entries(handles).flatMap(([key, rect]) =>
    rect ? [[key as TransformHandleType, rect] as const] : [],
  );
};

describe("getTransformHandleTypeFromCoords", () => {
  it("resolves a pointer at each handle's center to that handle", () => {
    for (const [key, [hx, hy, hw, hh]] of handleCenters()) {
      const found = getTransformHandleTypeFromCoords(
        bounds,
        hx + hw / 2,
        hy + hh / 2,
        zoom,
        "mouse",
        desktop,
      );
      expect(found).toBe(key);
    }
  });

  it("returns false in the dead center (no handle, no side)", () => {
    expect(
      getTransformHandleTypeFromCoords(
        bounds,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        zoom,
        "mouse",
        desktop,
      ),
    ).toBe(false);
  });

  // Side handles aren't rendered as rects (DEFAULT_OMIT_SIDES omits them); they
  // are detected as a band `SIDE_RESIZING_THRESHOLD` outside each edge.
  it("resolves side handles from the resize band outside each edge", () => {
    const at = (px: number, py: number) =>
      getTransformHandleTypeFromCoords(bounds, px, py, zoom, "mouse", desktop);

    const spacing = SIDE_RESIZING_THRESHOLD / zoom.value;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    expect(at(midX, y1 - spacing)).toBe("n");
    expect(at(midX, y2 + spacing)).toBe("s");
    expect(at(x1 - spacing, midY)).toBe("w");
    expect(at(x2 + spacing, midY)).toBe("e");
  });

  it("omits no corner handle for a desktop selection", () => {
    const keys = handleCenters().map(([key]) => key);
    expect(keys).toEqual(expect.arrayContaining(["nw", "ne", "sw", "se"]));
    // DEFAULT_OMIT_SIDES is what desktop uses (sanity check on the fixture)
    expect(getOmitSidesForEditorInterface(desktop)).toBe(DEFAULT_OMIT_SIDES);
  });
});

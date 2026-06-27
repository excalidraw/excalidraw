import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawLineElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const selectBucketFill = () => {
  act(() => {
    h.app.setActiveTool({ type: "bucketFill" });
  });
};

describe("bucket fill tool", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const seedRectangle = () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    // commit the owner as its own history increment so the bucket fill is a
    // separate, independently-undoable step
    act(() => {
      h.app.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    return rect;
  };

  it("creates a selected line polygon with the current background color", () => {
    const rect = seedRectangle();
    act(() => {
      // the bucket fill color is independent from the generic shape background
      API.setAppState({
        currentItemBackgroundColor: "#000000",
        currentItemBucketFillBackgroundColor: "#ffec99",
      });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    const fill = h.elements.find(
      (el) => el.type === "line" && !el.isDeleted,
    ) as ExcalidrawLineElement | undefined;

    expect(fill).toBeDefined();
    expect(fill!.polygon).toBe(true);
    expect(fill!.backgroundColor).toBe("#ffec99");
    expect(fill!.strokeColor).toBe("transparent");
    expect(fill!.fillStyle).toBe("solid");
    expect(fill!.customData?.bucketFill?.ownerId).toBe(rect.id);

    // linear elements must be normalized: points[0] === [0, 0], and the
    // polygon is explicitly closed
    expect(fill!.points[0]).toEqual([0, 0]);
    expect(fill!.points[fill!.points.length - 1]).toEqual([0, 0]);

    // inserted immediately below (before) the owner in z-order
    expect(h.elements[0].id).toBe(fill!.id);
    expect(h.elements[1].id).toBe(rect.id);

    // selected, and tool returns to selection
    expect(h.state.selectedElementIds[fill!.id]).toBe(true);
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("shows only the fill color picker in the panel when the tool is active", () => {
    seedRectangle();
    selectBucketFill();

    const panel = document.querySelector(".selected-shape-actions");
    expect(panel).not.toBeNull();
    // the fill (background) color picker is shown...
    expect(panel!.querySelector('[aria-label="Background"]')).not.toBeNull();
    // ...and nothing else from the generic shape panel (e.g. stroke)
    expect(panel!.querySelector('[aria-label="Stroke"]')).toBeNull();
  });

  it("no-ops with a transparent background color", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBucketFillBackgroundColor: "transparent" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
    expect(h.state.toast?.message).toMatch(/background color/i);
  });

  it("inserts the overlap fill below the lowest participating shape", () => {
    const below = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const owner = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    act(() => {
      h.app.updateScene({
        elements: [below, owner],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    act(() => {
      API.setAppState({ currentItemBucketFillBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    // click the overlap lens (inside both rectangles)
    mouse.clickAt(75, 75);

    const fill = h.elements.find((el) => el.type === "line" && !el.isDeleted)!;
    expect(fill).toBeDefined();
    // both rectangles bound the lens, so the fill goes below the lower one
    expect(fill.customData?.bucketFill?.boundaryElementIds).toContain(below.id);
    expect(h.elements[0].id).toBe(fill.id);
    expect(h.elements[1].id).toBe(below.id);
    expect(h.elements[2].id).toBe(owner.id);
  });

  it("does nothing when clicking empty canvas", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBucketFillBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(400, 400);

    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
  });

  it("undo removes the generated fill in one step", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBucketFillBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    const fill = h.elements.find((el) => el.type === "line" && !el.isDeleted)!;
    expect(fill).toBeDefined();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    expect(
      h.elements.find((el) => el.id === fill.id && !el.isDeleted),
    ).toBeUndefined();
    // the owner rectangle survives
    expect(
      h.elements.filter((el) => el.type === "rectangle" && !el.isDeleted),
    ).toHaveLength(1);
  });
});

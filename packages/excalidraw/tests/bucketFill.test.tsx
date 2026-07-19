import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawLineElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const selectBucketFill = () => {
  act(() => {
    h.app.setActiveTool({ type: "bucketFill" });
  });
};

describe("bucket fill tool", () => {
  beforeAll(() => {
    // radix popovers (font family, color picker) need a ResizeObserver;
    // jsdom has none (same stub as test-utils' togglePopover)
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

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
      // the bucket fill color is the shared shape background color
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
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
    // marked as a generated fill (no scene metadata beyond the marker)
    expect(fill!.customData).toEqual({ bucketFill: { version: 1 } });

    // linear elements must be normalized: points[0] === [0, 0], and the
    // polygon is explicitly closed
    expect(fill!.points[0]).toEqual([0, 0]);
    expect(fill!.points[fill!.points.length - 1]).toEqual([0, 0]);

    // inserted immediately below (before) the owner in z-order
    expect(h.elements[0].id).toBe(fill!.id);
    expect(h.elements[1].id).toBe(rect.id);

    // the fill is NOT selected and the tool stays active so the user can keep
    // filling regions back-to-back
    expect(h.state.selectedElementIds[fill!.id]).not.toBe(true);
    expect(h.state.activeTool.type).toBe("bucketFill");
  });

  it("can fill multiple regions in a row without re-selecting the tool", () => {
    const first = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 100,
      height: 80,
      roundness: null,
      backgroundColor: "transparent",
    });
    const second = API.createElement({
      type: "rectangle",
      x: 200,
      y: 20,
      width: 100,
      height: 80,
      roundness: null,
      backgroundColor: "transparent",
    });
    act(() => {
      h.app.updateScene({
        elements: [first, second],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(70, 60); // inside first
    expect(h.state.activeTool.type).toBe("bucketFill");
    mouse.clickAt(250, 60); // inside second, tool still active

    const fills = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted,
    );
    expect(fills).toHaveLength(2);
    expect(h.state.activeTool.type).toBe("bucketFill");
  });

  it("shows fill color, fill style and opacity in the panel when the tool is active", () => {
    seedRectangle();
    selectBucketFill();

    const panel = document.querySelector(".selected-shape-actions");
    expect(panel).not.toBeNull();
    // the fill (background) color picker is shown...
    expect(panel!.querySelector('[aria-label="Background"]')).not.toBeNull();
    // ...along with the fill style + opacity controls for the created fills...
    expect(panel!.querySelector('[data-testid="fill-hachure"]')).not.toBeNull();
    expect(panel!.querySelector('[data-testid="opacity"]')).not.toBeNull();
    // ...and nothing else from the generic shape panel (e.g. stroke)
    expect(panel!.querySelector('[aria-label="Stroke"]')).toBeNull();
  });

  it("uses the current fill style and opacity for created fills", () => {
    seedRectangle();
    act(() => {
      API.setAppState({
        currentItemBackgroundColor: "#ffec99",
        currentItemFillStyle: "hachure",
        currentItemOpacity: 60,
      });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    const fill = h.elements.find(
      (el) => el.type === "line" && !el.isDeleted,
    ) as ExcalidrawLineElement | undefined;
    expect(fill).toBeDefined();
    expect(fill!.fillStyle).toBe("hachure");
    expect(fill!.opacity).toBe(60);
  });

  it("selects the tool with the b shortcut", () => {
    expect(h.state.activeTool.type).toBe("selection");
    Keyboard.keyPress(KEYS.B);
    expect(h.state.activeTool.type).toBe("bucketFill");
  });

  it("opens the background color popup with the g shortcut", () => {
    selectBucketFill();
    Keyboard.keyPress(KEYS.G);
    expect(h.state.openPopup).toBe("elementBackground");
  });

  it("shift+f opens the font popup instead of switching to bucket fill", () => {
    // regression: bucket fill was originally bound to shift+f, shadowing the
    // long-standing "show fonts" shortcut for text elements
    const text = API.createElement({ type: "text", x: 20, y: 20 });
    act(() => {
      h.app.updateScene({
        elements: [text],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      API.setAppState({ selectedElementIds: { [text.id]: true } });
    });

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress("F");
    });

    expect(h.state.activeTool.type).not.toBe("bucketFill");
    expect(h.state.openPopup).toBe("fontFamily");
  });

  it("falls back to green when the shared background color is transparent", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "transparent" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    const fill = h.elements.find(
      (el) => el.type === "line" && !el.isDeleted,
    ) as ExcalidrawLineElement | undefined;
    expect(fill).toBeDefined();
    expect(fill!.backgroundColor).toBe("#b2f2bb");
    // the shared appState value is left untouched
    expect(h.state.currentItemBackgroundColor).toBe("transparent");
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
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    // click the overlap lens (inside both rectangles)
    mouse.clickAt(75, 75);

    const fill = h.elements.find((el) => el.type === "line" && !el.isDeleted)!;
    expect(fill).toBeDefined();
    // both rectangles bound the lens, so the fill goes below the lower one
    expect(h.elements[0].id).toBe(fill.id);
    expect(h.elements[1].id).toBe(below.id);
    expect(h.elements[2].id).toBe(owner.id);
  });

  it("inserts the fill above a participant whose opaque background covers it", () => {
    // lower rectangle is filled red: its background would hide a fill placed
    // beneath it, so the bucket fill must go above it (but below the
    // transparent owner, whose outline should stay visible)
    const below = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "#ff0000",
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
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(75, 75);

    const fill = h.elements.find((el) => el.type === "line" && !el.isDeleted)!;
    expect(fill).toBeDefined();
    // order: below (red, covered) -> fill -> owner (transparent outline on top)
    expect(h.elements[0].id).toBe(below.id);
    expect(h.elements[1].id).toBe(fill.id);
    expect(h.elements[2].id).toBe(owner.id);
  });

  it("does nothing when clicking empty canvas", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(400, 400);

    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
  });

  it("does not fill on right-click or middle-click", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    for (const button of [1, 2]) {
      fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
        clientX: 80,
        clientY: 70,
        button,
        pointerId: 1,
        pointerType: "mouse",
      });
      fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
        clientX: 80,
        clientY: 70,
        button,
        pointerId: 1,
        pointerType: "mouse",
      });
    }

    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
  });

  it("does not fill in view mode", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();
    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });

    mouse.clickAt(80, 70);

    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
  });

  it("undo removes the generated fill in one step", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
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

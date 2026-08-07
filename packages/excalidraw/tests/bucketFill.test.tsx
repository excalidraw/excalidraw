import {
  BUCKET_FILL_BACKGROUND_PICKS,
  COLOR_PALETTE,
  getBucketFillBackgroundColor,
  KEYS,
} from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { ExcalidrawLineElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  togglePopover,
  waitFor,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const selectBucketFill = () => {
  act(() => {
    h.app.setActiveTool({ type: "bucketfill" });
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

  it("uses the paint droplet as the bucket fill cursor hotspot", () => {
    selectBucketFill();

    expect(GlobalTestState.interactiveCanvas.style.cursor).toMatch(
      /^url\(data:image\/svg\+xml/,
    );
    expect(GlobalTestState.interactiveCanvas.style.cursor).toMatch(
      /\) 5 18, auto$/,
    );
  });

  it("colorizes the cursor with the effective fill color and keeps it updated", () => {
    act(() => {
      API.setAppState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
      });
    });
    selectBucketFill();

    const fallbackColor = getBucketFillBackgroundColor(
      COLOR_PALETTE.transparent,
    );
    const fallbackCursor = GlobalTestState.interactiveCanvas.style.cursor;
    expect(decodeURIComponent(fallbackCursor)).toContain(
      `fill="${fallbackColor}"`,
    );

    const nextColor = "#ffec99";
    act(() => {
      API.setAppState({ currentItemBackgroundColor: nextColor });
    });

    const updatedCursor = GlobalTestState.interactiveCanvas.style.cursor;
    expect(updatedCursor).not.toBe(fallbackCursor);
    expect(decodeURIComponent(updatedCursor)).toContain(`fill="${nextColor}"`);
  });

  it("does not rebuild or reapply an unchanged bucket fill cursor", () => {
    selectBucketFill();
    const encodeURIComponentSpy = vi.spyOn(globalThis, "encodeURIComponent");
    const cursorSetterSpy = vi.spyOn(
      GlobalTestState.interactiveCanvas.style,
      "cursor",
      "set",
    );

    h.app.cursor.applyForTool();

    expect(encodeURIComponentSpy).not.toHaveBeenCalled();
    expect(cursorSetterSpy).not.toHaveBeenCalled();
    encodeURIComponentSpy.mockRestore();
    cursorSetterSpy.mockRestore();
  });

  it("cycles the non-white top picks on repeated B presses", () => {
    const colorPicks = BUCKET_FILL_BACKGROUND_PICKS.filter(
      (color) => color !== COLOR_PALETTE.white,
    );
    act(() => {
      API.setAppState({ currentItemBackgroundColor: COLOR_PALETTE.white });
    });

    Keyboard.keyPress(KEYS.B);
    expect(h.state.activeTool.type).toBe("bucketfill");
    expect(h.state.currentItemBackgroundColor).toBe(COLOR_PALETTE.white);

    for (const color of colorPicks) {
      Keyboard.keyPress(KEYS.B);
      expect(h.state.currentItemBackgroundColor).toBe(color);
      expect(
        decodeURIComponent(GlobalTestState.interactiveCanvas.style.cursor),
      ).toContain(`fill="${color}"`);
    }

    Keyboard.keyPress(KEYS.B);
    expect(h.state.currentItemBackgroundColor).toBe(colorPicks[0]);
  });

  it("temporarily activates the background eye dropper while Alt is held", async () => {
    selectBucketFill();

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyDown(KEYS.ALT);
    });

    const eyeDropper = editorJotaiStore.get(activeEyeDropperAtom);
    expect(eyeDropper).not.toBeNull();
    expect(eyeDropper!.colorPickerType).toBe("elementBackground");
    expect(eyeDropper!.keepOpenOnAlt).toBe(true);
    expect(eyeDropper!.swapPreviewOnAlt).toBeUndefined();
    await waitFor(() => {
      expect(
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        ),
      ).not.toBeNull();
    });

    const color = "#ff8787";
    act(() => {
      eyeDropper!.onSelect(color, { altKey: true } as PointerEvent);
    });
    expect(h.state.currentItemBackgroundColor).toBe(color);

    Keyboard.keyUp(KEYS.ALT);
    expect(editorJotaiStore.get(activeEyeDropperAtom)).toBeNull();
    await waitFor(() => {
      expect(
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        ),
      ).toBeNull();
    });
  });

  it("clears the bucket fill cursor immediately when Escape exits the tool", () => {
    selectBucketFill();
    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("url(");

    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.state.activeTool.type).toBe("selection");
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("");
  });

  it("creates a unselected line polygon with the current background color", () => {
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
    // no metadata marker: fills are recognized by shape, not provenance
    expect(fill!.customData).toBeUndefined();

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
    expect(h.state.activeTool.type).toBe("bucketfill");
  });

  it("fires the public onPointerDown/onPointerUp callbacks", async () => {
    // regression: the bucket branch used to early-return before the shared
    // pointer lifecycle, silently skipping the public callback contract
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />,
    );
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(1);
  });

  it("recovers from a lost pointer-up via the shared cleanup", () => {
    // regression: the old bespoke once-listener only reset pointer state on
    // a real pointer-up; the shared missing-pointer-up cleanup now covers
    // lost ones (e.g. window blurred mid-click)
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.downAt(80, 70);
    expect(h.state.cursorButton).toBe("down");

    act(() => {
      (h.app as any).maybeCleanupAfterMissingPointerUp(null);
    });
    expect(h.state.cursorButton).toBe("up");
    // the click never completed, so the armed fill is discarded — an
    // interrupted interaction must not leave a permanent edit
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(0);
    mouse.upAt(80, 70);
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(0);
  });

  it("dragging with the bucket tool neither selects nor creates extras", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.downAt(80, 70);
    mouse.moveTo(120, 100); // drag well past any threshold
    mouse.upAt(120, 100);

    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(1);
    expect(h.state.selectionElement).toBeNull();
    expect(Object.keys(h.state.selectedElementIds)).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("bucketfill");
  });

  it("re-clicking a filled region does not stack a duplicate fill", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);
    mouse.clickAt(80, 70);

    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(1);
  });

  it("re-clicking with a changed color restyles the existing fill", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffc9c9" });
    });
    mouse.clickAt(80, 70);

    const fills = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted,
    );
    expect(fills).toHaveLength(1);
    expect(fills[0].backgroundColor).toBe("#ffc9c9");

    // the restyle is its own undoable step
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });
    const afterUndo = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted,
    );
    expect(afterUndo).toHaveLength(1);
    expect(afterUndo[0].backgroundColor).toBe("#ffec99");
  });

  it("restyles an orphaned fill even when no region can be derived", () => {
    const rect = seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70);

    // delete the rectangle: the fill's boundaries are gone, so no region
    // can be derived around the click anymore
    act(() => {
      h.app.updateScene({
        elements: h.elements.filter((el) => el.id !== rect.id),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffc9c9" });
    });

    mouse.clickAt(80, 70); // on the orphaned paint

    const fills = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted,
    );
    expect(fills).toHaveLength(1);
    expect(fills[0].backgroundColor).toBe("#ffc9c9");
  });

  it("clicking a since-subdivided part of a filled region creates a new fill", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    mouse.clickAt(80, 70); // fill the whole rectangle

    // split the region with a line drawn afterwards
    const splitter = API.createElement({
      type: "line",
      x: 10,
      y: 70,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(140, 0)],
    });
    act(() => {
      h.app.updateScene({
        elements: [...h.elements, splitter],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    mouse.clickAt(80, 45); // top half: a different (smaller) region now

    const fills = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted && el.id !== splitter.id,
    );
    expect(fills).toHaveLength(2);
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
    expect(h.state.activeTool.type).toBe("bucketfill");
    mouse.clickAt(250, 60); // inside second, tool still active

    const fills = h.elements.filter(
      (el) => el.type === "line" && !el.isDeleted,
    );
    expect(fills).toHaveLength(2);
    expect(h.state.activeTool.type).toBe("bucketfill");
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
    expect(h.state.activeTool.type).toBe("bucketfill");
  });

  it("opens the background color popup with the g shortcut", () => {
    selectBucketFill();
    Keyboard.keyPress(KEYS.G);
    expect(h.state.openPopup).toBe("elementBackground");
  });

  it("swallows the hidden transparent entry's hotkey (q) inside the picker", () => {
    // regression: the hidden transparent entry's `q` returned "unhandled",
    // so the picker didn't stop propagation and App.onKeyDown toggled the
    // global tool lock while the color dialog was open
    seedRectangle();
    selectBucketFill();
    togglePopover("Background");

    const picker = document.querySelector(".color-picker-content")!;
    expect(picker).not.toBeNull();
    expect(h.state.activeTool.locked).toBe(false);
    const before = h.state.currentItemBackgroundColor;

    // `q` maps to the hidden transparent swatch AND to the global tool-lock
    // shortcut — inside the modal it must be dead, not leaked
    fireEvent.keyDown(picker, { key: "q" });
    expect(h.state.activeTool.locked).toBe(false);
    expect(h.state.currentItemBackgroundColor).toBe(before);

    // the other hotkeys keep working on their usual keys (w = white)
    fireEvent.keyDown(picker, { key: "w" });
    expect(h.state.currentItemBackgroundColor).not.toBe(before);
    expect(h.state.currentItemBackgroundColor).not.toBe("transparent");
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

    expect(h.state.activeTool.type).not.toBe("bucketfill");
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

  it("a normal touch tap fills once, on release", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      button: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    // the fill is only armed while the finger is down — nothing committed yet
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(0);
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(1);
  });

  it("a second touch pointer aborts the fill (pinch/pan intent)", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      button: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    // a second finger lands while the first is still down
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 90,
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "touch",
    });

    // the user meant to pinch/pan, not to fill — no permanent edit
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(0);
  });

  it("pointercancel aborts the fill", () => {
    seedRectangle();
    act(() => {
      API.setAppState({ currentItemBackgroundColor: "#ffec99" });
    });
    selectBucketFill();

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      button: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    // the browser takes the pointer over (scroll, palm rejection) — no
    // pointerup will follow
    fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "touch",
    });

    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(0);

    // and the next tap fills normally
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      clientX: 80,
      clientY: 70,
      pointerId: 2,
      pointerType: "touch",
    });
    expect(
      h.elements.filter((el) => el.type === "line" && !el.isDeleted),
    ).toHaveLength(1);
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

import { arrayToMap } from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { shouldApplyFrameClip } from "../src/frame";

import type { ExcalidrawFrameLikeElement } from "../src/types";

const appState = {
  frameRendering: { enabled: true, clip: true, name: true, outline: true },
  selectedElementsAreBeingDragged: false,
} as any;

const createFrame = () =>
  API.createElement({
    type: "frame",
    x: 0,
    y: 0,
    width: 500,
    height: 500,
  }) as ExcalidrawFrameLikeElement;

describe("shouldApplyFrameClip", () => {
  it("clips a standalone text element that sits fully inside its frame", () => {
    // regression test for #11906 — text paints beyond its recorded bounds
    // (glyph overhang, font-metric mismatch, fixed-width overflow), so being
    // within the frame's bounds does not prove it renders within them.
    const frame = createFrame();
    const text = API.createElement({
      type: "text",
      x: 50,
      y: 50,
      width: 100,
      height: 25,
      frameId: frame.id,
    });

    expect(
      shouldApplyFrameClip(
        text,
        frame,
        appState,
        arrayToMap([frame, text]) as any,
      ),
    ).toBe(true);
  });

  it("clips an element whose border crosses the frame border", () => {
    const frame = createFrame();
    const text = API.createElement({
      type: "text",
      x: 450,
      y: 50,
      width: 200,
      height: 25,
      frameId: frame.id,
    });

    expect(
      shouldApplyFrameClip(
        text,
        frame,
        appState,
        arrayToMap([frame, text]) as any,
      ),
    ).toBe(true);
  });

  it("clips an element owned by a frame but lying entirely outside it", () => {
    // the border-intersection test alone never fires here, so such an element
    // used to render unclipped well outside its own frame.
    const frame = createFrame();
    const rect = API.createElement({
      type: "rectangle",
      x: 700,
      y: 700,
      width: 100,
      height: 25,
      frameId: frame.id,
    });

    expect(
      shouldApplyFrameClip(
        rect,
        frame,
        appState,
        arrayToMap([frame, rect]) as any,
      ),
    ).toBe(true);
  });

  it("does not clip a non-text element fully within the frame", () => {
    // keeps the existing fast path: a shape inside the frame cannot paint
    // outside it, so no clip region is needed.
    const frame = createFrame();
    const rect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      frameId: frame.id,
    });

    expect(
      shouldApplyFrameClip(
        rect,
        frame,
        appState,
        arrayToMap([frame, rect]) as any,
      ),
    ).toBe(false);
  });
});

import {
  DEFAULT_STICKY_NOTE_SIZE,
  FONT_FAMILY,
  MIN_FONT_SIZE,
  ROUNDNESS,
  STICKY_NOTE_FALLBACK_FONT_SIZE,
  STICKY_NOTE_MAX_FONT_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_BODY_INSET_Y,
  STICKY_NOTE_FOOTER,
  STICKY_NOTE_MIN_SIZE,
  STICKY_NOTE_PADDING,
  VERTICAL_ALIGN,
  arrayToMap,
} from "@excalidraw/common";
import {
  lineSegment,
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type Radians,
} from "@excalidraw/math";
import { vi } from "vitest";

import { Scene } from "../Scene";
import { intersectElementWithLineSegment } from "../collision";
import { newElementWith } from "../mutateElement";
import {
  newElement,
  newStickyNoteElement,
  newTextElement,
} from "../newElement";
import { resizeMultipleElements, resizeSingleElement } from "../resizeElements";
import {
  getStickyNoteLayout,
  getStickyNoteCornerRadius,
  getStickyNoteDateLabel,
  getStickyNoteFooter,
  getStickyNoteMinSize,
  syncStickyNoteInk,
  normalizeStickyNoteFontSize,
  updateStickyNoteLayout,
} from "../stickyNote";
import * as textMeasurements from "../textMeasurements";
import {
  computeBoundTextPosition,
  getBoundTextMaxHeight,
  redrawTextBoundingBox,
} from "../textElement";

import type {
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElementWithContainer,
  NonDeleted,
} from "../types";

const STICKY_FONT_SIZE = 28;

const getSticky = (scene: Scene, id: string) =>
  scene.getNonDeletedElement(id) as NonDeleted<ExcalidrawStickyNoteElement>;

const getBoundText = (scene: Scene, id: string) =>
  scene.getNonDeletedElement(
    id,
  ) as NonDeleted<ExcalidrawTextElementWithContainer>;

const createStickyWithText = (
  originalText: string,
  extraElements: ExcalidrawElement[] = [],
) => {
  const baseSticky = newStickyNoteElement({
    type: "stickynote",
    x: 100,
    y: 100,
    width: DEFAULT_STICKY_NOTE_SIZE,
    height: DEFAULT_STICKY_NOTE_SIZE,
    baseHeight: DEFAULT_STICKY_NOTE_SIZE,
  });
  const text = newTextElement({
    x: baseSticky.x + baseSticky.width / 2,
    y: baseSticky.y + baseSticky.height / 2,
    text: originalText,
    originalText,
    fontSize: STICKY_FONT_SIZE,
    baseFontSize: STICKY_FONT_SIZE,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    containerId: baseSticky.id,
    autoResize: true,
  });
  const sticky = newElementWith(baseSticky, {
    boundElements: [{ type: "text", id: text.id }],
  });
  const scene = new Scene([sticky, text, ...extraElements], {
    skipValidation: true,
  });
  const sceneSticky = getSticky(scene, sticky.id);
  const sceneText = getBoundText(scene, text.id);

  redrawTextBoundingBox(sceneText, sceneSticky, scene);

  return {
    scene,
    stickyId: sticky.id,
    textId: text.id,
  };
};

describe("sticky note text layout", () => {
  it("preserves rounded corners with reduced radius", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });

    expect(sticky.roundness).toEqual({ type: ROUNDNESS.PROPORTIONAL_RADIUS });
    expect(getStickyNoteCornerRadius(sticky)).toBeLessThan(
      DEFAULT_STICKY_NOTE_SIZE * 0.25,
    );
  });

  it("uses reduced rounded corners for binding intersections", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });
    const elementsMap = arrayToMap([sticky]);
    const intersection = intersectElementWithLineSegment(
      sticky,
      elementsMap,
      lineSegment<GlobalPoint>(
        pointFrom<GlobalPoint>(
          sticky.x + sticky.width / 2,
          sticky.y + sticky.height / 2,
        ),
        pointFrom<GlobalPoint>(sticky.x - 10, sticky.y - 10),
      ),
      0,
      true,
    )[0];

    expect(intersection[0]).toBeLessThan(getStickyNoteCornerRadius(sticky));
    expect(intersection[1]).toBeLessThan(getStickyNoteCornerRadius(sticky));
  });

  it("preserves roughness for render-only shape variation", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      roughness: 2,
    });

    expect(sticky.roughness).toBe(2);
  });

  it("respects user font size below the sticky note minimum font size", () => {
    const fontSize = STICKY_NOTE_MIN_FONT_SIZE - 1;
    const { scene, textId } = createStickyWithText("short");
    const text = getBoundText(scene, textId);

    scene.mutateElement(text, {
      fontSize,
      baseFontSize: fontSize,
    });

    const layout = getStickyNoteLayout(
      getSticky(scene, text.containerId),
      text,
    );

    expect(layout.text!.fontSize).toBe(fontSize);
  });

  it("normalizes non-finite and out-of-range font ceilings", () => {
    expect(normalizeStickyNoteFontSize(NaN)).toBe(
      STICKY_NOTE_FALLBACK_FONT_SIZE,
    );
    expect(normalizeStickyNoteFontSize(Infinity)).toBe(
      STICKY_NOTE_FALLBACK_FONT_SIZE,
    );
    expect(normalizeStickyNoteFontSize(-Infinity)).toBe(
      STICKY_NOTE_FALLBACK_FONT_SIZE,
    );
    expect(normalizeStickyNoteFontSize(1e20)).toBe(STICKY_NOTE_MAX_FONT_SIZE);
    expect(normalizeStickyNoteFontSize(0)).toBe(MIN_FONT_SIZE);
    expect(normalizeStickyNoteFontSize(24)).toBe(24);
  });

  it("terminates the font fit for pathological font ceilings", () => {
    const { scene, textId } = createStickyWithText("some text that must wrap");
    const text = getBoundText(scene, textId);

    // 1e20 - STICKY_NOTE_FONT_STEP === 1e20 in doubles: without the ceiling
    // clamp the descent loop would never progress
    for (const baseFontSize of [1e20, Infinity, NaN]) {
      scene.mutateElement(text, { baseFontSize });

      const layout = getStickyNoteLayout(
        getSticky(scene, text.containerId),
        text,
      );

      expect(Number.isFinite(layout.text!.fontSize)).toBe(true);
      expect(layout.text!.fontSize).toBeLessThanOrEqual(
        STICKY_NOTE_MAX_FONT_SIZE,
      );
      expect(Number.isFinite(layout.container.height)).toBe(true);
    }
  });

  it("downscales font to fit the base size before growing height", () => {
    const sevenBaseHeightLines = Array(7).fill("abcdefghij").join("\n");
    const { scene, stickyId, textId } =
      createStickyWithText(sevenBaseHeightLines);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);

    expect(sticky.width).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(sticky.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(sticky.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(text.x - sticky.x).toBeGreaterThanOrEqual(STICKY_NOTE_PADDING);
    expect(text.y - sticky.y).toBeGreaterThanOrEqual(STICKY_NOTE_PADDING);
    expect(text.fontSize).toBeLessThan(text.baseFontSize!);
    expect(text.fontSize).toBeGreaterThan(STICKY_NOTE_MIN_FONT_SIZE);
  });

  it("grows downward at min font and shrinks back to base when text is deleted", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);

    expect(text.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE);
    expect(sticky.height).toBeGreaterThan(sticky.baseHeight);
    expect(sticky.y).toBe(100);

    scene.mutateElement(text, {
      originalText: "short",
      text: "short",
    });
    redrawTextBoundingBox(text, sticky, scene);

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);

    expect(updatedSticky.height).toBe(updatedSticky.baseHeight);
    expect(updatedSticky.y).toBe(100);
    expect(updatedText.fontSize).toBe(updatedText.baseFontSize);
  });

  it("keeps the bottom edge anchored when a north resize is content-pinned", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalText = { ...text };
    const originalElementsMap = arrayToMap([originalSticky, originalText]);
    const originalBottom = sticky.y + sticky.height;

    // drag the "n" handle downward past the content minimum — the note
    // must rubber-band in place instead of translating down
    resizeSingleElement(
      sticky.width,
      sticky.height - 100,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "n",
    );

    const updatedSticky = getSticky(scene, stickyId);

    expect(updatedSticky.height).toBeCloseTo(originalSticky.height);
    expect(updatedSticky.y).toBeCloseTo(originalSticky.y);
    expect(updatedSticky.y + updatedSticky.height).toBeCloseTo(originalBottom);
    expect(updatedSticky.baseHeight).toBeCloseTo(originalSticky.height - 100);
  });

  it("keeps the requested height as the base when a corner drag is content-pinned", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalText = { ...text };
    const originalElementsMap = arrayToMap([originalSticky, originalText]);
    const nextWidth = 120;
    const nextHeight = DEFAULT_STICKY_NOTE_SIZE;
    const expectedLayout = getStickyNoteLayout(
      {
        ...sticky,
        width: nextWidth,
        height: nextHeight,
        baseHeight: nextHeight,
      },
      text,
    );

    resizeSingleElement(
      nextWidth,
      nextHeight,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "se",
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);

    expect(updatedSticky.width).toBe(nextWidth);
    // the note refuses to shrink below its content, but the user's intent is
    // remembered as the base: delete the text later and it snaps to 250
    expect(updatedSticky.baseHeight).toBe(nextHeight);
    expect(updatedSticky.height).toBeCloseTo(expectedLayout.container.height);
    expect(updatedSticky.height).toBeGreaterThan(nextHeight);
    // "se" holds the top-left corner
    expect(updatedSticky.y).toBeCloseTo(originalSticky.y);
    expect(updatedText.fontSize).toBe(originalText.fontSize);
    expect(updatedText.baseFontSize).toBe(originalText.baseFontSize);
  });

  it("scales the note, its base height and its font ceiling on a proportional resize", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalElementsMap = arrayToMap([originalSticky, { ...text }]);

    // Shift + east handle: both axes scale, and the label with them
    resizeSingleElement(
      500,
      500,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "e",
      { shouldMaintainAspectRatio: true },
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);

    expect(updatedSticky.width).toBe(500);
    expect(updatedSticky.height).toBe(500);
    expect(updatedSticky.baseHeight).toBe(500);
    expect(updatedText.baseFontSize).toBe(STICKY_FONT_SIZE * 2);
    expect(updatedText.fontSize).toBe(STICKY_FONT_SIZE * 2);
  });

  it("keeps the base height on a width-only drag of a content-grown note", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalElementsMap = arrayToMap([originalSticky, { ...text }]);

    expect(sticky.height).toBeGreaterThan(sticky.baseHeight);

    resizeSingleElement(
      400,
      sticky.height,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "e",
    );

    const updatedSticky = getSticky(scene, stickyId);

    expect(updatedSticky.width).toBe(400);
    expect(updatedSticky.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(updatedSticky.height).toBeGreaterThan(updatedSticky.baseHeight);
    expect(updatedSticky.y).toBe(100);
  });

  it("restores the gesture-start base height and ceiling when Shift is released mid-gesture", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalElementsMap = arrayToMap([originalSticky, { ...text }]);

    // first pointer-move with Shift: everything scales ×2
    resizeSingleElement(
      500,
      500,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "se",
      { shouldMaintainAspectRatio: true },
    );
    expect(getSticky(scene, stickyId).baseHeight).toBe(500);
    expect(getBoundText(scene, textId).baseFontSize).toBe(STICKY_FONT_SIZE * 2);

    // Shift released, same gesture: the ceiling goes back to the
    // gesture-start value instead of compounding from the live 56
    resizeSingleElement(
      400,
      300,
      getSticky(scene, stickyId),
      originalSticky,
      originalElementsMap,
      scene,
      "se",
    );
    expect(getSticky(scene, stickyId).width).toBe(400);
    expect(getSticky(scene, stickyId).baseHeight).toBe(300);
    expect(getBoundText(scene, textId).baseFontSize).toBe(STICKY_FONT_SIZE);
    expect(getBoundText(scene, textId).fontSize).toBe(STICKY_FONT_SIZE);

    // and a width-only move restores the gesture-start base height too
    resizeSingleElement(
      350,
      DEFAULT_STICKY_NOTE_SIZE,
      getSticky(scene, stickyId),
      originalSticky,
      originalElementsMap,
      scene,
      "e",
    );
    expect(getSticky(scene, stickyId).baseHeight).toBe(
      DEFAULT_STICKY_NOTE_SIZE,
    );
  });

  it("flips a rotated note without promoting its grown height or losing the label's angle", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    scene.mutateElement(sticky, { angle: 0.5 as Radians });
    scene.mutateElement(text, { angle: 0.5 as Radians });
    const grownHeight = sticky.height;
    expect(grownHeight).toBeGreaterThan(sticky.baseHeight);
    const originalElementsMap = arrayToMap([{ ...sticky }, { ...text }]);

    resizeMultipleElements(
      [sticky, text],
      scene.getNonDeletedElementsMap(),
      "nw",
      scene,
      originalElementsMap,
      {
        flipByX: true,
        shouldResizeFromCenter: true,
        shouldMaintainAspectRatio: true,
      },
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);

    expect(updatedSticky.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(updatedSticky.height).toBeCloseTo(grownHeight);
    expect(updatedText.baseFontSize).toBe(STICKY_FONT_SIZE);
    expect(updatedSticky.angle).not.toBeCloseTo(0.5);
    expect(updatedText.angle).toBeCloseTo(updatedSticky.angle);
  });

  it("syncs the base height of an empty note on a multi-select resize", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      baseHeight: DEFAULT_STICKY_NOTE_SIZE,
    });
    const rectangle = newElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
    });
    const scene = new Scene([sticky, rectangle], { skipValidation: true });
    const originalElementsMap = arrayToMap([{ ...sticky }, { ...rectangle }]);

    resizeMultipleElements(
      scene.getNonDeletedElements(),
      scene.getNonDeletedElementsMap(),
      "se",
      scene,
      originalElementsMap,
      { nextWidth: 800, nextHeight: 500 },
    );

    const updatedSticky = getSticky(scene, sticky.id);

    expect(updatedSticky.height).toBe(500);
    expect(updatedSticky.baseHeight).toBe(500);
  });

  it("keeps the center on an Alt (center) resize that is content-pinned", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalElementsMap = arrayToMap([originalSticky, { ...text }]);
    const centerY = sticky.y + sticky.height / 2;

    for (const handle of ["n", "s"] as const) {
      resizeSingleElement(
        sticky.width,
        originalSticky.height - 100,
        getSticky(scene, stickyId),
        originalSticky,
        originalElementsMap,
        scene,
        handle,
        { shouldResizeFromCenter: true },
      );
      const updated = getSticky(scene, stickyId);
      // content-pinned: the height springs back, but around the center
      expect(updated.height).toBeCloseTo(originalSticky.height);
      expect(updated.y + updated.height / 2).toBeCloseTo(centerY);
      expect(updated.baseHeight).toBeCloseTo(originalSticky.height - 100);
    }
  });

  it("scales the label's ceiling on a proportional multi-select resize", () => {
    const rectangle = newElement({
      type: "rectangle",
      x: 400,
      y: 100,
      width: 100,
      height: DEFAULT_STICKY_NOTE_SIZE,
    });
    const { scene, stickyId, textId } = createStickyWithText("short", [
      rectangle,
    ]);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );

    // selection bbox is 400×250; a labeled note forces aspect lock anyway
    resizeMultipleElements(
      scene.getNonDeletedElements(),
      scene.getNonDeletedElementsMap(),
      "se",
      scene,
      originalElementsMap,
      { nextWidth: 800, nextHeight: 500, shouldMaintainAspectRatio: true },
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);
    expect(updatedSticky.width).toBe(500);
    expect(updatedSticky.height).toBe(500);
    expect(updatedSticky.baseHeight).toBe(500);
    expect(updatedText.baseFontSize).toBe(STICKY_FONT_SIZE * 2);
    expect(updatedText.fontSize).toBe(STICKY_FONT_SIZE * 2);
  });

  it("uses the requested height as the base on a free multi-select resize of an empty note", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      baseHeight: DEFAULT_STICKY_NOTE_SIZE,
    });
    const rectangle = newElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 100,
      height: DEFAULT_STICKY_NOTE_SIZE,
    });
    const scene = new Scene([sticky, rectangle], { skipValidation: true });
    const originalElementsMap = arrayToMap([{ ...sticky }, { ...rectangle }]);

    // 2× wide, 1.5× tall — nothing in the selection forces aspect lock
    resizeMultipleElements(
      scene.getNonDeletedElements(),
      scene.getNonDeletedElementsMap(),
      "se",
      scene,
      originalElementsMap,
      { nextWidth: 800, nextHeight: 375 },
    );

    const updated = getSticky(scene, sticky.id);
    expect(updated.width).toBe(500);
    expect(updated.height).toBe(375);
    expect(updated.baseHeight).toBe(375);
  });

  it("restores everything when a proportional gesture returns to scale 1", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalElementsMap = arrayToMap([originalSticky, { ...text }]);

    resizeSingleElement(
      500,
      500,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "se",
      {
        shouldMaintainAspectRatio: true,
      },
    );
    resizeSingleElement(
      DEFAULT_STICKY_NOTE_SIZE,
      DEFAULT_STICKY_NOTE_SIZE,
      getSticky(scene, stickyId),
      originalSticky,
      originalElementsMap,
      scene,
      "se",
      { shouldMaintainAspectRatio: true },
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);
    expect(updatedSticky.width).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(updatedSticky.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(updatedText.baseFontSize).toBe(STICKY_FONT_SIZE);
    expect(updatedText.fontSize).toBe(STICKY_FONT_SIZE);
  });

  it("keeps the rotated top edge in place while the note grows", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    scene.mutateElement(sticky, { angle: 0.6 as Radians });
    scene.mutateElement(text, { angle: 0.6 as Radians });
    const topEdgeMidpoint = (element: ExcalidrawStickyNoteElement) =>
      pointRotateRads(
        pointFrom(element.x + element.width / 2, element.y),
        pointFrom(
          element.x + element.width / 2,
          element.y + element.height / 2,
        ),
        element.angle,
      );
    const before = topEdgeMidpoint(sticky);
    const heightBefore = sticky.height;

    updateStickyNoteLayout(sticky, scene, {
      originalText: Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n"),
    });

    const after = getSticky(scene, stickyId);
    expect(after.height).toBeGreaterThan(heightBefore);
    const [x, y] = topEdgeMidpoint(after);
    expect(x).toBeCloseTo(before[0]);
    expect(y).toBeCloseTo(before[1]);
  });

  it("fits in a handful of measurements: a warm keystroke in ≤ 2, a cold search in ≤ 12", () => {
    const { scene, stickyId, textId } = createStickyWithText("hello world");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const measure = vi.spyOn(textMeasurements, "measureText");

    measure.mockClear();
    getStickyNoteLayout(sticky, text, { originalText: "hello world!" });
    expect(measure.mock.calls.length).toBeLessThanOrEqual(2);

    // nothing fits at a 512 ceiling: the descent used to take ~250 passes
    measure.mockClear();
    getStickyNoteLayout(
      sticky,
      { ...text, fontSize: STICKY_NOTE_MAX_FONT_SIZE },
      {
        originalText: Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n"),
        baseFontSize: STICKY_NOTE_MAX_FONT_SIZE,
      },
    );
    expect(measure.mock.calls.length).toBeLessThanOrEqual(12);
    measure.mockRestore();
  });

  it("honors a lowered ceiling even when the old fitted size still fits", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    expect(text.fontSize).toBe(STICKY_FONT_SIZE);

    const layout = getStickyNoteLayout(sticky, text, { baseFontSize: 20 });

    expect(layout.text!.fontSize).toBe(20);
    expect(layout.text!.baseFontSize).toBe(20);
  });

  it("keeps odd and fractional ceilings reachable and stays on the ceiling-anchored grid", () => {
    const { scene, stickyId, textId } = createStickyWithText("short");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);

    expect(
      getStickyNoteLayout(sticky, text, { baseFontSize: 27 }).text!.fontSize,
    ).toBe(27);
    expect(
      getStickyNoteLayout(sticky, text, { baseFontSize: 27.5 }).text!.fontSize,
    ).toBe(27.5);

    const overflowing = Array(7).fill("abcdefghij").join("\n");
    const fitted = getStickyNoteLayout(sticky, text, {
      originalText: overflowing,
      baseFontSize: 27,
    }).text!.fontSize;
    expect(fitted).toBeLessThan(27);
    expect(
      fitted === STICKY_NOTE_MIN_FONT_SIZE || (27 - fitted) % 2 === 0,
    ).toBe(true);
  });

  it("sizes the minimum note to fit one line at the ceiling", () => {
    // a 25px line (20 × 1.25): the constant floor wins horizontally, the
    // footer pushes the height above it
    expect(
      getStickyNoteMinSize({
        fontSize: 20,
        fontFamily: FONT_FAMILY.Excalifont,
      }),
    ).toEqual({
      width: STICKY_NOTE_MIN_SIZE,
      height: 25 + STICKY_NOTE_BODY_INSET_Y,
    });
    // a 60px line (48 × 1.25)
    expect(
      getStickyNoteMinSize({
        fontSize: 48,
        fontFamily: FONT_FAMILY.Excalifont,
      }),
    ).toEqual({
      width: 60 + STICKY_NOTE_PADDING * 2,
      height: 60 + STICKY_NOTE_BODY_INSET_Y,
    });
  });

  it("never resizes a note below one line at its ceiling plus the footer", () => {
    const { scene, stickyId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );
    // 28 × 1.25 = 35px line: 75 wide (floor), 35 + the vertical inset high
    const minSize = getStickyNoteMinSize({
      fontSize: STICKY_FONT_SIZE,
      fontFamily: FONT_FAMILY.Excalifont,
    });
    expect(minSize).toEqual({
      width: STICKY_NOTE_MIN_SIZE,
      height: 35 + STICKY_NOTE_BODY_INSET_Y,
    });

    resizeSingleElement(
      40,
      40,
      sticky,
      { ...sticky },
      originalElementsMap,
      scene,
      "se",
    );

    const resized = getSticky(scene, stickyId);
    expect(resized.width).toBe(minSize.width);
    expect(resized.baseHeight).toBe(minSize.height);
    expect(resized.height).toBe(minSize.height);
    scene.destroy();
  });

  it("flips a proportional corner resize over the far side, like a rectangle", () => {
    // the SE corner dragged up past the top edge: the note mirrors over its
    // top side at the dragged size (clamping the axes one by one used to pin
    // the height at its minimum under a still-growing width)
    const { scene, stickyId, textId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );

    resizeSingleElement(
      400,
      -400,
      sticky,
      { ...sticky },
      originalElementsMap,
      scene,
      "se",
      { shouldMaintainAspectRatio: true },
    );

    const resized = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    expect(resized.width).toBe(400);
    expect(resized.height).toBe(400);
    expect(resized.x).toBe(100);
    // mirrored over the original top edge (y = 100)
    expect(resized.y).toBe(100 - 400);
    expect(text.baseFontSize).toBeCloseTo(STICKY_FONT_SIZE * (400 / 250));
    // the label is laid out inside the flipped note, upright
    expect(text.angle).toBe(0);
    expect(text.y).toBeGreaterThan(resized.y);
    expect(text.y + text.height).toBeLessThan(resized.y + resized.height);
    scene.destroy();
  });

  it("keeps a proportional shrink below the minimum proportional", () => {
    const { scene, stickyId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );

    resizeSingleElement(
      60,
      60,
      sticky,
      { ...sticky },
      originalElementsMap,
      scene,
      "se",
      { shouldMaintainAspectRatio: true },
    );

    const resized = getSticky(scene, stickyId);
    // one scale for both axes, so the square is kept through the clamp
    expect(resized.width).toBeCloseTo(resized.height);
    expect(resized.height).toBeGreaterThanOrEqual(
      35 + STICKY_NOTE_BODY_INSET_Y,
    );
    scene.destroy();
  });

  it("flips a free edge resize over the far side", () => {
    const { scene, stickyId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );

    // the east edge dragged left, 300px past the west edge
    resizeSingleElement(
      -300,
      sticky.height,
      sticky,
      { ...sticky },
      originalElementsMap,
      scene,
      "e",
    );

    const resized = getSticky(scene, stickyId);
    expect(resized.width).toBe(300);
    expect(resized.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(resized.x).toBe(100 - 300);
    scene.destroy();
  });

  it("applies the minimum to a flipped size's magnitude", () => {
    const { scene, stickyId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    const originalElementsMap = arrayToMap(
      scene.getNonDeletedElements().map((element) => ({ ...element })),
    );

    // just past the west edge: the mirrored note is the minimum wide
    resizeSingleElement(
      -10,
      sticky.height,
      sticky,
      { ...sticky },
      originalElementsMap,
      scene,
      "e",
    );

    const resized = getSticky(scene, stickyId);
    expect(resized.width).toBe(STICKY_NOTE_MIN_SIZE);
    expect(resized.x).toBe(100 - STICKY_NOTE_MIN_SIZE);
    scene.destroy();
  });

  it.each([0, Math.PI / 4, Math.PI / 2])(
    "centers a middle-aligned label in the whole note, footer ignored, at angle %s",
    (angle) => {
      const { scene, stickyId, textId } = createStickyWithText("Balanced");
      const sticky = getSticky(scene, stickyId);
      const text = getBoundText(scene, textId);
      scene.mutateElement(sticky, { angle: angle as Radians });
      redrawTextBoundingBox(text, sticky, scene);

      // the label's center is the note's center, not the center of the body
      // above the footer (which would sit half a footer higher)
      const [centerX, centerY] = pointRotateRads(
        pointFrom(text.x + text.width / 2, text.y + text.height / 2),
        pointFrom(sticky.x + sticky.width / 2, sticky.y + sticky.height / 2),
        -angle as Radians,
      );
      expect(centerX).toBeCloseTo(sticky.x + sticky.width / 2);
      expect(centerY).toBeCloseTo(sticky.y + sticky.height / 2);
      scene.destroy();
    },
  );

  it("pushes a middle-aligned label up only once centering would overlap the footer", () => {
    const { scene, stickyId, textId } = createStickyWithText("Tall");
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const elementsMap = scene.getNonDeletedElementsMap();
    const paddedHeight = sticky.height - STICKY_NOTE_PADDING * 2;
    const bodyBottom =
      sticky.y +
      sticky.height -
      STICKY_NOTE_PADDING -
      STICKY_NOTE_FOOTER.height;

    // fits centered with room to spare above the footer
    const short = { ...text, height: 100 };
    expect(computeBoundTextPosition(sticky, short, elementsMap).y).toBeCloseTo(
      sticky.y + STICKY_NOTE_PADDING + (paddedHeight - 100) / 2,
    );

    // centered it would run into the footer: it ends at the body's bottom
    const tall = { ...text, height: paddedHeight - STICKY_NOTE_FOOTER.height };
    expect(computeBoundTextPosition(sticky, tall, elementsMap).y).toBeCloseTo(
      bodyBottom - tall.height,
    );
    scene.destroy();
  });

  it.each([0, Math.PI / 4, Math.PI / 2])(
    "keeps bottom-aligned text above the date footer at angle %s",
    (angle) => {
      const { scene, stickyId, textId } = createStickyWithText("Last line");
      const sticky = getSticky(scene, stickyId);
      const text = getBoundText(scene, textId);
      scene.mutateElement(sticky, { angle: angle as Radians });
      scene.mutateElement(text, { verticalAlign: VERTICAL_ALIGN.BOTTOM });
      redrawTextBoundingBox(text, sticky, scene);

      // Bring the rendered label center back into the note's local frame.
      const [, centerY] = pointRotateRads(
        pointFrom(text.x + text.width / 2, text.y + text.height / 2),
        pointFrom(sticky.x + sticky.width / 2, sticky.y + sticky.height / 2),
        -angle as Radians,
      );
      expect(centerY + text.height / 2).toBeCloseTo(
        sticky.y +
          sticky.height -
          STICKY_NOTE_PADDING -
          STICKY_NOTE_FOOTER.height,
      );
      expect(sticky.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(sticky.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      scene.destroy();
    },
  );
});

describe("sticky note creation date", () => {
  // local noon, so the calendar day is the same in every time zone
  const NOW = new Date(2026, 8, 8, 12).getTime();
  const at = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12).getTime();

  it("formats an absolute date, short while the year is the current one", () => {
    expect(getStickyNoteDateLabel(at(2026, 8, 7), { now: NOW })).toBe("7 Sep");
    expect(getStickyNoteDateLabel(at(2025, 11, 31), { now: NOW })).toBe(
      "31 Dec 2025",
    );
    expect(
      getStickyNoteDateLabel(at(2025, 11, 31), { now: NOW, short: true }),
    ).toBe("31 Dec");
    // a creator's clock ahead of ours is still a date
    expect(getStickyNoteDateLabel(at(2027, 0, 1), { now: NOW })).toBe(
      "1 Jan 2027",
    );
  });

  it.each([null, NaN, Infinity, 8.64e15 + 1])(
    "hides an unknown or invalid timestamp: %s",
    (created) => {
      expect(getStickyNoteDateLabel(created, { now: NOW })).toBeNull();
    },
  );

  it("picks the footer form by width bucket, without measuring", () => {
    const created = at(2025, 4, 30);
    const footer = (width: number, height = DEFAULT_STICKY_NOTE_SIZE) =>
      getStickyNoteFooter({ created, width, height }, NOW);
    const yearWidth =
      STICKY_NOTE_PADDING * 2 + STICKY_NOTE_FOOTER.minBodyWidthForYear;

    expect(footer(DEFAULT_STICKY_NOTE_SIZE)).toEqual({
      text: "30 May 2025",
      x: DEFAULT_STICKY_NOTE_SIZE - STICKY_NOTE_PADDING,
      y: DEFAULT_STICKY_NOTE_SIZE - STICKY_NOTE_FOOTER.baselineFromBottom,
    });
    expect(footer(yearWidth)?.text).toBe("30 May 2025");
    expect(footer(yearWidth - 1)?.text).toBe("30 May");
    // the data floor always fits the short form
    expect(footer(STICKY_NOTE_MIN_SIZE, STICKY_NOTE_MIN_SIZE)?.text).toBe(
      "30 May",
    );
    // the 0×0 creation draft paints no footer, nor does an unknown date
    expect(footer(0, 0)).toBeNull();
    expect(
      getStickyNoteFooter({ created: null, width: 250, height: 250 }, NOW),
    ).toBeNull();
  });

  it("reserves the footer below the label body", () => {
    const { scene, stickyId, textId } = createStickyWithText("A");
    const sticky = getSticky(scene, stickyId);
    expect(getBoundTextMaxHeight(sticky, getBoundText(scene, textId))).toBe(
      sticky.height - STICKY_NOTE_BODY_INSET_Y,
    );
    scene.destroy();
  });
});

describe("sticky note ink", () => {
  const RED = "#e03131";
  const BLUE = "#1971c2";
  const pair = (containerInk: string, labelInk: string) => {
    const container = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      baseHeight: DEFAULT_STICKY_NOTE_SIZE,
      strokeColor: containerInk,
    });
    const label = newTextElement({
      x: 0,
      y: 0,
      text: "hi",
      originalText: "hi",
      containerId: container.id,
      strokeColor: labelInk,
    });
    return [
      newElementWith(container, {
        boundElements: [{ type: "text", id: label.id }],
      }),
      label,
    ] as const;
  };
  const inks = (elements: readonly ExcalidrawElement[]) =>
    elements.map((element) => element.strokeColor);

  it("is a no-op when the note and its label agree", () => {
    const elements = pair(RED, RED);
    expect(syncStickyNoteInk(elements, arrayToMap(elements))).toBe(elements);
  });

  it("follows whichever side changed", () => {
    const [container, label] = pair(RED, RED);
    const prev = arrayToMap([container, label]);
    // the note was recolored (selection): the label follows
    expect(
      inks(
        syncStickyNoteInk(
          [newElementWith(container, { strokeColor: BLUE }), label],
          prev,
        ),
      ),
    ).toEqual([BLUE, BLUE]);
    // the label was recolored (editing): the note follows
    expect(
      inks(
        syncStickyNoteInk(
          [container, newElementWith(label, { strokeColor: BLUE })],
          prev,
        ),
      ),
    ).toEqual([BLUE, BLUE]);
  });

  it("lets the label win when both changed or the data drifted", () => {
    expect(inks(syncStickyNoteInk(pair(RED, BLUE), new Map()))).toEqual([
      BLUE,
      BLUE,
    ]);
  });

  it("gives a transparent label the note's color", () => {
    expect(
      inks(syncStickyNoteInk(pair(RED, "transparent"), new Map())),
    ).toEqual([RED, RED]);
  });
});

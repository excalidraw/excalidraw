import {
  DEFAULT_STICKY_NOTE_SIZE,
  MIN_FONT_SIZE,
  ROUNDNESS,
  STICKY_NOTE_FALLBACK_FONT_SIZE,
  STICKY_NOTE_MAX_FONT_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_PADDING,
  VERTICAL_ALIGN,
  arrayToMap,
} from "@excalidraw/common";
import {
  lineSegment,
  pointFrom,
  type GlobalPoint,
  type Radians,
} from "@excalidraw/math";

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
  normalizeStickyNoteFontSize,
} from "../stickyNote";
import { redrawTextBoundingBox } from "../textElement";

import type {
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

const createStickyWithText = (originalText: string) => {
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
    fontSizeMax: STICKY_FONT_SIZE,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    containerId: baseSticky.id,
    autoResize: true,
  });
  const sticky = newElementWith(baseSticky, {
    boundElements: [{ type: "text", id: text.id }],
  });
  const scene = new Scene([sticky, text], { skipValidation: true });
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
      fontSizeMax: fontSize,
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
    for (const fontSizeMax of [1e20, Infinity, NaN]) {
      scene.mutateElement(text, { fontSizeMax });

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
    expect(text.fontSize).toBeLessThan(text.fontSizeMax!);
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
    expect(updatedText.fontSize).toBe(updatedText.fontSizeMax);
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
    expect(updatedText.fontSizeMax).toBe(originalText.fontSizeMax);
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
    expect(updatedText.fontSizeMax).toBe(STICKY_FONT_SIZE * 2);
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
    expect(getBoundText(scene, textId).fontSizeMax).toBe(STICKY_FONT_SIZE * 2);

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
    expect(getBoundText(scene, textId).fontSizeMax).toBe(STICKY_FONT_SIZE);
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
    expect(updatedText.fontSizeMax).toBe(STICKY_FONT_SIZE);
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
});

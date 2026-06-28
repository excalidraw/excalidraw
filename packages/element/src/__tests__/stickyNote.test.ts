import {
  DEFAULT_STICKY_NOTE_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_PADDING,
  VERTICAL_ALIGN,
  arrayToMap,
} from "@excalidraw/common";

import { Scene } from "../Scene";
import { newElementWith } from "../mutateElement";
import { newStickyNoteElement, newTextElement } from "../newElement";
import { resizeSingleElement } from "../resizeElements";
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
  scene.getNonDeletedElement(id) as NonDeleted<ExcalidrawTextElementWithContainer>;

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
  it("normalizes to square corners", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 0,
      y: 0,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      roundness: { type: 3 },
    });

    expect(sticky.roundness).toBe(null);
  });

  it("downscales font to fit the base size before growing height", () => {
    const sevenBaseHeightLines = Array(7)
      .fill("abcdefghij")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(
      sevenBaseHeightLines,
    );
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

  it("rejects corner resize when the proposed base height cannot contain the text", () => {
    const overflowingText = Array(40)
      .fill("abcdefghijklmnopqrstuvwx")
      .join("\n");
    const { scene, stickyId, textId } = createStickyWithText(overflowingText);
    const sticky = getSticky(scene, stickyId);
    const text = getBoundText(scene, textId);
    const originalSticky = { ...sticky };
    const originalText = { ...text };
    const originalElementsMap = arrayToMap([originalSticky, originalText]);

    resizeSingleElement(
      120,
      DEFAULT_STICKY_NOTE_SIZE,
      sticky,
      originalSticky,
      originalElementsMap,
      scene,
      "se",
    );

    const updatedSticky = getSticky(scene, stickyId);
    const updatedText = getBoundText(scene, textId);

    expect(updatedSticky.width).toBe(originalSticky.width);
    expect(updatedSticky.height).toBe(originalSticky.height);
    expect(updatedSticky.baseHeight).toBe(originalSticky.baseHeight);
    expect(updatedText.fontSize).toBe(originalText.fontSize);
  });
});

import { getFontString } from "@excalidraw/common";
import {
  Scene,
  convertToExcalidrawElements,
  isTextElementMarkedForRemeasure,
  measureText,
  newTextElement,
} from "@excalidraw/element";
import { vi } from "vitest";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Fonts } from "../fonts/Fonts";

const loadedFontFace = { family: "Excalifont" } as FontFace;

const convertText = (text: string) =>
  convertToExcalidrawElements([
    { type: "text", x: 0, y: 0, text },
  ])[0] as ExcalidrawTextElement;

// what the text would look like if it was measured with a fallback font
const withStaleDimensions = (element: ExcalidrawTextElement) => ({
  ...element,
  width: 1,
  height: 1,
});

const getMetrics = (element: ExcalidrawTextElement) =>
  measureText(element.text, getFontString(element), element.lineHeight);

describe("re-measuring converted text once fonts load", () => {
  beforeEach(() => {
    vi.spyOn(document.fonts, "check").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks text created by convertToExcalidrawElements", () => {
    const text = convertText("Hello world");
    expect(isTextElementMarkedForRemeasure(text.id)).toBe(true);
  });

  it("re-measures converted text when its font loads", () => {
    const text = convertText("Hello world");
    const scene = new Scene([withStaleDimensions(text)]);

    new Fonts(scene, document).onLoaded([loadedFontFace]);

    const updated = scene.getElement(text.id) as ExcalidrawTextElement;
    const metrics = getMetrics(updated);
    expect(updated.width).toBe(metrics.width);
    expect(updated.height).toBe(metrics.height);
    expect(isTextElementMarkedForRemeasure(text.id)).toBe(false);
  });

  it("doesn't change text that wasn't converted", () => {
    const text = newTextElement({ x: 0, y: 0, text: "Hello world" });
    const scene = new Scene([withStaleDimensions(text)]);

    new Fonts(scene, document).onLoaded([loadedFontFace]);

    const updated = scene.getElement(text.id) as ExcalidrawTextElement;
    expect(updated.width).toBe(1);
    expect(updated.height).toBe(1);
  });

  it("waits until the text's own font has loaded", () => {
    const text = convertText("Hello world");
    const scene = new Scene([withStaleDimensions(text)]);
    vi.spyOn(document.fonts, "check").mockReturnValue(false);

    new Fonts(scene, document).onLoaded([loadedFontFace]);

    const updated = scene.getElement(text.id) as ExcalidrawTextElement;
    expect(updated.width).toBe(1);
    expect(isTextElementMarkedForRemeasure(text.id)).toBe(true);
  });
});

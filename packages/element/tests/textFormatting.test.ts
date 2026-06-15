import { FONT_FAMILY } from "@excalidraw/common";

import {
  applyStyleToTextSelection,
  getResolvedTextStyleAt,
  getSelectionStyleAttributes,
} from "../src/textFormatting";

import type { ExcalidrawTextElement } from "../src/types";

const createTextElement = (
  overrides: Partial<ExcalidrawTextElement> = {},
): ExcalidrawTextElement =>
  ({
    id: "text-1",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    fontSize: 20,
    fontFamily: FONT_FAMILY.Excalifont,
    text: "hello world",
    originalText: "hello world",
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
    ...overrides,
  }) as ExcalidrawTextElement;

describe("textFormatting", () => {
  it("applies style only to the selected range", () => {
    const element = createTextElement();

    const updates = applyStyleToTextSelection(element, 0, 5, {
      strokeColor: "#ff0000",
    });

    expect(updates.textStyles).toEqual([
      { start: 0, end: 5, strokeColor: "#ff0000" },
    ]);
    expect(getResolvedTextStyleAt({ ...element, ...updates }, 0).strokeColor).toBe(
      "#ff0000",
    );
    expect(getResolvedTextStyleAt({ ...element, ...updates }, 6).strokeColor).toBe(
      "#000000",
    );
  });

  it("applies style to the whole element when the selection spans all text", () => {
    const element = createTextElement();

    const updates = applyStyleToTextSelection(element, 0, 11, {
      fontSize: 32,
    });

    expect(updates).toEqual({
      fontSize: 32,
      textStyles: undefined,
    });
  });

  it("returns the common style for a uniform selection", () => {
    const element = createTextElement({
      textStyles: [{ start: 0, end: 5, fontSize: 32 }],
    });

    expect(
      getSelectionStyleAttributes(element, 0, 5),
    ).toEqual({
      fontSize: 32,
    });
  });

  it("returns null when the selection has mixed styles", () => {
    const element = createTextElement({
      textStyles: [
        { start: 0, end: 5, fontSize: 32 },
        { start: 6, end: 11, fontSize: 40 },
      ],
    });

    expect(getSelectionStyleAttributes(element, 0, 11)).toBeNull();
  });
});

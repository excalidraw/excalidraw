import { Excalidraw } from "@excalidraw/excalidraw";
import { arrayToMap, FONT_SIZES } from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  render,
  unmountComponent,
  act,
} from "@excalidraw/excalidraw/tests/test-utils";

import {
  CODE_BLOCK_FONT_SIZE_STEPS,
  CODE_BLOCK_PADDING,
  getCodeBlockMeta,
} from "../src/codeBlock";
import { newCodeBlockElements } from "../src/newElement";
import { resizeMultipleElements } from "../src/resizeElements";

import type { TransformHandleDirection } from "../src/transformHandles";
import type { ExcalidrawElement, ExcalidrawTextElement } from "../src/types";

unmountComponent();

const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw />);
});

/** simulates dragging a single resize handle by setting the target group size directly */
const resizeViaHandle = (
  container: ExcalidrawElement,
  text: ExcalidrawElement,
  handle: TransformHandleDirection,
  nextWidth: number,
  nextHeight: number,
) => {
  const elementsMap = arrayToMap(h.elements);
  act(() => {
    resizeMultipleElements(
      [container, text],
      elementsMap,
      handle,
      h.scene,
      elementsMap,
      { nextWidth, nextHeight },
    );
  });
};

const getElements = (
  container: ExcalidrawElement,
  text: ExcalidrawElement,
) => ({
  newContainer: h.elements.find((el) => el.id === container.id)!,
  newText: h.elements.find((el) => el.id === text.id)! as ExcalidrawTextElement,
});

describe("code block resize via a single edge (e.g. dragging the side border)", () => {
  it("without wrap: scales the whole block proportionally", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      x: 0,
      y: 0,
    });
    API.setElements([container, text]);

    const origContainerWidth = container.width;
    const origContainerHeight = container.height;
    const origFontSize = text.fontSize;

    resizeViaHandle(
      container,
      text,
      "e",
      origContainerWidth / 2,
      origContainerHeight,
    );

    const { newContainer, newText } = getElements(container, text);

    const scale = newContainer.width / origContainerWidth;
    expect(scale).toBeCloseTo(0.5, 2);
    // aspect ratio preserved: height and font size scale by the same factor,
    // even though only the horizontal edge was dragged
    expect(newContainer.height / origContainerHeight).toBeCloseTo(scale, 2);
    expect(newText.fontSize / origFontSize).toBeCloseTo(scale, 2);
  });

  it("with wrap: keeps the font size fixed and reflows the text", () => {
    const { container, text } = newCodeBlockElements({
      code: "const longVariableName = someFunctionCall(argumentOne, argumentTwo);",
      language: "javascript",
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);

    const origFontSize = wrappedText.fontSize;
    const origContainerHeight = container.height;
    const targetWidth = container.width / 2;

    resizeViaHandle(container, wrappedText, "e", targetWidth, container.height);

    const { newContainer, newText } = getElements(container, text);

    expect(newContainer.width).toBeCloseTo(targetWidth, 0);
    expect(newText.fontSize).toBe(origFontSize);
    // narrower width forces the single long line to wrap onto multiple
    // lines, so the block must grow taller to fit without clipping
    expect(newContainer.height).toBeGreaterThan(origContainerHeight);
    expect(getCodeBlockMeta(newText)?.wrap).toBe(true);
  });
});

describe("code block resize via corner handle (the only handle exposed in the real UI for grouped selections)", () => {
  it("without wrap: dragging a corner scales the whole block proportionally", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      x: 0,
      y: 0,
    });
    API.setElements([container, text]);

    const origContainerWidth = container.width;
    const origContainerHeight = container.height;
    const origFontSize = text.fontSize;

    resizeViaHandle(
      container,
      text,
      "se",
      origContainerWidth * 1.5,
      origContainerHeight * 1.5,
    );

    const { newContainer, newText } = getElements(container, text);

    expect(newContainer.width).toBeGreaterThan(origContainerWidth);
    expect(newContainer.height).toBeGreaterThan(origContainerHeight);
    expect(newText.fontSize).toBeGreaterThan(origFontSize);
  });

  it("with wrap: dragging a corner past the content minimum tracks the cursor diagonally", () => {
    const { container, text } = newCodeBlockElements({
      code: "const longVariableName = someFunctionCall(argumentOne, argumentTwo);",
      language: "javascript",
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);

    const origFontSize = wrappedText.fontSize;
    const targetWidth = container.width / 2;
    // drag well past what the wrapped content actually needs vertically
    const targetHeight = container.height * 5;

    resizeViaHandle(container, wrappedText, "se", targetWidth, targetHeight);

    const { newContainer, newText } = getElements(container, text);

    expect(newContainer.width).toBeCloseTo(targetWidth, 0);
    // a generous vertical drag lets the font snap up to a bigger discrete
    // step too, instead of staying fixed
    expect(newText.fontSize).toBeGreaterThan(origFontSize);
    expect(CODE_BLOCK_FONT_SIZE_STEPS).toContain(newText.fontSize);
    // height tracks the cursor (the dragged target) since it's taller than
    // the content needs — giving the diagonal drag a real effect, with the
    // extra room appearing as blank space below the (top-anchored) text
    expect(newContainer.height).toBeCloseTo(targetHeight, 0);
    expect(newText.height).toBeLessThan(newContainer.height);
  });

  it("with wrap: dragging a corner below the content minimum clamps instead of clipping", () => {
    const { container, text } = newCodeBlockElements({
      code: "const longVariableName = someFunctionCall(argumentOne, argumentTwo);",
      language: "javascript",
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);

    const targetWidth = container.width / 2;
    // try to drag the corner to a height far smaller than the wrapped
    // content needs at that width
    const targetHeight = 1;

    resizeViaHandle(container, wrappedText, "se", targetWidth, targetHeight);

    const { newContainer, newText } = getElements(container, text);

    // height never goes below what's needed to fit the reflowed text plus padding
    expect(newContainer.height).toBeGreaterThanOrEqual(
      newText.height + CODE_BLOCK_PADDING * 2,
    );
    expect(newContainer.height).toBeGreaterThan(targetHeight);
  });

  it("with wrap: dragging a corner inward also shrinks the font in discrete steps", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      fontSize: FONT_SIZES.xl,
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);
    expect(wrappedText.fontSize).toBe(FONT_SIZES.xl);

    // shrink well below what the current XL font needs
    const targetHeight = container.height / 4;
    resizeViaHandle(
      container,
      wrappedText,
      "se",
      container.width,
      targetHeight,
    );

    const { newText } = getElements(container, text);
    expect(newText.fontSize).toBeLessThan(FONT_SIZES.xl);
    expect(CODE_BLOCK_FONT_SIZE_STEPS).toContain(newText.fontSize);
  });
});

describe("code block resize via a single vertical-only handle (n/s)", () => {
  it("with wrap: dragging past the content minimum adds blank space below the text", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);
    const origFontSize = wrappedText.fontSize;

    const origContainerHeight = container.height;
    const targetHeight = origContainerHeight * 3;

    resizeViaHandle(container, wrappedText, "s", container.width, targetHeight);

    const { newContainer, newText } = getElements(container, text);

    expect(newContainer.width).toBeCloseTo(container.width, 0);
    expect(newContainer.height).toBeCloseTo(targetHeight, 0);
    expect(newText.fontSize).toBeGreaterThan(origFontSize);
    expect(CODE_BLOCK_FONT_SIZE_STEPS).toContain(newText.fontSize);
    expect(newText.height).toBeLessThan(newContainer.height);
  });

  it("with wrap: dragging below the smallest font's minimum clamps instead of clipping", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);

    resizeViaHandle(container, wrappedText, "s", container.width, 1);

    const { newContainer, newText } = getElements(container, text);

    expect(newText.fontSize).toBe(FONT_SIZES.sm);
    expect(newContainer.height).toBeGreaterThanOrEqual(
      newText.height + CODE_BLOCK_PADDING * 2,
    );
  });

  it("with wrap: dragging inward shrinks the font in discrete steps", () => {
    const { container, text } = newCodeBlockElements({
      code: "const x = 1;",
      language: "javascript",
      fontSize: FONT_SIZES.xl,
      x: 0,
      y: 0,
    });
    const wrappedText = {
      ...text,
      customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
    };
    API.setElements([container, wrappedText]);
    expect(wrappedText.fontSize).toBe(FONT_SIZES.xl);

    const targetHeight = container.height / 4;
    resizeViaHandle(container, wrappedText, "s", container.width, targetHeight);

    const { newText } = getElements(container, text);
    expect(newText.fontSize).toBeLessThan(FONT_SIZES.xl);
    expect(CODE_BLOCK_FONT_SIZE_STEPS).toContain(newText.fontSize);
  });
});

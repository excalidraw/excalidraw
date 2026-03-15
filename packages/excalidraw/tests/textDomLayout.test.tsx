import React from "react";

import { getFontString, sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  measureText,
  wrapTextPreservingWhitespaceWithExplicitNewlineMarkers,
} from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, TEXT_EDITOR_SELECTOR } from "./queries/dom";
import { updateTextEditor } from "./queries/dom";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

const getTextEditorBasePosition = (editor: HTMLTextAreaElement) => {
  const left = parseFloat(editor.style.left);
  const top = parseFloat(editor.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    throw new Error("invalid text editor position");
  }
  return { x: left, y: top };
};

const getTextElementBasePosition = (element: { x: number; y: number }) => {
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    h.state,
  );
  return { x, y };
};

const getWrappedLinesAndLineStartIndices = ({
  value,
  font,
  maxWidth,
  shouldWrap,
}: {
  value: string;
  font: ReturnType<typeof getFontString>;
  maxWidth: number;
  shouldWrap: boolean;
}) => {
  const normalizedValue = value.replace(/\r\n?/g, "\n");

  const { lines, explicitNewlineAfterLine } = shouldWrap
    ? wrapTextPreservingWhitespaceWithExplicitNewlineMarkers(
        normalizedValue,
        font,
        maxWidth,
      )
    : {
        lines: normalizedValue.split("\n"),
        explicitNewlineAfterLine: normalizedValue
          .split("\n")
          .map((_line, idx, arr) => idx < arr.length - 1),
      };

  const lineStartIndices: number[] = [];
  let currentIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStartIndices.push(currentIndex);
    currentIndex += lines[i]?.length ?? 0;
    if (explicitNewlineAfterLine[i]) {
      currentIndex += 1;
    }
  }

  return { normalizedValue, lines, lineStartIndices };
};

const getCaretViewportPositions = ({
  element,
  value,
  base,
}: {
  element: ExcalidrawTextElement;
  value: string;
  base: { x: number; y: number };
}) => {
  const shouldWrap = !element.autoResize;
  const font = getFontString(element);
  const maxWidth = element.width;
  const lineHeightPx = element.fontSize * element.lineHeight;

  const { normalizedValue, lines, lineStartIndices } =
    getWrappedLinesAndLineStartIndices({
      value,
      font,
      maxWidth,
      shouldWrap,
    });

  const getLineIndexForCharIndex = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(normalizedValue.length, index));
    let lineIndex = 0;
    for (let i = 0; i < lineStartIndices.length; i++) {
      if (lineStartIndices[i] <= clampedIndex) {
        lineIndex = i;
      } else {
        break;
      }
    }
    return lineIndex;
  };

  const caretPositions: Array<{ x: number; y: number }> = [];
  for (let index = 0; index <= normalizedValue.length; index++) {
    const lineIndex = getLineIndexForCharIndex(index);
    const lineText = lines[lineIndex] ?? "";
    const lineStartIndex = lineStartIndices[lineIndex] ?? 0;
    const col = Math.max(0, Math.min(lineText.length, index - lineStartIndex));

    const lineWidth =
      lineText === ""
        ? 0
        : measureText(lineText, font, element.lineHeight).width;

    let lineOffsetX = 0;
    if (element.textAlign === "center") {
      lineOffsetX = (maxWidth - lineWidth) / 2;
    } else if (element.textAlign === "right") {
      lineOffsetX = maxWidth - lineWidth;
    }
    lineOffsetX = Math.max(0, lineOffsetX);

    const prefix = lineText.slice(0, col);
    const prefixWidth =
      prefix === "" ? 0 : measureText(prefix, font, element.lineHeight).width;

    const localX = lineOffsetX + prefixWidth;
    const localY = lineIndex * lineHeightPx;

    caretPositions.push({
      x: base.x + localX,
      y: base.y + localY,
    });
  }

  return caretPositions;
};

describe("text DOM layout (route B)", () => {
  const dimensions = { width: 800, height: 400 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    (h.app as any).refreshEditorInterface();
    API.setElements([]);
  });

  it("entering and exiting editor shouldn't change wrapped text dimensions", async () => {
    const text = API.createElement({
      type: "text",
      text: "Excalidraw\nEditor",
    });
    API.setElements([text]);

    const prevWidth = text.width;
    const prevHeight = text.height;

    UI.resize(text, "e", [-80, 0]);

    expect(text.width).not.toBe(prevWidth);
    expect(text.height).not.toBe(prevHeight);
    expect(text.autoResize).toBe(false);

    const wrappedWidth = text.width;
    const wrappedHeight = text.height;

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);

    const editor = await getTextEditor();
    expect(editor).not.toBe(null);
    expect(h.state.editingTextElement?.id).toBe(text.id);

    await waitFor(() => {
      expect(text.width).toBe(wrappedWidth);
      expect(text.height).toBe(wrappedHeight);
    });

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(text.width).toBe(wrappedWidth);
      expect(text.height).toBe(wrappedHeight);
    });
  });

  it("entering and exiting editor shouldn't change auto-resize text dimensions", async () => {
    const text = API.createElement({
      type: "text",
      text: "Excalidraw Editor",
    });
    API.setElements([text]);

    const prevWidth = text.width;
    const prevHeight = text.height;

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);

    const editor = await getTextEditor();
    expect(editor).not.toBe(null);
    expect(h.state.editingTextElement?.id).toBe(text.id);

    await waitFor(() => {
      expect(text.width).toBe(prevWidth);
      expect(text.height).toBe(prevHeight);
    });

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(text.width).toBe(prevWidth);
      expect(text.height).toBe(prevHeight);
    });
  });

  it("auto-resize text should not wrap in editor when it doesn't wrap on canvas", async () => {
    const longText = "Excalidraw Editor ".repeat(30).trim();
    const text = API.createElement({
      type: "text",
      text: longText,
      x: dimensions.width - 80,
      y: 60,
    });
    API.setElements([text]);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);

    const editor = await getTextEditor();
    expect(editor).not.toBe(null);
    expect(h.state.editingTextElement?.id).toBe(text.id);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(parseFloat(editor.style.width)).toBe(latest.width);
      expect(parseFloat(editor.style.height)).toBe(latest.height);
    });
    const editorLeft = parseFloat(editor.style.left);
    const viewportCap = dimensions.width - 8 - editorLeft;
    expect(parseFloat(editor.style.width)).toBeGreaterThan(viewportCap);
    expect(editor.wrap).toBe("off");

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    });
  });

  it("wrapped text should not clamp editor width and change wrapping", async () => {
    const value =
      "自动换行测试Automatic line break test1234567890\n\n自动换行测试Automatic line break test1234567890\n自动换行测试Automatic line break test1234567890";

    const text = API.createElement({
      type: "text",
      text: "x",
      x: dimensions.width - 80,
      y: 120,
      width: 500,
      height: 60,
    });
    API.setElements([text]);

    UI.clickTool("selection");
    UI.resize(text, "e", [-300, 0]);
    expect(text.autoResize).toBe(false);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);

    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(text.id);
    updateTextEditor(editor, value);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(parseFloat(editor.style.width)).toBe(latest.width);
    });
    const editorLeft = parseFloat(editor.style.left);
    const viewportCap = dimensions.width - 8 - editorLeft;
    expect(parseFloat(editor.style.width)).toBeGreaterThan(viewportCap);
    expect(editor.wrap).toBe("soft");

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    });
  });

  it("editing text shouldn't change interactive canvas selection box bitmap", async () => {
    const text = API.createElement({
      type: "text",
      text: "Excalidraw Editor is great",
      x: 100,
      y: 60,
    });
    API.setElements([text]);

    UI.resize(text, "e", [-120, 0]);
    expect(text.autoResize).toBe(false);

    UI.clickTool("selection");
    mouse.clickAt(text.x + text.width / 2, text.y + text.height / 2);

    await waitFor(() => {
      expect(h.state.selectedElementIds[text.id]).toBeTruthy();
    });

    const canvas =
      document.querySelector<HTMLCanvasElement>("canvas.interactive")!;
    const context = canvas.getContext("2d")!;
    const before = new Uint8ClampedArray(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
    );

    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    expect(editor).not.toBe(null);

    await waitFor(() => {
      expect(h.state.editingTextElement?.id).toBe(text.id);
    });

    const after = new Uint8ClampedArray(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
    );

    expect(after).toEqual(before);

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    });
  });

  it("double-clicking at most positions shouldn't change editor overlay geometry", async () => {
    const text = API.createElement({
      type: "text",
      text: "Excalidraw Editor is great",
      x: 100,
      y: 60,
    });
    API.setElements([text]);

    UI.resize(text, "e", [-120, 0]);
    expect(text.autoResize).toBe(false);

    const baselineElement = {
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
    };

    const points = [
      [0.1, 0.1],
      [0.5, 0.1],
      [0.9, 0.1],
      [0.1, 0.5],
      [0.5, 0.5],
      [0.9, 0.5],
      [0.1, 0.9],
      [0.5, 0.9],
      [0.9, 0.9],
    ] as const;

    let baselineStyle:
      | {
          width: string;
          height: string;
          left: string;
          top: string;
          transform: string;
          font: string;
          lineHeight: string;
          textAlign: string;
          verticalAlign: string;
        }
      | undefined;

    UI.clickTool("selection");

    for (const [fx, fy] of points) {
      mouse.doubleClickAt(
        baselineElement.x + baselineElement.width * fx,
        baselineElement.y + baselineElement.height * fy,
      );

      const editor = await getTextEditor();
      expect(h.state.editingTextElement?.id).toBe(text.id);

      const currentStyle = {
        width: editor.style.width,
        height: editor.style.height,
        left: editor.style.left,
        top: editor.style.top,
        transform: editor.style.transform,
        font: editor.style.font,
        lineHeight: editor.style.lineHeight,
        textAlign: editor.style.textAlign,
        verticalAlign: editor.style.verticalAlign,
      };

      if (!baselineStyle) {
        baselineStyle = currentStyle;
      } else {
        expect(currentStyle).toEqual(baselineStyle);
      }

      expect(text.x).toBe(baselineElement.x);
      expect(text.y).toBe(baselineElement.y);
      expect(text.width).toBe(baselineElement.width);
      expect(text.height).toBe(baselineElement.height);

      Keyboard.exitTextEditor(editor);

      await waitFor(() => {
        expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
      });
    }
  });

  it("resizing text width via drag shouldn't hide text", async () => {
    const longText =
      "Excalidraw is a virtual opensource whiteboard for sketching hand-drawn like diagrams";

    const text = API.createElement({
      type: "text",
      text: longText,
      x: 100,
      y: 80,
      width: 500,
      height: 60,
    });
    API.setElements([text]);

    const baselineElement = {
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
    };

    expect(baselineElement.width).toBeGreaterThan(0);
    expect(baselineElement.height).toBeGreaterThan(0);

    UI.clickTool("selection");
    UI.resize(text, "e", [-200, 0]);

    expect(text.width).toBeGreaterThan(0);
    expect(text.height).toBeGreaterThan(0);
    expect(text.width).toBeLessThan(baselineElement.width);

    expect(text.height).toBeGreaterThan(baselineElement.height);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);

    const editor = await getTextEditor();
    expect(editor.value).toBe(longText);
    expect(parseFloat(editor.style.width)).toBeGreaterThan(0);
    expect(parseFloat(editor.style.height)).toBeGreaterThan(0);

    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    });
  });

  it("clicking to edit the text box will not change the character absolute position", async () => {
    const value =
      "随机文本 Random text 你好，world!  1234\n第二行  spaces  + symbols: ~!@#$%^&*()_+\n\n第三行 end.";

    const text = API.createElement({
      type: "text",
      text: "x",
      x: 120,
      y: 80,
      width: 320,
      height: 80,
      textAlign: "left",
      verticalAlign: "top",
    });
    API.setElements([text]);

    UI.clickTool("selection");
    UI.resize(text, "e", [-80, 0]);
    expect(text.autoResize).toBe(false);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(text.id);
    updateTextEditor(editor, value);
    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(latest.originalText).toBe(value);
    });

    const latest = API.getElement(text);
    const nonEditPositions = getCaretViewportPositions({
      element: latest,
      value: latest.originalText,
      base: getTextElementBasePosition(latest),
    });

    UI.clickTool("selection");
    mouse.doubleClickAt(
      latest.x + latest.width / 2,
      latest.y + latest.height / 2,
    );
    const editor2 = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(text.id);
    expect(editor2.value.replace(/\r\n?/g, "\n")).toBe(
      latest.originalText.replace(/\r\n?/g, "\n"),
    );

    const editPositions = getCaretViewportPositions({
      element: latest,
      value: editor2.value,
      base: getTextEditorBasePosition(editor2),
    });

    expect(editPositions).toEqual(nonEditPositions);

    Keyboard.exitTextEditor(editor2);

    await waitFor(() => {
      expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    });
  });

  it("resizing text narrower and clicking to edit shouldn't change character absolute position", async () => {
    const value =
      "随机文本 Random text 你好，world!  1234\n第二行  spaces  + symbols: ~!@#$%^&*()_+\n\n第三行 end.";

    const text = API.createElement({
      type: "text",
      text: "x",
      x: 120,
      y: 80,
      width: 360,
      height: 80,
      textAlign: "left",
      verticalAlign: "top",
    });
    API.setElements([text]);

    UI.clickTool("selection");
    UI.resize(text, "e", [-80, 0]);
    expect(text.autoResize).toBe(false);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(text.id);
    updateTextEditor(editor, value);
    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(latest.originalText).toBe(value);
    });

    for (const deltaX of [-40, -40, -40]) {
      UI.clickTool("selection");
      UI.resize(API.getElement(text), "e", [deltaX, 0]);

      const latest = API.getElement(text);
      expect(latest.autoResize).toBe(false);

      const nonEditPositions = getCaretViewportPositions({
        element: latest,
        value: latest.originalText,
        base: getTextElementBasePosition(latest),
      });

      UI.clickTool("selection");
      mouse.doubleClickAt(
        latest.x + latest.width / 2,
        latest.y + latest.height / 2,
      );
      const editor2 = await getTextEditor();
      expect(h.state.editingTextElement?.id).toBe(text.id);

      const editPositions = getCaretViewportPositions({
        element: latest,
        value: editor2.value,
        base: getTextEditorBasePosition(editor2),
      });

      expect(editPositions).toEqual(nonEditPositions);

      Keyboard.exitTextEditor(editor2);

      await waitFor(() => {
        expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
      });
    }
  });
});

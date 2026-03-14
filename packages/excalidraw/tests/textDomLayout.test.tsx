import React from "react";

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
});

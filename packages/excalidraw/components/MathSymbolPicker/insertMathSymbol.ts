import { isTextElement } from "@excalidraw/element";

import type { AppClassProperties } from "../../types";

export const insertMathSymbol = (
  symbol: string,
  app: AppClassProperties,
) => {
  const ownerDoc = app.ownerDocument;
  const textEditor = ownerDoc.querySelector(
    ".excalidraw-wysiwyg",
  ) as HTMLTextAreaElement | null;

  if (textEditor) {
    textEditor.focus();
    const prevVal = textEditor.value;
    const executed = ownerDoc.execCommand?.("insertText", false, symbol);
    if (!executed || textEditor.value === prevVal) {
      const start = textEditor.selectionStart ?? textEditor.value.length;
      const end = textEditor.selectionEnd ?? textEditor.value.length;
      const val = textEditor.value;
      textEditor.value = val.slice(0, start) + symbol + val.slice(end);
      const newPos = start + symbol.length;
      textEditor.selectionStart = newPos;
      textEditor.selectionEnd = newPos;
      textEditor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return;
  }

  // If a text element is currently selected, start editing and insert
  const selectedElements = app.scene.getSelectedElements(app.state);
  const textElement = selectedElements.find(isTextElement);
  if (textElement) {
    app.startTextEditing({
      sceneX: textElement.x + textElement.width,
      sceneY: textElement.y,
    });
    const ownerWin = app.ownerWindow;
    ownerWin.setTimeout(() => {
      const editor = ownerDoc.querySelector(
        ".excalidraw-wysiwyg",
      ) as HTMLTextAreaElement | null;
      if (editor) {
        editor.focus();
        const len = editor.value.length;
        editor.selectionStart = len;
        editor.selectionEnd = len;
        const exec = ownerDoc.execCommand?.("insertText", false, symbol);
        if (!exec || editor.value.length === len) {
          editor.value = editor.value + symbol;
          const newLen = editor.value.length;
          editor.selectionStart = newLen;
          editor.selectionEnd = newLen;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }, 0);
    return;
  }

  // Otherwise start editing text at viewport center
  const { scrollX, scrollY, width, height, zoom } = app.state;
  const centerX = -scrollX + width / (2 * zoom.value);
  const centerY = -scrollY + height / (2 * zoom.value);
  app.startTextEditing({
    sceneX: centerX,
    sceneY: centerY,
  });
  const ownerWin = app.ownerWindow;
  ownerWin.setTimeout(() => {
    const editor = ownerDoc.querySelector(
      ".excalidraw-wysiwyg",
    ) as HTMLTextAreaElement | null;
    if (editor) {
      editor.focus();
      editor.value = symbol;
      editor.selectionStart = symbol.length;
      editor.selectionEnd = symbol.length;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, 0);
};

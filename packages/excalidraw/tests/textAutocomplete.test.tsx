import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { fireEvent, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const AUTOCOMPLETE_SELECTOR = ".excalidraw-textAutocomplete";
const ITEM_SELECTOR = ".excalidraw-textAutocomplete__item";

const getPopup = () =>
  document.querySelector<HTMLElement>(AUTOCOMPLETE_SELECTOR);

const isPopupVisible = () => {
  const popup = getPopup();
  return (
    !!popup &&
    popup.style.display !== "none" &&
    popup.querySelectorAll(ITEM_SELECTOR).length > 0
  );
};

const getSuggestions = () =>
  Array.from(document.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).map(
    (item) => item.textContent?.replace(/Tab$/, "") ?? "",
  );

/** type a word into the editor with the caret left at the end */
const typeInEditor = (editor: HTMLTextAreaElement, value: string) => {
  fireEvent.change(editor, { target: { value } });
  editor.selectionStart = editor.selectionEnd = value.length;
  fireEvent.input(editor);
};

const createTextEditorWithVocabulary = async (texts: string[]) => {
  const { getByToolName, container } = await render(<Excalidraw />);

  API.setElements(
    texts.map((text, index) =>
      API.createElement({
        type: "text",
        text,
        x: 10,
        y: 10 + index * 40,
      }),
    ),
  );

  // start a fresh text element elsewhere on the canvas
  fireEvent.click(getByToolName("text"));
  const canvas = container.querySelector("canvas.interactive")!;
  fireEvent.pointerDown(canvas, { clientX: 400, clientY: 400 });
  fireEvent.pointerUp(canvas, { clientX: 400, clientY: 400 });

  return getTextEditor();
};

describe("text autocomplete", () => {
  it("suggests words from the canvas as you type", async () => {
    const editor = await createTextEditorWithVocabulary(["Database", "Server"]);

    typeInEditor(editor, "Dat");

    expect(isPopupVisible()).toBe(true);
    expect(getSuggestions()).toEqual(["Database"]);
  });

  it("completes the word with Tab", async () => {
    const editor = await createTextEditorWithVocabulary(["Deployment"]);

    typeInEditor(editor, "Dep");
    expect(isPopupVisible()).toBe(true);

    fireEvent.keyDown(editor, { key: KEYS.TAB });

    expect(editor.value).toBe("Deployment");
    expect(isPopupVisible()).toBe(false);
  });

  it("ranks more frequent words first", async () => {
    const editor = await createTextEditorWithVocabulary([
      "Service Service Service",
      "Serverless",
    ]);

    typeInEditor(editor, "Ser");

    expect(getSuggestions()).toEqual(["Service", "Serverless"]);
  });

  it("does not suggest below the minimum prefix length", async () => {
    const editor = await createTextEditorWithVocabulary(["Database"]);

    typeInEditor(editor, "D");

    expect(isPopupVisible()).toBe(false);
  });

  it("does not suggest a word that is already fully typed", async () => {
    const editor = await createTextEditorWithVocabulary(["Server"]);

    typeInEditor(editor, "Server");

    expect(isPopupVisible()).toBe(false);
  });

  it("dismisses on Escape without closing the editor", async () => {
    const editor = await createTextEditorWithVocabulary(["Database"]);

    typeInEditor(editor, "Dat");
    expect(isPopupVisible()).toBe(true);

    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });

    expect(isPopupVisible()).toBe(false);
    // the editor is still open (a single Escape only dismissed the popup)
    expect(await getTextEditor()).not.toBe(null);
    expect(h.state.editingTextElement).not.toBe(null);
  });

  it("accepts a suggestion on click", async () => {
    const editor = await createTextEditorWithVocabulary([
      "Deployment",
      "Design",
    ]);

    typeInEditor(editor, "De");
    const items = document.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    expect(items.length).toBe(2);

    const clicked = items[1].textContent?.replace(/Tab$/, "");
    fireEvent.click(items[1]);

    expect(editor.value).toBe(clicked);
    expect(isPopupVisible()).toBe(false);
  });

  it("also suggests while editing a shape's label (bound text)", async () => {
    await render(<Excalidraw />);
    API.setElements([
      API.createElement({ type: "text", text: "Database", x: 10, y: 10 }),
      API.createElement({
        type: "rectangle",
        x: 300,
        y: 300,
        width: 200,
        height: 100,
      }),
    ]);

    // double-click the rectangle's center to edit its (bound) label
    mouse.doubleClickAt(400, 350);
    const editor = await getTextEditor();

    typeInEditor(editor, "Dat");

    expect(isPopupVisible()).toBe(true);
    expect(getSuggestions()).toEqual(["Database"]);
  });
});

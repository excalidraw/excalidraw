import React from "react";
import { queryByTestId } from "@testing-library/react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import {
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  toggleMenu,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

describe("text max width setting", () => {
  const dimensions = { width: 800, height: 400 };
  let container: HTMLElement;

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    localStorage.clear();
    ({ container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    ));
    (h.app as any).refreshEditorInterface();
    API.setElements([]);
  });

  it("defaults to 300 and wraps long single-line input", async () => {
    toggleMenu(container);
    const input = queryByTestId(
      container,
      "text-max-width-input",
    ) as HTMLInputElement;
    expect(input.value).toBe("300");

    toggleMenu(container);

    const text = API.createElement({ type: "text", text: "x", x: 100, y: 80 });
    API.setElements([text]);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    updateTextEditor(editor, "A".repeat(40));
    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(latest.autoResize).toBe(false);
      expect(latest.width).toBe(300);
      expect(latest.height).toBeGreaterThan(25);
    });

    UI.resize(API.getElement(text), "e", [200, 0]);
    expect(API.getElement(text).width).toBeGreaterThan(300);
  });

  it("changing max width affects wrapping behavior", async () => {
    toggleMenu(container);
    const input = queryByTestId(
      container,
      "text-max-width-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "600" } });
    expect(localStorage.getItem("excalidraw.textMaxWidth")).toBe("600");
    toggleMenu(container);

    const text = API.createElement({ type: "text", text: "x", x: 120, y: 80 });
    API.setElements([text]);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    updateTextEditor(editor, "A".repeat(40));
    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(latest.autoResize).toBe(true);
      expect(latest.width).toBeGreaterThan(300);
      expect(latest.height).toBe(25);
    });
  });

  it("wraps pasted multi-line content when any line exceeds max width", async () => {
    const value =
      "自动换行测试Automatic line break test1234567890\n\n自动换行测试Automatic line break test1234567890\n自动换行测试Automatic line break test1234567890";

    const text = API.createElement({ type: "text", text: "x", x: 140, y: 120 });
    API.setElements([text]);

    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
    const editor = await getTextEditor();
    updateTextEditor(editor, value);
    Keyboard.exitTextEditor(editor);

    await waitFor(() => {
      const latest = API.getElement(text);
      expect(latest.autoResize).toBe(false);
      expect(latest.width).toBe(300);
      expect(latest.height).toBeGreaterThan(0);
    });
  });
});

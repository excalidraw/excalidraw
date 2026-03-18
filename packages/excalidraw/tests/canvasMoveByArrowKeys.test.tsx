import React from "react";
import { vi } from "vitest";
import { act, fireEvent } from "@testing-library/react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

const { h } = window;

describe("canvas move by arrow keys", () => {
  beforeEach(() => {
    unmountComponent();
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    vi.useRealTimers();
  });

  it("moves canvas by one grid on arrow keys when nothing selected", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const { scrollX, scrollY, gridSize } = h.state;

    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(h.state.scrollX).toBe(scrollX + gridSize);
    expect(h.state.scrollY).toBe(scrollY);
  });

  it("repeats canvas move every 200ms while holding arrow key", async () => {
    vi.useFakeTimers();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    act(() => {
      h.app.setState({ scrollX: 0, scrollY: 0 });
    });

    const step = h.state.gridSize;

    Keyboard.keyDown(KEYS.ARROW_RIGHT);
    expect(h.state.scrollX).toBe(-step);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(h.state.scrollX).toBe(-step);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(h.state.scrollX).toBe(-step * 2);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(h.state.scrollX).toBe(-step * 3);

    Keyboard.keyUp(KEYS.ARROW_RIGHT);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(h.state.scrollX).toBe(-step * 3);
  });

  it("moves canvas by Ctrl+arrow keys while editing text", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const text = API.createElement({
      type: "text",
      text: "hello",
      x: 60,
      y: 60,
      width: 100,
      height: 30,
    });

    API.setElements([text]);
    UI.clickTool("selection");

    const mouse = new Pointer("mouse");
    mouse.doubleClickAt(text.x + 10, text.y + 10);

    const editor = await getTextEditor();
    editor.focus();

    act(() => {
      h.app.setState({ scrollX: 0, scrollY: 0 });
    });

    const step = h.state.gridSize;

    fireEvent.keyDown(editor, { key: KEYS.ARROW_UP, ctrlKey: true });
    fireEvent.keyUp(editor, { key: KEYS.ARROW_UP, ctrlKey: true });

    expect(h.state.scrollY).toBe(step);
    expect(h.elements[0].x).toBe(text.x);
    expect(h.elements[0].y).toBe(text.y);
  });
});

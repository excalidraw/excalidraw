import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { render, waitFor } from "./test-utils";

const { h } = window;

describe("Technical Drawing Mode", () => {
  it("should be disabled by default", async () => {
    await render(<Excalidraw />);
    expect(h.state.technicalDrawingMode).toBe(false);
  });

  it("should toggle with Alt+Shift+T shortcut", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    expect(h.state.technicalDrawingMode).toBe(false);

    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.codePress(CODES.T);
    });

    await waitFor(() => {
      expect(h.state.technicalDrawingMode).toBe(true);
    });

    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.codePress(CODES.T);
    });

    await waitFor(() => {
      expect(h.state.technicalDrawingMode).toBe(false);
    });
  });

  it("should respect initial appState", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: { technicalDrawingMode: true },
        }}
      />,
    );
    expect(h.state.technicalDrawingMode).toBe(true);
  });
});

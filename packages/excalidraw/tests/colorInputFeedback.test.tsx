import React from "react";

import { Excalidraw } from "../index";
import { Pointer, UI } from "../tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  togglePopover,
} from "../tests/test-utils";

const mouse = new Pointer("mouse");

describe("ColorInput invalid color feedback", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  const drawRectAndOpenStrokePopover = () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);
    togglePopover("Stroke");
  };

  const getHexInput = () =>
    document.querySelector<HTMLInputElement>(".color-picker-input")!;

  it("shows an error message and marks the input invalid for a bad hex color", () => {
    drawRectAndOpenStrokePopover();

    const input = getHexInput();
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("false");

    fireEvent.change(input, { target: { value: "zzzzzz" } });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Invalid color/i)).toBeTruthy();
  });

  it("treats an incomplete hex (#12345) as invalid", () => {
    drawRectAndOpenStrokePopover();

    const input = getHexInput();
    fireEvent.change(input, { target: { value: "12345" } });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("clears the error once a valid color is typed", () => {
    drawRectAndOpenStrokePopover();

    const input = getHexInput();
    fireEvent.change(input, { target: { value: "zzzzzz" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(input, { target: { value: "ff0000" } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText(/Invalid color/i)).toBeNull();
  });
});

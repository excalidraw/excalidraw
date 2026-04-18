import React from "react";

import { Excalidraw } from "../index";
import { t } from "../i18n";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  togglePopover,
} from "../tests/test-utils";

const mouse = new Pointer("mouse");

describe("color picker", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("should keep invalid hex input visible without changing the selected color", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    const originalStrokeColor = API.getSelectedElement().strokeColor;

    togglePopover("Stroke");

    const input = screen.getByRole("textbox", { name: t("labels.stroke") });

    fireEvent.change(input, {
      target: { value: "gggggg" },
    });

    expect(input).toHaveValue("gggggg");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.closest(".color-picker__input-label")).toHaveClass(
      "color-picker__input-label--invalid",
    );
    expect(API.getSelectedElement().strokeColor).toBe(originalStrokeColor);

    fireEvent.blur(input);

    expect(input).toHaveValue("gggggg");
    expect(API.getSelectedElement().strokeColor).toBe(originalStrokeColor);

    fireEvent.change(input, {
      target: { value: "fa5252" },
    });

    expect(input).toHaveValue("fa5252");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(API.getSelectedElement().strokeColor).toBe("#fa5252");
  });
});

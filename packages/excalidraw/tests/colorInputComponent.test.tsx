import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ColorInput } from "../components/ColorPicker/ColorInput";
import { EditorJotaiProvider } from "../editor-jotai";

describe("ColorInput", () => {
  afterEach(() => {
    cleanup();
  });

  const renderColorInput = (onChange = vi.fn()) => {
    render(
      <EditorJotaiProvider>
        <ColorInput
          color="#000000"
          label="Stroke color"
          onChange={onChange}
          colorPickerType="elementStroke"
        />
      </EditorJotaiProvider>,
    );

    return {
      input: screen.getByLabelText("Stroke color"),
      onChange,
    };
  };

  it("shows an error message for invalid color input", () => {
    const { input, onChange } = renderColorInput();

    fireEvent.change(input, { target: { value: "gggggg" } });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      screen.getByRole("alert").id,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Only hexadecimal characters are allowed.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error message for invalid hex length", () => {
    const { input, onChange } = renderColorInput();

    fireEvent.change(input, { target: { value: "fffff" } });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe(
      "Hex code must be 3, 4, 6, or 8 characters.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error message for named colors", () => {
    const { input, onChange } = renderColorInput();

    fireEvent.change(input, { target: { value: "blue" } });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe(
      "Only hexadecimal characters are allowed.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the error message when input becomes valid", () => {
    const { input, onChange } = renderColorInput();

    fireEvent.change(input, { target: { value: "gggggg" } });
    fireEvent.change(input, { target: { value: "ff0000" } });

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });
});

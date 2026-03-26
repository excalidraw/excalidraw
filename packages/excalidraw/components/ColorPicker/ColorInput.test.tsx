import { fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";

import { EditorJotaiProvider } from "../../editor-jotai";

import { ColorInput } from "./ColorInput";

describe("<ColorInput />", () => {
  it("shows validation feedback for invalid input and clears it once corrected", () => {
    const onChange = vi.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <EditorJotaiProvider>
        <ColorInput
          color="#1a1a1a"
          label="Stroke color"
          onChange={onChange}
          colorPickerType="elementStroke"
        />
      </EditorJotaiProvider>,
    );

    const input = getByLabelText("Stroke color") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "gggggg" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(queryByText("Enter a valid hex color")).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(getByText("Enter a valid hex color")).toBeInTheDocument();
    expect(input).toHaveValue("gggggg");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "ff0000" } });
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    expect(queryByText("Enter a valid hex color")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ColorInput } from "./ColorInput";
import { vi } from "vitest";
import { EditorJotaiProvider } from "../../editor-jotai";
import * as App from "../App";

// Mock useEditorInterface
vi.mock("../App", async () => {
  const actual = await vi.importActual<typeof App>("../App");
  return {
    ...actual,
    useEditorInterface: () => ({ formFactor: "desktop" }),
  };
});

describe("ColorInput", () => {
  const defaultProps = {
    color: "#ff0000",
    onChange: vi.fn(),
    label: "Color",
    colorPickerType: "elementBackground" as const,
    placeholder: "Enter color",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<EditorJotaiProvider>{ui}</EditorJotaiProvider>);
  };

  it("should render with initial color value", () => {
    renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color") as HTMLInputElement;
    expect(input.value).toBe("ff0000");
  });

  it("should call onChange with valid hex color", () => {
    renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");

    fireEvent.change(input, { target: { value: "00ff00" } });

    expect(defaultProps.onChange).toHaveBeenCalledWith("#00ff00");
  });

  it("should add invalid class when entering invalid hex code", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    fireEvent.change(input, { target: { value: "zzz" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should not add invalid class for valid hex code", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    fireEvent.change(input, { target: { value: "123456" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should not add invalid class for empty input", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should remove invalid class when valid color is entered after invalid", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Enter invalid color
    fireEvent.change(input, { target: { value: "zzz" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });

    // Enter valid color
    fireEvent.change(input, { target: { value: "ff0000" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should clear invalid state on blur", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Enter invalid color
    fireEvent.change(input, { target: { value: "xyz" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });

    // Blur the input
    fireEvent.blur(input);

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should reset to original color value on blur", () => {
    renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "invalid" } });
    expect(input.value).toBe("invalid");

    fireEvent.blur(input);
    expect(input.value).toBe("ff0000");
  });

  it("should handle transparent color", () => {
    renderWithProviders(<ColorInput {...defaultProps} color="transparent" />);
    const input = screen.getByLabelText("Color") as HTMLInputElement;
    expect(input.value).toBe("transparent");
  });

  it("should accept valid color with # prefix", () => {
    renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");

    fireEvent.change(input, { target: { value: "#00ff00" } });

    expect(defaultProps.onChange).toHaveBeenCalledWith("#00ff00");
  });

  it("should handle 3-character hex codes", () => {
    renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");

    fireEvent.change(input, { target: { value: "f00" } });

    expect(defaultProps.onChange).toHaveBeenCalledWith("#f00");
  });

  it("should not call onChange for invalid colors", () => {
    const onChange = vi.fn();
    renderWithProviders(<ColorInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByLabelText("Color");

    onChange.mockClear();
    fireEvent.change(input, { target: { value: "notacolor" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should update when color prop changes", async () => {
    const { rerender } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color") as HTMLInputElement;

    expect(input.value).toBe("ff0000");

    rerender(
      <EditorJotaiProvider>
        <ColorInput {...defaultProps} color="#00ff00" />
      </EditorJotaiProvider>,
    );

    await waitFor(() => {
      expect(input.value).toBe("00ff00");
    });
  });

  it("should clear invalid state when color prop changes", async () => {
    const { container, rerender } = renderWithProviders(
      <ColorInput {...defaultProps} />,
    );
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Enter invalid color
    fireEvent.change(input, { target: { value: "invalid" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });

    // Update color prop
    rerender(
      <EditorJotaiProvider>
        <ColorInput {...defaultProps} color="#0000ff" />
      </EditorJotaiProvider>,
    );

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should not show invalid feedback for 1 or 2 characters", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Type 1 character
    fireEvent.change(input, { target: { value: "z" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });

    // Type 2 characters
    fireEvent.change(input, { target: { value: "zz" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should show invalid feedback starting at 3 characters", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Type 3 invalid characters
    fireEvent.change(input, { target: { value: "zzz" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should handle # prefix correctly when checking length", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Type # followed by 2 characters (should not show invalid)
    fireEvent.change(input, { target: { value: "#zz" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });

    // Type # followed by 3 invalid characters (should show invalid)
    fireEvent.change(input, { target: { value: "#zzz" } });

    await waitFor(() => {
      expect(inputLabel).toHaveClass("color-picker__input-label--invalid");
    });
  });

  it("should not show invalid for valid 3-character hex", async () => {
    const { container } = renderWithProviders(<ColorInput {...defaultProps} />);
    const input = screen.getByLabelText("Color");
    const inputLabel = container.querySelector(".color-picker__input-label");

    // Type valid 3-character hex
    fireEvent.change(input, { target: { value: "abc" } });

    await waitFor(() => {
      expect(inputLabel).not.toHaveClass("color-picker__input-label--invalid");
    });
  });
});

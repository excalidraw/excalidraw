import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { FontSizeInput } from "../components/FontSizeInput";

describe("custom font size", () => {
  it("accepts sizes above presets and steps without resetting to a preset", () => {
    const onChange = vi.fn();
    render(<FontSizeInput value={36} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "96" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(96);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(97);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(96);
  });

  it.each(["", "-1", "1001"])("rejects invalid input %s", (value) => {
    const onChange = vi.fn();
    render(<FontSizeInput value={24.5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(24.5);
  });
});

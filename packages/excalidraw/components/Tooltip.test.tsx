import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";

import { getTooltipDiv, hideTooltip, Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  afterEach(() => {
    hideTooltip();
  });

  it("updates its label when clicked without leaving the hovered item", () => {
    const Toggle = () => {
      const [docked, setDocked] = useState(false);
      return (
        <Tooltip label={docked ? "Unpin sidebar" : "Keep sidebar open"}>
          <button onClick={() => setDocked(!docked)}>Pin</button>
        </Tooltip>
      );
    };
    const { getByRole } = render(<Toggle />);
    const button = getByRole("button");
    fireEvent.pointerEnter(button.parentElement!);

    const tooltip = getTooltipDiv(button.ownerDocument);
    expect(tooltip.textContent).toBe("Keep sidebar open");
    fireEvent.click(button);
    expect(tooltip.textContent).toBe("Unpin sidebar");
    expect(tooltip).toHaveClass("excalidraw-tooltip--visible");
    fireEvent.click(button);
    expect(tooltip.textContent).toBe("Keep sidebar open");
  });

  it("does not overwrite another item's tooltip or reopen a hidden tooltip", () => {
    const Content = ({ label }: { label: string }) => (
      <>
        <Tooltip label={label}>
          <button>First</button>
        </Tooltip>
        <Tooltip label="Second tooltip">
          <button>Second</button>
        </Tooltip>
      </>
    );
    const { getByRole, rerender } = render(<Content label="Initial" />);
    const first = getByRole("button", { name: "First" }).parentElement!;
    const second = getByRole("button", { name: "Second" }).parentElement!;
    fireEvent.pointerEnter(first);
    fireEvent.pointerLeave(first);
    fireEvent.pointerEnter(second);

    rerender(<Content label="Updated" />);
    const tooltip = getTooltipDiv(second.ownerDocument);
    expect(tooltip.textContent).toBe("Second tooltip");

    fireEvent.pointerLeave(second);
    rerender(<Content label="Updated again" />);
    expect(tooltip).not.toHaveClass("excalidraw-tooltip--visible");
  });
});

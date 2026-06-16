import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { render } from "./test-utils";

const { h } = window;

describe("star tool", () => {
  it("appears in the toolbar and can be selected", async () => {
    const { getByToolName } = await render(<Excalidraw />);

    const tool = getByToolName("star");
    expect(tool).toBeTruthy();
    expect(tool).toHaveAttribute("aria-label", "Star");
    expect(tool).toHaveAttribute("data-testid", "toolbar-star");

    fireEvent.click(tool);
    expect(h.state.activeTool.type).toBe("star");
  });

  it("creates a star element when drawn on the canvas", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const tool = getByToolName("star");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(canvas);
    fireEvent.keyDown(document, { key: KEYS.ESCAPE });

    expect(h.elements.length).toBe(1);
    expect(h.elements[0].type).toBe("star");
    expect(h.elements[0].width).toBe(30);
    expect(h.elements[0].height).toBe(50);
  });
});

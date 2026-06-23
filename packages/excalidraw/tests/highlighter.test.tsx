import React from "react";
import { render, fireEvent, waitFor } from "./test-utils";
import { Excalidraw } from "../index";
import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";

describe("highlighter tool", () => {
  it("should create a highlighter element when highlighter tool is active", async () => {
    const { getByTestId } = await render(<Excalidraw />);
    const mouse = new Pointer("mouse");

    // Select highlighter tool
    const highlighterTool = getByTestId("toolbar-highlighter");
    fireEvent.click(highlighterTool);

    expect(window.h.state.activeTool.type).toBe("highlighter");

    // Draw something
    mouse.down(10, 10);
    mouse.move(20, 20);
    mouse.up();

    const elements = API.getSelectedElements();
    expect(elements.length).toBe(1);
    expect(elements[0].type).toBe("highlighter");
  });
});

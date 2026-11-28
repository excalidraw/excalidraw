import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { fireEvent, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

describe("palette hotkeys vs tool switching (issue #12405)", () => {
  beforeEach(async () => {
    // needed for radix-ui popover (same as togglePopover in test-utils)
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("does not switch to bucket fill when pressing B with the stroke palette open", async () => {
    UI.clickTool("freedraw");

    fireEvent.keyDown(document, { key: "s" });
    expect(h.state.openPopup).toBe("elementStroke");

    // keypress lands outside the picker (e.g. focus stayed on the canvas):
    // B is a palette hotkey and must not fall through to tool switching
    fireEvent.keyDown(document, { key: "b" });

    expect(h.state.activeTool.type).not.toBe("bucketfill");
  });
});

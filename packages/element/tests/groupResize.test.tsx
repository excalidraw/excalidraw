import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import { KEYS } from "@excalidraw/common";
import { unmountComponent } from "@excalidraw/excalidraw/tests/test-utils";
import { render } from "@excalidraw/excalidraw/tests/test-utils";
import { Excalidraw } from "@excalidraw/excalidraw";
const { h } = window;
const mouse = new Pointer("mouse");

unmountComponent();

describe("group resize", () => {
  beforeEach(() => {
    h.elements = [];
  });

  it("resizes group with locked aspect ratio using side handles", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    const end = mouse.getPosition();

    mouse.reset();
    mouse.down();
    mouse.restorePosition(...end);
    mouse.up();

    expect(h.elements.length).toBe(3);
    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(0);
      expect(h.state.selectedElementIds[element.id]).toBe(true);
    }

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.G);
    });

    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(1);
    }

    mouse.select(h.elements[0]);
    let originalWidth = h.elements[0].width;
    let originalHeight = h.elements[0].height;

    UI.resize(h.elements[0], 'se', [50, 50], { shift: true });

    expect(h.elements[0].width).toBe(originalWidth + 50);
    expect(h.elements[0].height).toBe(originalHeight + 50);

    originalWidth = h.elements[0].width;
    originalHeight = h.elements[0].height;

    UI.resize(h.elements[0], "e", [50, 0], { shift: true });

    expect(h.elements[0].width).toBe(originalWidth - 50);
    expect(h.elements[0].height).toBe(originalHeight - 50);
  });

  it("resizes group with locked aspect ratio using corner handles", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    const end = mouse.getPosition();

    mouse.reset();
    mouse.down();
    mouse.restorePosition(...end);
    mouse.up();

    expect(h.elements.length).toBe(3);
    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(0);
      expect(h.state.selectedElementIds[element.id]).toBe(true);
    }

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.G);
    });

    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(1);
    }

    mouse.select(h.elements[0]);

    let originalWidth = h.elements[0].width;
    let originalHeight = h.elements[0].height;

    UI.resize(h.elements[0], "se", [50, 50], { shift: true });


    expect(h.elements[0].width).toBe(originalWidth + 50);
    expect(h.elements[0].height).toBe(originalHeight + 50);
  });
}); 
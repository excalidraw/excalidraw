import { KEYS } from "@excalidraw/common";
import {
  actionAlignVerticallyCentered,
  actionAlignHorizontallyCentered,
  actionGroup,
  actionAlignTop,
  actionAlignBottom,
  actionAlignLeft,
  actionAlignRight,
} from "@excalidraw/excalidraw/actions";
import { defaultLang, setLanguage } from "@excalidraw/excalidraw/i18n";
import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Pointer, Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import { act, unmountComponent, render } from "@excalidraw/excalidraw/tests/test-utils";

const mouse = new Pointer("mouse");

// Helper: create 2 rectangles
const createAndSelectTwoRectangles = () => {
  UI.clickTool("rectangle");
  mouse.down();
  mouse.up(100, 100);

  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.up(100, 100);

  mouse.reset();
  Keyboard.withModifierKeys({ shift: true }, () => {
    mouse.moveTo(10, 0);
    mouse.click();
  });
};

describe("Aligning elements", () => {
  beforeEach(async () => {
    unmountComponent();
    mouse.reset();
    await act(() => setLanguage(defaultLang));
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("aligns two elements to top", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    const selected = API.getSelectedElements();
    expect(selected[0].y).toEqual(0);
    expect(selected[1].y).toEqual(0);
  });

  it("aligns two elements to bottom", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    const selected = API.getSelectedElements();
    expect(selected[0].y).toEqual(100);
    expect(selected[1].y).toEqual(100);
  });

  it("aligns two elements to left", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });

    const selected = API.getSelectedElements();
    expect(selected[0].x).toEqual(0);
    expect(selected[1].x).toEqual(0);
  });

  it("aligns two elements to right", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    const selected = API.getSelectedElements();
    expect(selected[0].x).toEqual(100);
    expect(selected[1].x).toEqual(100);
  });

  it("aligns two elements vertically centered", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.V);
    });

    const selected = API.getSelectedElements();
    // Both elements should have the same center y
    const centerY0 = selected[0].y + selected[0].height / 2;
    const centerY1 = selected[1].y + selected[1].height / 2;
    expect(centerY0).toEqual(centerY1);
  });

  it("aligns two elements horizontally centered", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.H);
    });

    const selected = API.getSelectedElements();
    // Both elements should have the same center x
    const centerX0 = selected[0].x + selected[0].width / 2;
    const centerX1 = selected[1].x + selected[1].width / 2;
    expect(centerX0).toEqual(centerX1);
  });

  it("groups two elements", () => {
    createAndSelectTwoRectangles();

    Keyboard.withModifierKeys({ ctrl: true, g: true }, () => {
      Keyboard.keyPress("g");
    });

    const selected = API.getSelectedElements();
    expect(selected[0].groupIds.length).toBeGreaterThan(0);
    expect(selected[0].groupIds).toEqual(selected[1].groupIds);
  });
});

// We recommend installing an extension to run vitest tests.
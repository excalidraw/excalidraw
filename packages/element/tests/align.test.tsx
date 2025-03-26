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
import {
  act,
  unmountComponent,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";

const mouse = new Pointer("mouse");

const createAndSelectTwoRectangles = () => {
  UI.clickTool("rectangle");
  mouse.down();
  mouse.up(100, 100);

  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.up(100, 100);

  // Select the first element.
  // The second rectangle is already reselected because it was the last element created
  mouse.reset();
  Keyboard.withModifierKeys({ shift: true }, () => {
    mouse.click();
  });
};

const createAndSelectTwoRectanglesWithDifferentSizes = () => {
  UI.clickTool("rectangle");
  mouse.down();
  mouse.up(100, 100);

  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.up(110, 110);

  // Select the first element.
  // The second rectangle is already reselected because it was the last element created
  mouse.reset();
  Keyboard.withModifierKeys({ shift: true }, () => {
    mouse.click();
  });
};

describe("aligning", () => {
  beforeEach(async () => {
    unmountComponent();
    mouse.reset();

    await act(() => {
      return setLanguage(defaultLang);
    });
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("aligns two objects correctly to the top", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });

  it("aligns two objects correctly to the bottom", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(110);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("aligns two objects correctly to the left", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("aligns two objects correctly to the right", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    expect(API.getSelectedElements()[0].x).toEqual(110);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("centers two objects with different sizes correctly vertically", () => {
    createAndSelectTwoRectanglesWithDifferentSizes();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    API.executeAction(actionAlignVerticallyCentered);

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(60);
    expect(API.getSelectedElements()[1].y).toEqual(55);
  });

  it("centers two objects with different sizes correctly horizontally", () => {
    createAndSelectTwoRectanglesWithDifferentSizes();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(60);
    expect(API.getSelectedElements()[1].x).toEqual(55);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  const createAndSelectGroupAndRectangle = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add the created group to the current selection
    mouse.restorePosition(0, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });
  };

  it("aligns a group with another element correctly to the top", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });

  it("aligns a group with another element correctly to the bottom", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });

  it("aligns a group with another element correctly to the left", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });

  it("aligns a group with another element correctly to the right", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });

  it("centers a group with another element correctly vertically", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });

  it("centers a group with another element correctly horizontally", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });

  const createAndSelectTwoGroups = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already selected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    mouse.restorePosition(200, 200);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    API.executeAction(actionGroup);

    // Select the first group.
    // The second group is already selected because it was the last group created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });
  };

  it("aligns two groups correctly to the top", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
    expect(API.getSelectedElements()[3].y).toEqual(100);
  });

  it("aligns two groups correctly to the bottom", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(200);
    expect(API.getSelectedElements()[1].y).toEqual(300);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);
  });

  it("aligns two groups correctly to the left", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
    expect(API.getSelectedElements()[3].x).toEqual(100);
  });

  it("aligns two groups correctly to the right", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(200);
    expect(API.getSelectedElements()[1].x).toEqual(300);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);
  });

  it("centers two groups correctly vertically", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(100);
    expect(API.getSelectedElements()[3].y).toEqual(200);
  });

  it("centers two groups correctly horizontally", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(100);
    expect(API.getSelectedElements()[3].x).toEqual(200);
  });

  const createAndSelectNestedGroupAndRectangle = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create first group of rectangles
    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add group to current selection
    mouse.restorePosition(0, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create the nested group
    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(300, 300);
    mouse.up(100, 100);

    // Select the nested group, the rectangle is already selected
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });
  };

  it("aligns nested group and other element correctly to the top", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(0);
  });

  it("aligns nested group and other element correctly to the bottom", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(300);
    expect(API.getSelectedElements()[3].y).toEqual(300);
  });

  it("aligns nested group and other element correctly to the left", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(0);
  });

  it("aligns nested group and other element correctly to the right", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(300);
    expect(API.getSelectedElements()[3].x).toEqual(300);
  });

  it("centers nested group and other element correctly vertically", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(250);
    expect(API.getSelectedElements()[3].y).toEqual(150);
  });

  it("centers nested group and other element correctly horizontally", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(250);
    expect(API.getSelectedElements()[3].x).toEqual(150);
  });
});

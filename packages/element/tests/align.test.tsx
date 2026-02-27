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
    mouse.moveTo(10, 0);
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
    mouse.moveTo(10, 0);
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
      mouse.moveTo(10, 0);
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
      mouse.moveTo(10, 0);
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
      mouse.moveTo(10, 0);
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

    mouse.restorePosition(210, 200);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    API.executeAction(actionGroup);

    // Select the first group.
    // The second group is already selected because it was the last group created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
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
      mouse.moveTo(10, 0);
      mouse.click();
    });

    // Create first group of rectangles
    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add group to current selection
    mouse.restorePosition(10, 0);
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
      mouse.moveTo(10, 0);
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

  const createGroupAndSelectInEditGroupMode = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);
    mouse.reset();
    mouse.moveTo(10, 0);
    mouse.doubleClick();

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
      mouse.moveTo(100, 100);
      mouse.click();
    });
  };

  it("aligns elements within a group while in group edit mode correctly to the top", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });
  it("aligns elements within a group while in group edit mode correctly to the bottom", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(100);
  });
  it("aligns elements within a group while in group edit mode correctly to the left", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);
  });
  it("aligns elements within a group while in group edit mode correctly to the right", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(100);
  });
  it("aligns elements within a group while in group edit mode correctly to the vertical center", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(50);
  });
  it("aligns elements within a group while in group edit mode correctly to the horizontal center", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(50);
  });

  const createNestedGroupAndSelectInEditGroupMode = () => {
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
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    mouse.moveTo(200, 200);
    // create third element
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // third element is already selected, select the initial group and group together
    mouse.reset();

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    // double click to enter edit mode
    mouse.doubleClick();

    // select nested group and other element within the group
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(200, 200);
      mouse.click();
    });
  };

  it("aligns element and nested group while in group edit mode correctly to the top", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });
  it("aligns element and nested group while in group edit mode correctly to the bottom", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });
  it("aligns element and nested group while in group edit mode correctly to the left", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });
  it("aligns element and nested group while in group edit mode correctly to the right", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });
  it("aligns element and nested group while in group edit mode correctly to the vertical center", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });
  it("aligns elements and nested group within a group while in group edit mode correctly to the horizontal center", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });

  const createAndSelectSingleGroup = () => {
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
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);
  };

  it("aligns elements within a single-selected group correctly to the top", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });
  it("aligns elements within a single-selected group correctly to the bottom", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(100);
  });
  it("aligns elements within a single-selected group correctly to the left", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);
  });
  it("aligns elements within a single-selected group correctly to the right", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(100);
  });
  it("aligns elements within a single-selected group correctly to the vertical center", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(50);
  });
  it("aligns elements within a single-selected group correctly to the horizontal center", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(50);
  });

  const createAndSelectSingleGroupWithNestedGroup = () => {
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
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add group to current selection
    mouse.restorePosition(10, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create the nested group
    API.executeAction(actionGroup);
  };
  it("aligns elements within a single-selected group containing a nested group correctly to the top", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the bottom", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the left", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the right", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the vertical center", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the horizontal center", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });
});

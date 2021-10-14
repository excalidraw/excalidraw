import ReactDOM from "react-dom";
import { render } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { defaultLang, setLanguage } from "../i18n";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { API } from "./helpers/api";
import { KEYS } from "../keys";
import {
  actionAlignVerticallyCentered,
  actionAlignHorizontallyCentered,
  actionGroup,
  actionAlignTop,
  actionAlignBottom,
  actionAlignLeft,
  actionAlignRight,
} from "../actions";

const { h } = window;

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
    // Unmount ReactDOM from root
    ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
    mouse.reset();

    await setLanguage(defaultLang);
    await render(<ExcalidrawApp />);
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

    h.app.actionManager.executeAction(actionAlignVerticallyCentered);

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

    h.app.actionManager.executeAction(actionAlignHorizontallyCentered);

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

    h.app.actionManager.executeAction(actionGroup);

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

    h.app.actionManager.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });

  it("aligns a group with another element correctly to the bottom", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    h.app.actionManager.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });

  it("aligns a group with another element correctly to the left", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    h.app.actionManager.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });

  it("aligns a group with another element correctly to the right", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    h.app.actionManager.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });

  it("centers a group with another element correctly vertically", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    h.app.actionManager.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });

  it("centers a group with another element correctly horizontally", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    h.app.actionManager.executeAction(actionAlignHorizontallyCentered);

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

    h.app.actionManager.executeAction(actionGroup);

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

    h.app.actionManager.executeAction(actionGroup);

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

    h.app.actionManager.executeAction(actionAlignTop);

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

    h.app.actionManager.executeAction(actionAlignBottom);

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

    h.app.actionManager.executeAction(actionAlignLeft);

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

    h.app.actionManager.executeAction(actionAlignRight);

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

    h.app.actionManager.executeAction(actionAlignVerticallyCentered);

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

    h.app.actionManager.executeAction(actionAlignHorizontallyCentered);

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
    h.app.actionManager.executeAction(actionGroup);

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
    h.app.actionManager.executeAction(actionGroup);

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

    h.app.actionManager.executeAction(actionAlignTop);

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

    h.app.actionManager.executeAction(actionAlignBottom);

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

    h.app.actionManager.executeAction(actionAlignLeft);

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

    h.app.actionManager.executeAction(actionAlignRight);

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

    h.app.actionManager.executeAction(actionAlignVerticallyCentered);

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

    h.app.actionManager.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(250);
    expect(API.getSelectedElements()[3].x).toEqual(150);
  });
});

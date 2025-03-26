import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();

  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;

  // The bounds of hand-drawn linear elements may change after flipping, so
  // removing this style for testing
  UI.clickTool("arrow");
  UI.clickByTitle("Architect");
  UI.clickTool("selection");
});

describe("flow chart creation", () => {
  beforeEach(() => {
    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
  });

  // multiple at once
  it("create multiple successor nodes at once", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);
  });

  it("when directions are changed, only the last same directions will apply", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);

      Keyboard.keyPress(KEYS.ARROW_LEFT);

      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);
  });

  it("when escaped, no nodes will be created", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    Keyboard.keyPress(KEYS.ESCAPE);
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(1);
  });

  it("create nodes one at a time", () => {
    const initialNode = h.elements[0];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(3);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(2);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(1);

    const firstChildNode = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== initialNode.id,
    )[0];
    expect(firstChildNode).not.toBe(null);
    expect(firstChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);

    const secondChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id,
    )[0];
    expect(secondChildNode).not.toBe(null);
    expect(secondChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);

    const thirdChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id &&
        el.id !== secondChildNode.id,
    )[0];

    expect(thirdChildNode).not.toBe(null);
    expect(thirdChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    expect(firstChildNode.x).toBe(secondChildNode.x);
    expect(secondChildNode.x).toBe(thirdChildNode.x);
  });
});

describe("flow chart navigation", () => {
  it("single node at each level", () => {
    /**
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(5);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(4);

    // all the way to the left, gets us to the first node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // all the way to the right, gets us to the last node
    const rightMostNode = h.elements[h.elements.length - 2];
    expect(rightMostNode);
    expect(rightMostNode.type).toBe("rectangle");
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);
  });

  it("multiple nodes at each level", () => {
    /**
     * from the perspective of the first node, there're four layers, and
     * there are four nodes at the second layer
     *
     *   -> ▨
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     *   -> ▨
     *   -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const secondNode = h.elements[1];
    const rightMostNode = h.elements[h.elements.length - 2];

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);

    // because of same level cycling,
    // going right five times should take us back to the second node again
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[secondNode.id]).toBe(true);

    // from the second node, going right three times should take us to the rightmost node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("take the most obvious link when possible", () => {
    /**
     * ▨ → ▨   ▨ → ▨
     *     ↓   ↑
     *     ▨ → ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    // last node should be the one that's selected
    const rightMostNode = h.elements[h.elements.length - 2];
    expect(rightMostNode.type).toBe("rectangle");
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);

    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // going any direction takes us to the predecessor as well
    const predecessorToRightMostNode = h.elements[h.elements.length - 4];
    expect(predecessorToRightMostNode.type).toBe("rectangle");

    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
  });
});

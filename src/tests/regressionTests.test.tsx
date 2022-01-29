import ReactDOM from "react-dom";
import { ExcalidrawElement } from "../element/types";
import { CODES, KEYS } from "../keys";
import ExcalidrawApp from "../excalidraw-app";
import { reseed } from "../random";
import * as Renderer from "../renderer/renderScene";
import { setDateTimeForTests } from "../utils";
import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  assertSelectedElements,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./test-utils";
import { defaultLang } from "../i18n";
import { FONT_FAMILY } from "../constants";
import { t } from "../i18n";

const { h } = window;

const renderScene = jest.spyOn(Renderer, "renderScene");

const mouse = new Pointer("mouse");
const finger1 = new Pointer("touch", 1);
const finger2 = new Pointer("touch", 2);

const clickLabeledElement = (label: string) => {
  const element = document.querySelector(`[aria-label='${label}']`);
  if (!element) {
    throw new Error(`No labeled element found: ${label}`);
  }
  fireEvent.click(element);
};

/**
 * This is always called at the end of your test, so usually you don't need to call it.
 * However, if you have a long test, you might want to call it during the test so it's easier
 * to debug where a test failure came from.
 */
const checkpoint = (name: string) => {
  expect(renderScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );
  expect(h.state).toMatchSnapshot(`[${name}] appState`);
  expect(h.history.getSnapshotForTest()).toMatchSnapshot(`[${name}] history`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);
  h.elements.forEach((element, i) =>
    expect(element).toMatchSnapshot(`[${name}] element ${i}`),
  );
};

beforeEach(async () => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
  setDateTimeForTests("201933152653");

  mouse.reset();
  finger1.reset();
  finger2.reset();

  await render(<ExcalidrawApp />);
  h.setState({ height: 768, width: 1024 });
});

afterEach(() => {
  checkpoint("end of test");
});

describe("regression tests", () => {
  it("draw every type of shape", () => {
    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(20, 10);

    UI.clickTool("diamond");
    mouse.down(10, -10);
    mouse.up(20, 10);

    UI.clickTool("ellipse");
    mouse.down(10, -10);
    mouse.up(20, 10);

    UI.clickTool("arrow");
    mouse.down(40, -10);
    mouse.up(50, 10);

    UI.clickTool("line");
    mouse.down(40, -10);
    mouse.up(50, 10);

    UI.clickTool("arrow");
    mouse.click(40, -10);
    mouse.click(50, 10);
    mouse.click(30, 10);
    Keyboard.keyPress(KEYS.ENTER);

    UI.clickTool("line");
    mouse.click(40, -20);
    mouse.click(50, 10);
    mouse.click(30, 10);
    Keyboard.keyPress(KEYS.ENTER);

    UI.clickTool("freedraw");
    mouse.down(40, -20);
    mouse.up(50, 10);

    expect(h.elements.map((element) => element.type)).toEqual([
      "rectangle",
      "diamond",
      "ellipse",
      "arrow",
      "line",
      "arrow",
      "line",
      "freedraw",
    ]);
  });

  it("click to select a shape", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const firstRectPos = mouse.getPosition();

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const prevSelectedId = API.getSelectedElement().id;
    mouse.restorePosition(...firstRectPos);
    mouse.click();

    expect(API.getSelectedElement().id).not.toEqual(prevSelectedId);
  });

  for (const [keys, shape, shouldSelect] of [
    [`2${KEYS.R}`, "rectangle", true],
    [`3${KEYS.D}`, "diamond", true],
    [`4${KEYS.E}`, "ellipse", true],
    [`5${KEYS.A}`, "arrow", true],
    [`6${KEYS.L}`, "line", true],
    [`7${KEYS.X}`, "freedraw", false],
  ] as [string, ExcalidrawElement["type"], boolean][]) {
    for (const key of keys) {
      it(`key ${key} selects ${shape} tool`, () => {
        Keyboard.keyPress(key);

        expect(h.state.elementType).toBe(shape);

        mouse.down(10, 10);
        mouse.up(10, 10);

        if (shouldSelect) {
          expect(API.getSelectedElement().type).toBe(shape);
        }
      });
    }
  }
  it("change the properties of a shape", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    clickLabeledElement("Background");
    clickLabeledElement(t("colors.fa5252"));
    clickLabeledElement("Stroke");
    clickLabeledElement(t("colors.5f3dc4"));
    expect(API.getSelectedElement().backgroundColor).toBe("#fa5252");
    expect(API.getSelectedElement().strokeColor).toBe("#5f3dc4");
  });

  it("click on an element and drag it", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const { x: prevX, y: prevY } = API.getSelectedElement();
    mouse.down(-10, -10);
    mouse.up(10, 10);

    const { x: nextX, y: nextY } = API.getSelectedElement();
    expect(nextX).toBeGreaterThan(prevX);
    expect(nextY).toBeGreaterThan(prevY);

    checkpoint("dragged");

    mouse.down();
    mouse.up(-10, -10);

    const { x, y } = API.getSelectedElement();
    expect(x).toBe(prevX);
    expect(y).toBe(prevY);
  });

  it("alt-drag duplicates an element", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(1);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(-10, -10);
      mouse.up(10, 10);
    });

    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(2);
  });

  it("click-drag to select a group", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const finalPosition = mouse.getPosition();

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    mouse.restorePosition(0, 0);
    mouse.down();
    mouse.restorePosition(...finalPosition);
    mouse.up(5, 5);

    expect(
      h.elements.filter((element) => h.state.selectedElementIds[element.id])
        .length,
    ).toBe(2);
  });

  it("shift-click to multiselect, then drag", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const prevRectsXY = h.elements
      .filter((element) => element.type === "rectangle")
      .map((element) => ({ x: element.x, y: element.y }));

    mouse.reset();
    mouse.click(10, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(20, 0);
    });

    mouse.down();
    mouse.up(10, 10);

    h.elements
      .filter((element) => element.type === "rectangle")
      .forEach((element, i) => {
        expect(element.x).toBeGreaterThan(prevRectsXY[i].x);
        expect(element.y).toBeGreaterThan(prevRectsXY[i].y);
      });
  });

  it("pinch-to-zoom works", () => {
    expect(h.state.zoom.value).toBe(1);
    finger1.down(50, 50);
    finger2.down(60, 50);
    finger1.move(-10, 0);
    expect(h.state.zoom.value).toBeGreaterThan(1);
    const zoomed = h.state.zoom.value;
    finger1.move(5, 0);
    finger2.move(-5, 0);
    expect(h.state.zoom.value).toBeLessThan(zoomed);
  });

  it("two-finger scroll works", () => {
    // scroll horizontally vertically

    const startScrollY = h.state.scrollY;

    finger1.downAt(0, 0);
    finger2.downAt(10, 0);

    finger1.clientY -= 10;
    finger2.clientY -= 10;

    finger1.moveTo();
    finger2.moveTo();

    finger1.upAt();
    finger2.upAt();
    expect(h.state.scrollY).toBeLessThan(startScrollY);

    // scroll horizontally

    const startScrollX = h.state.scrollX;

    finger1.downAt();
    finger2.downAt();

    finger1.clientX += 10;
    finger2.clientX += 10;

    finger1.moveTo();
    finger2.moveTo();

    finger1.upAt();
    finger2.upAt();

    expect(h.state.scrollX).toBeGreaterThan(startScrollX);
  });

  it("spacebar + drag scrolls the canvas", () => {
    const { scrollX: startScrollX, scrollY: startScrollY } = h.state;
    Keyboard.keyDown(KEYS.SPACE);
    mouse.down(50, 50);
    mouse.up(60, 60);
    Keyboard.keyUp(KEYS.SPACE);
    const { scrollX, scrollY } = h.state;
    expect(scrollX).not.toEqual(startScrollX);
    expect(scrollY).not.toEqual(startScrollY);
  });

  it("arrow keys", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);
    Keyboard.keyPress(KEYS.ARROW_LEFT);
    Keyboard.keyPress(KEYS.ARROW_LEFT);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    Keyboard.keyPress(KEYS.ARROW_UP);
    Keyboard.keyPress(KEYS.ARROW_UP);
    Keyboard.keyPress(KEYS.ARROW_DOWN);
    expect(h.elements[0].x).toBe(9);
    expect(h.elements[0].y).toBe(9);
  });

  it("undo/redo drawing an element", () => {
    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(20, 10);

    UI.clickTool("rectangle");
    mouse.down(10, 0);
    mouse.up(30, 20);

    UI.clickTool("arrow");
    mouse.click(60, -10);
    mouse.click(60, 10);
    mouse.click(40, 10);
    Keyboard.keyPress(KEYS.ENTER);

    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(3);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
      Keyboard.keyPress(KEYS.Z);
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(1);
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
  });

  it("noop interaction after undo shouldn't create history entry", () => {
    expect(API.getStateHistory().length).toBe(1);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    const firstElementEndPoint = mouse.getPosition();

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    const secondElementEndPoint = mouse.getPosition();

    expect(API.getStateHistory().length).toBe(3);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    expect(API.getStateHistory().length).toBe(2);

    // clicking an element shouldn't add to history
    mouse.restorePosition(...firstElementEndPoint);
    mouse.click();
    expect(API.getStateHistory().length).toBe(2);

    Keyboard.withModifierKeys({ shift: true, ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    expect(API.getStateHistory().length).toBe(3);

    // clicking an element shouldn't add to history
    mouse.click();
    expect(API.getStateHistory().length).toBe(3);

    const firstSelectedElementId = API.getSelectedElement().id;

    // same for clicking the element just redo-ed
    mouse.restorePosition(...secondElementEndPoint);
    mouse.click();
    expect(API.getStateHistory().length).toBe(3);

    expect(API.getSelectedElement().id).not.toEqual(firstSelectedElementId);
  });

  it("zoom hotkeys", () => {
    expect(h.state.zoom.value).toBe(1);
    fireEvent.keyDown(document, {
      code: CODES.EQUAL,
      ctrlKey: true,
    });
    fireEvent.keyUp(document, {
      code: CODES.EQUAL,
      ctrlKey: true,
    });
    expect(h.state.zoom.value).toBeGreaterThan(1);
    fireEvent.keyDown(document, {
      code: CODES.MINUS,
      ctrlKey: true,
    });
    fireEvent.keyUp(document, {
      code: CODES.MINUS,
      ctrlKey: true,
    });
    expect(h.state.zoom.value).toBe(1);
  });

  it("rerenders UI on language change", async () => {
    // select rectangle tool to show properties menu
    UI.clickTool("rectangle");
    // english lang should display `thin` label
    expect(screen.queryByTitle(/thin/i)).not.toBeNull();
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "de-DE" },
    });
    // switching to german, `thin` label should no longer exist
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).toBeNull());
    // reset language
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: defaultLang.code },
    });
    // switching back to English
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).not.toBeNull());
  });

  it("make a group and duplicate it", () => {
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
      Keyboard.codePress(CODES.G);
    });

    for (const element of h.elements) {
      expect(element.groupIds.length).toBe(1);
    }

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.restorePosition(...end);
      mouse.down();
      mouse.up(10, 10);
    });

    expect(h.elements.length).toBe(6);
    const groups = new Set();
    for (const element of h.elements) {
      for (const groupId of element.groupIds) {
        groups.add(groupId);
      }
    }

    expect(groups.size).toBe(2);
  });

  it("double click to edit a group", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
      Keyboard.codePress(CODES.G);
    });

    expect(API.getSelectedElements().length).toBe(3);
    expect(h.state.editingGroupId).toBe(null);
    mouse.doubleClick();
    expect(API.getSelectedElements().length).toBe(1);
    expect(h.state.editingGroupId).not.toBe(null);
  });

  it("adjusts z order when grouping", () => {
    const positions = [];

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);
    positions.push(mouse.getPosition());

    const ids = h.elements.map((element) => element.id);

    mouse.restorePosition(...positions[0]);
    mouse.click();
    mouse.restorePosition(...positions[2]);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });

    expect(h.elements.map((element) => element.id)).toEqual([
      ids[1],
      ids[0],
      ids[2],
    ]);
  });

  it("supports nested groups", () => {
    const rectA = UI.createElement("rectangle", { position: 0, size: 50 });
    const rectB = UI.createElement("rectangle", { position: 100, size: 50 });
    const rectC = UI.createElement("rectangle", { position: 200, size: 50 });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
      Keyboard.codePress(CODES.G);
    });

    mouse.doubleClickOn(rectC);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.clickOn(rectA);
    });
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });

    expect(rectC.groupIds.length).toBe(2);
    expect(rectA.groupIds).toEqual(rectC.groupIds);
    expect(rectB.groupIds).toEqual(rectA.groupIds.slice(1));

    mouse.click(0, 100);
    expect(API.getSelectedElements().length).toBe(0);

    mouse.clickOn(rectA);
    expect(API.getSelectedElements().length).toBe(3);
    expect(h.state.editingGroupId).toBe(null);

    mouse.doubleClickOn(rectA);
    expect(API.getSelectedElements().length).toBe(2);
    expect(h.state.editingGroupId).toBe(rectA.groupIds[1]);

    mouse.doubleClickOn(rectA);
    expect(API.getSelectedElements().length).toBe(1);
    expect(h.state.editingGroupId).toBe(rectA.groupIds[0]);

    // click outside current (sub)group
    mouse.clickOn(rectB);
    expect(API.getSelectedElements().length).toBe(3);
    mouse.doubleClickOn(rectB);
    expect(API.getSelectedElements().length).toBe(1);
  });

  it("updates fontSize & fontFamily appState", () => {
    UI.clickTool("text");
    expect(h.state.currentItemFontFamily).toEqual(FONT_FAMILY.Virgil);
    fireEvent.click(screen.getByTitle(/code/i));
    expect(h.state.currentItemFontFamily).toEqual(FONT_FAMILY.Cascadia);
  });

  it("deselects selected element, on pointer up, when click hits element bounding box but doesn't hit the element", () => {
    UI.clickTool("ellipse");
    mouse.down();
    mouse.up(100, 100);

    // hits bounding box without hitting element
    mouse.down();
    expect(API.getSelectedElements().length).toBe(1);
    mouse.up();
    expect(API.getSelectedElements().length).toBe(0);
  });

  it("switches selected element on pointer down", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    UI.clickTool("ellipse");
    mouse.down(10, 10);
    mouse.up(10, 10);

    expect(API.getSelectedElement().type).toBe("ellipse");

    // pointer down on rectangle
    mouse.reset();
    mouse.down();

    expect(API.getSelectedElement().type).toBe("rectangle");
  });

  it("can drag element that covers another element, while another elem is selected", () => {
    UI.clickTool("rectangle");
    mouse.down(100, 100);
    mouse.up(200, 200);

    UI.clickTool("rectangle");
    mouse.reset();
    mouse.down(100, 100);
    mouse.up(200, 200);

    UI.clickTool("ellipse");
    mouse.reset();
    mouse.down(300, 300);
    mouse.up(350, 350);

    expect(API.getSelectedElement().type).toBe("ellipse");

    // pointer down on rectangle
    mouse.reset();
    mouse.down(100, 100);
    mouse.up(200, 200);

    expect(API.getSelectedElement().type).toBe("rectangle");
  });

  it("deselects selected element on pointer down when pointer doesn't hit any element", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    expect(API.getSelectedElements().length).toBe(1);

    // pointer down on space without elements
    mouse.down(100, 100);

    expect(API.getSelectedElements().length).toBe(0);
  });

  it("Drags selected element when hitting only bounding box and keeps element selected", () => {
    UI.clickTool("ellipse");
    mouse.down();
    mouse.up(10, 10);

    const { x: prevX, y: prevY } = API.getSelectedElement();

    // drag element from point on bounding box that doesn't hit element
    mouse.reset();
    mouse.down();
    mouse.up(25, 25);

    expect(API.getSelectedElement().x).toEqual(prevX + 25);
    expect(API.getSelectedElement().y).toEqual(prevY + 25);
  });

  it(
    "given selected element A with lower z-index than unselected element B and given B is partially over A " +
      "when clicking intersection between A and B " +
      "B should be selected on pointer up",
    () => {
      // set background color since default is transparent
      // and transparent elements can't be selected by clicking inside of them
      const rect1 = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        x: 500,
        y: 500,
        width: 500,
        height: 500,
      });
      h.elements = [rect1, rect2];

      mouse.select(rect1);

      // pointerdown on rect2 covering rect1 while rect1 is selected should
      // retain rect1 selection
      mouse.down(900, 900);
      expect(API.getSelectedElement().id).toBe(rect1.id);

      // pointerup should select rect2
      mouse.up();
      expect(API.getSelectedElement().id).toBe(rect2.id);
    },
  );

  it(
    "given selected element A with lower z-index than unselected element B and given B is partially over A " +
      "when dragging on intersection between A and B " +
      "A should be dragged and keep being selected",
    () => {
      const rect1 = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        x: 500,
        y: 500,
        width: 500,
        height: 500,
      });
      h.elements = [rect1, rect2];

      mouse.select(rect1);

      expect(API.getSelectedElement().id).toBe(rect1.id);

      const { x: prevX, y: prevY } = API.getSelectedElement();

      // pointer down on intersection between ellipse and rectangle
      mouse.down(900, 900);
      mouse.up(100, 100);

      expect(API.getSelectedElement().id).toBe(rect1.id);
      expect(API.getSelectedElement().x).toEqual(prevX + 100);
      expect(API.getSelectedElement().y).toEqual(prevY + 100);
    },
  );

  it("deselects group of selected elements on pointer down when pointer doesn't hit any element", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    UI.clickTool("ellipse");
    mouse.down(100, 100);
    mouse.up(10, 10);

    // Selects first element without deselecting the second element
    // Second element is already selected because creating it was our last action
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(5, 5);
    });

    expect(API.getSelectedElements().length).toBe(2);

    // pointer down on space without elements
    mouse.reset();
    mouse.down(500, 500);

    expect(API.getSelectedElements().length).toBe(0);
  });

  it("switches from group of selected elements to another element on pointer down", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    UI.clickTool("ellipse");
    mouse.down(100, 100);
    mouse.up(100, 100);

    UI.clickTool("diamond");
    mouse.down(100, 100);
    mouse.up(100, 100);

    // Selects ellipse without deselecting the diamond
    // Diamond is already selected because creating it was our last action
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(110, 160);
    });

    expect(API.getSelectedElements().length).toBe(2);

    // select rectangle
    mouse.reset();
    mouse.down();

    expect(API.getSelectedElement().type).toBe("rectangle");
  });

  it("deselects group of selected elements on pointer up when pointer hits common bounding box without hitting any element", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    UI.clickTool("ellipse");
    mouse.down(100, 100);
    mouse.up(10, 10);

    // Selects first element without deselecting the second element
    // Second element is already selected because creating it was our last action
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(5, 5);
    });

    // pointer down on common bounding box without hitting any of the elements
    mouse.reset();
    mouse.down(50, 50);
    expect(API.getSelectedElements().length).toBe(2);

    mouse.up();
    expect(API.getSelectedElements().length).toBe(0);
  });

  it(
    "drags selected elements from point inside common bounding box that doesn't hit any element " +
      "and keeps elements selected after dragging",
    () => {
      UI.clickTool("rectangle");
      mouse.down();
      mouse.up(10, 10);

      UI.clickTool("ellipse");
      mouse.down(100, 100);
      mouse.up(10, 10);

      // Selects first element without deselecting the second element
      // Second element is already selected because creating it was our last action
      mouse.reset();
      Keyboard.withModifierKeys({ shift: true }, () => {
        mouse.click(5, 5);
      });

      expect(API.getSelectedElements().length).toBe(2);

      const { x: firstElementPrevX, y: firstElementPrevY } =
        API.getSelectedElements()[0];
      const { x: secondElementPrevX, y: secondElementPrevY } =
        API.getSelectedElements()[1];

      // drag elements from point on common bounding box that doesn't hit any of the elements
      mouse.reset();
      mouse.down(50, 50);
      mouse.up(25, 25);

      expect(API.getSelectedElements()[0].x).toEqual(firstElementPrevX + 25);
      expect(API.getSelectedElements()[0].y).toEqual(firstElementPrevY + 25);

      expect(API.getSelectedElements()[1].x).toEqual(secondElementPrevX + 25);
      expect(API.getSelectedElements()[1].y).toEqual(secondElementPrevY + 25);

      expect(API.getSelectedElements().length).toBe(2);
    },
  );

  it(
    "given a group of selected elements with an element that is not selected inside the group common bounding box " +
      "when element that is not selected is clicked " +
      "should switch selection to not selected element on pointer up",
    () => {
      UI.clickTool("rectangle");
      mouse.down();
      mouse.up(10, 10);

      UI.clickTool("ellipse");
      mouse.down(100, 100);
      mouse.up(100, 100);

      UI.clickTool("diamond");
      mouse.down(100, 100);
      mouse.up(100, 100);

      // Selects rectangle without deselecting the diamond
      // Diamond is already selected because creating it was our last action
      mouse.reset();
      Keyboard.withModifierKeys({ shift: true }, () => {
        mouse.click();
      });

      // pointer down on ellipse
      mouse.down(110, 160);
      expect(API.getSelectedElements().length).toBe(2);

      mouse.up();
      expect(API.getSelectedElement().type).toBe("ellipse");
    },
  );

  it(
    "given a selected element A and a not selected element B with higher z-index than A " +
      "and given B partialy overlaps A " +
      "when there's a shift-click on the overlapped section B is added to the selection",
    () => {
      UI.clickTool("rectangle");
      // change background color since default is transparent
      // and transparent elements can't be selected by clicking inside of them
      clickLabeledElement("Background");
      clickLabeledElement(t("colors.fa5252"));
      mouse.down();
      mouse.up(1000, 1000);

      // draw ellipse partially over rectangle.
      // since ellipse was created after rectangle it has an higher z-index.
      // we don't need to change background color again since change above
      // affects next drawn elements.
      UI.clickTool("ellipse");
      mouse.reset();
      mouse.down(500, 500);
      mouse.up(1000, 1000);

      // select rectangle
      mouse.reset();
      mouse.click();

      // click on intersection between ellipse and rectangle
      Keyboard.withModifierKeys({ shift: true }, () => {
        mouse.click(900, 900);
      });

      expect(API.getSelectedElements().length).toBe(2);
    },
  );

  it("shift click on selected element should deselect it on pointer up", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(10, 10);

    // Rectangle is already selected since creating
    // it was our last action
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.down();
    });
    expect(API.getSelectedElements().length).toBe(1);

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.up();
    });
    expect(API.getSelectedElements().length).toBe(0);
  });

  it("single-clicking on a subgroup of a selected group should not alter selection", () => {
    const rect1 = UI.createElement("rectangle", { x: 10 });
    const rect2 = UI.createElement("rectangle", { x: 50 });
    UI.group([rect1, rect2]);

    const rect3 = UI.createElement("rectangle", { x: 10, y: 50 });
    const rect4 = UI.createElement("rectangle", { x: 50, y: 50 });
    UI.group([rect3, rect4]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
      Keyboard.codePress(CODES.G);
    });

    const selectedGroupIds_prev = h.state.selectedGroupIds;
    const selectedElements_prev = API.getSelectedElements();
    mouse.clickOn(rect3);
    expect(h.state.selectedGroupIds).toEqual(selectedGroupIds_prev);
    expect(API.getSelectedElements()).toEqual(selectedElements_prev);
  });

  it("Cmd/Ctrl-click exclusively select element under pointer", () => {
    const rect1 = UI.createElement("rectangle", { x: 0 });
    const rect2 = UI.createElement("rectangle", { x: 30 });

    UI.group([rect1, rect2]);
    assertSelectedElements(rect1, rect2);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.clickOn(rect1);
    });
    assertSelectedElements(rect1);

    API.clearSelection();
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.clickOn(rect1);
    });
    assertSelectedElements(rect1);

    const rect3 = UI.createElement("rectangle", { x: 60 });
    UI.group([rect1, rect3]);
    assertSelectedElements(rect1, rect2, rect3);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.clickOn(rect1);
    });
    assertSelectedElements(rect1);

    API.clearSelection();
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.clickOn(rect3);
    });
    assertSelectedElements(rect3);
  });

  it("should show fill icons when element has non transparent background", () => {
    UI.clickTool("rectangle");
    expect(screen.queryByText(/fill/i)).not.toBeNull();
    mouse.down();
    mouse.up(10, 10);
    expect(screen.queryByText(/fill/i)).toBeNull();

    clickLabeledElement("Background");
    clickLabeledElement(t("colors.fa5252"));
    // select rectangle
    mouse.reset();
    mouse.click();
    expect(screen.queryByText(/fill/i)).not.toBeNull();
  });
});

it(
  "given element A and group of elements B and given both are selected " +
    "when user clicks on B, on pointer up " +
    "only elements from B should be selected",
  () => {
    const rect1 = UI.createElement("rectangle", { y: 0 });
    const rect2 = UI.createElement("rectangle", { y: 30 });
    const rect3 = UI.createElement("rectangle", { y: 60 });

    UI.group([rect1, rect3]);

    expect(API.getSelectedElements().length).toBe(2);
    expect(Object.keys(h.state.selectedGroupIds).length).toBe(1);

    // Select second rectangle without deselecting group
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.clickOn(rect2);
    });
    expect(API.getSelectedElements().length).toBe(3);

    // clicking on first rectangle that is part of the group should select
    // that group (exclusively)
    mouse.clickOn(rect1);
    expect(API.getSelectedElements().length).toBe(2);
    expect(Object.keys(h.state.selectedGroupIds).length).toBe(1);
  },
);

it(
  "given element A and group of elements B and given both are selected " +
    "when user shift-clicks on B, on pointer up " +
    "only element A should be selected",
  () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Select first rectangle while keeping third one selected.
    // Third rectangle is selected because it was the last element to be created.
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create group with first and third rectangle
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });

    expect(API.getSelectedElements().length).toBe(2);
    const selectedGroupIds = Object.keys(h.state.selectedGroupIds);
    expect(selectedGroupIds.length).toBe(1);

    // Select second rectangle without deselecting group
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(110, 110);
    });
    expect(API.getSelectedElements().length).toBe(3);

    // Pointer down o first rectangle that is part of the group
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.down();
    });
    expect(API.getSelectedElements().length).toBe(3);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.up();
    });
    expect(API.getSelectedElements().length).toBe(1);
  },
);

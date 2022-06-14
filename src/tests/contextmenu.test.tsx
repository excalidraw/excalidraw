import ReactDOM from "react-dom";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  GlobalTestState,
  screen,
  queryByText,
  queryAllByText,
  waitFor,
} from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import * as Renderer from "../renderer/renderScene";
import { reseed } from "../random";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { CODES } from "../keys";
import { ShortcutName } from "../actions/shortcuts";
import { copiedStyles } from "../actions/actionStyles";
import { API } from "./helpers/api";
import { setDateTimeForTests } from "../utils";
import { t } from "../i18n";
import { LibraryItem } from "../types";

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

const mouse = new Pointer("mouse");

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("contextMenu element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<ExcalidrawApp />);
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  afterEach(() => {
    checkpoint("end of test");

    mouse.reset();
    mouse.down(0, 0);
  });

  it("shows context menu for canvas", () => {
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "selectAll",
      "gridMode",
      "zenMode",
      "viewMode",
      "stats",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedShortcutNames.length);
    expectedShortcutNames.forEach((shortcutName) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${shortcutName}"]`),
      ).not.toBeNull();
    });
  });

  it("shows context menu for element", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "copyStyles",
      "pasteStyles",
      "deleteSelectedElements",
      "addToLibrary",
      "flipHorizontal",
      "flipVertical",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "duplicateSelection",
      "hyperlink",
      "toggleLock",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedShortcutNames.length);
    expectedShortcutNames.forEach((shortcutName) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${shortcutName}"]`),
      ).not.toBeNull();
    });
  });

  it("shows context menu for element", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      height: 200,
      width: 200,
      backgroundColor: "red",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      height: 200,
      width: 200,
      backgroundColor: "red",
    });
    h.elements = [rect1, rect2];
    API.setSelectedElements([rect1]);

    // lower z-index
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(UI.queryContextMenu()).not.toBeNull();
    expect(API.getSelectedElement().id).toBe(rect1.id);

    // higher z-index
    API.setSelectedElements([rect2]);
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(UI.queryContextMenu()).not.toBeNull();
    expect(API.getSelectedElement().id).toBe(rect2.id);
  });

  it("shows 'Group selection' in context menu for multiple selected elements", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    mouse.reset();
    mouse.click(10, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(20, 0);
    });

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "copyStyles",
      "pasteStyles",
      "deleteSelectedElements",
      "group",
      "addToLibrary",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "duplicateSelection",
      "toggleLock",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedShortcutNames.length);
    expectedShortcutNames.forEach((shortcutName) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${shortcutName}"]`),
      ).not.toBeNull();
    });
  });

  it("shows 'Ungroup selection' in context menu for group inside selected elements", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(10, 10);

    UI.clickTool("rectangle");
    mouse.down(10, -10);
    mouse.up(10, 10);

    mouse.reset();
    mouse.click(10, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(20, 0);
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "copyStyles",
      "pasteStyles",
      "deleteSelectedElements",
      "ungroup",
      "addToLibrary",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "duplicateSelection",
      "toggleLock",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedShortcutNames.length);
    expectedShortcutNames.forEach((shortcutName) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${shortcutName}"]`),
      ).not.toBeNull();
    });
  });

  it("selecting 'Copy styles' in context menu copies styles", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    expect(copiedStyles).toBe("{}");
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Copy styles")!);
    expect(copiedStyles).not.toBe("{}");
    const element = JSON.parse(copiedStyles)[0];
    expect(element).toEqual(API.getSelectedElement());
  });

  it("selecting 'Paste styles' in context menu pastes styles", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    // Change some styles of second rectangle
    UI.clickLabeledElement("Stroke");
    UI.clickLabeledElement(t("colors.c92a2a"));
    UI.clickLabeledElement("Background");
    UI.clickLabeledElement(t("colors.e64980"));
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByLabelText("Opacity"), {
      target: { value: "60" },
    });

    mouse.reset();
    // Copy styles of second rectangle
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });
    let contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Copy styles")!);
    const secondRect = JSON.parse(copiedStyles)[0];
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Paste styles")!);

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe("#c92a2a");
    expect(firstRect.backgroundColor).toBe("#e64980");
    expect(firstRect.fillStyle).toBe("cross-hatch");
    expect(firstRect.strokeWidth).toBe(2); // Bold: 2
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });

  it("selecting 'Delete' in context menu deletes element", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryAllByText(contextMenu as HTMLElement, "Delete")[0]);
    expect(API.getSelectedElements()).toHaveLength(0);
    expect(h.elements[0].isDeleted).toBe(true);
  });

  it("selecting 'Add to library' in context menu adds element to library", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Add to library")!);

    await waitFor(() => {
      const library = localStorage.getItem("excalidraw-library");
      expect(library).not.toBeNull();
      const addedElement = JSON.parse(library!)[0] as LibraryItem;
      expect(addedElement.elements[0]).toEqual(h.elements[0]);
    });
  });

  it("selecting 'Duplicate' in context menu duplicates element", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Duplicate")!);
    expect(h.elements).toHaveLength(2);
    const { id: _id0, seed: _seed0, x: _x0, y: _y0, ...rect1 } = h.elements[0];
    const { id: _id1, seed: _seed1, x: _x1, y: _y1, ...rect2 } = h.elements[1];
    expect(rect1).toEqual(rect2);
  });

  it("selecting 'Send backward' in context menu sends element backward", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Send backward")!);
    expect(elementsBefore[0].id).toEqual(h.elements[1].id);
    expect(elementsBefore[1].id).toEqual(h.elements[0].id);
  });

  it("selecting 'Bring forward' in context menu brings element forward", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Bring forward")!);
    expect(elementsBefore[0].id).toEqual(h.elements[1].id);
    expect(elementsBefore[1].id).toEqual(h.elements[0].id);
  });

  it("selecting 'Send to back' in context menu sends element to back", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Send to back")!);
    expect(elementsBefore[1].id).toEqual(h.elements[0].id);
  });

  it("selecting 'Bring to front' in context menu brings element to front", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Bring to front")!);
    expect(elementsBefore[0].id).toEqual(h.elements[1].id);
  });

  it("selecting 'Group selection' in context menu groups selected elements", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(10, 10);
    });

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(
      queryByText(contextMenu as HTMLElement, "Group selection")!,
    );
    const selectedGroupIds = Object.keys(h.state.selectedGroupIds);
    expect(h.elements[0].groupIds).toEqual(selectedGroupIds);
    expect(h.elements[1].groupIds).toEqual(selectedGroupIds);
  });

  it("selecting 'Ungroup selection' in context menu ungroups selected group", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(10, 10);
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });

    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    const contextMenu = UI.queryContextMenu();
    expect(contextMenu).not.toBeNull();
    fireEvent.click(
      queryByText(contextMenu as HTMLElement, "Ungroup selection")!,
    );

    const selectedGroupIds = Object.keys(h.state.selectedGroupIds);
    expect(selectedGroupIds).toHaveLength(0);
    expect(h.elements[0].groupIds).toHaveLength(0);
    expect(h.elements[1].groupIds).toHaveLength(0);
  });

  it("right-clicking on a group should select whole group", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: ["g1"],
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: ["g1"],
    });
    h.elements = [rectangle1, rectangle2];

    mouse.rightClickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(2);
    expect(API.getSelectedElements()).toEqual([
      expect.objectContaining({ id: rectangle1.id }),
      expect.objectContaining({ id: rectangle2.id }),
    ]);
  });
});

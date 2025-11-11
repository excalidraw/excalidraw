import React from "react";
import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";

import { setDateTimeForTests } from "@excalidraw/common";

import { copiedStyles } from "../actions/actionStyles";
import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { UI, Pointer, Keyboard } from "./helpers/ui";
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
  togglePopover,
  unmountComponent,
  checkpointHistory,
} from "./test-utils";

import type { ShortcutName } from "../actions/shortcuts";
import type { ActionName } from "../actions/types";

const checkpoint = (name: string) => {
  expect(renderStaticScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );
  expect(h.state).toMatchSnapshot(`[${name}] appState`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);
  h.elements.forEach((element, i) =>
    expect(element).toMatchSnapshot(`[${name}] element ${i}`),
  );

  checkpointHistory(h.history, name);
};

const mouse = new Pointer("mouse");

unmountComponent();

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
beforeEach(() => {
  localStorage.clear();
  renderStaticScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("contextMenu element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);
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
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "paste",
      "selectAll",
      "gridMode",
      "zenMode",
      "viewMode",
      "objectsSnapMode",
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
    mouse.down(0, 0);
    mouse.up(10, 10);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedContextMenuItems: ActionName[] = [
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
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
      "copyElementLink",
      "toggleElementLock",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedContextMenuItems.length);
    expectedContextMenuItems.forEach((item) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${item}"]`),
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
    API.setElements([rect1, rect2]);
    API.setSelectedElements([rect1]);

    // lower z-index
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(UI.queryContextMenu()).not.toBeNull();
    expect(API.getSelectedElement().id).toBe(rect1.id);

    // higher z-index
    API.setSelectedElements([rect2]);
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
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
    mouse.down(12, -10);
    mouse.up(10, 10);

    mouse.reset();
    mouse.click(10, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(22, 0);
    });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });

    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedShortcutNames: ShortcutName[] = [
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
      "copyStyles",
      "pasteStyles",
      "deleteSelectedElements",
      "group",
      "addToLibrary",
      "flipHorizontal",
      "flipVertical",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "duplicateSelection",
      "toggleElementLock",
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
    mouse.down(12, -10);
    mouse.up(10, 10);

    mouse.reset();
    mouse.click(10, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click(22, 0);
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.G);
    });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });

    const contextMenu = UI.queryContextMenu();
    const contextMenuOptions =
      contextMenu?.querySelectorAll(".context-menu li");
    const expectedContextMenuItems: ActionName[] = [
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
      "copyStyles",
      "pasteStyles",
      "deleteSelectedElements",
      "copyElementLink",
      "ungroup",
      "addToLibrary",
      "flipHorizontal",
      "flipVertical",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "duplicateSelection",
      "toggleElementLock",
    ];

    expect(contextMenu).not.toBeNull();
    expect(contextMenuOptions?.length).toBe(expectedContextMenuItems.length);
    expectedContextMenuItems.forEach((item) => {
      expect(
        contextMenu?.querySelector(`li[data-testid="${item}"]`),
      ).not.toBeNull();
    });
  });

  it("selecting 'Copy styles' in context menu copies styles", () => {
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(10, 10);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    expect(copiedStyles).toBe("{}");
    fireEvent.click(queryByText(contextMenu!, "Copy styles")!);
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
    togglePopover("Stroke");
    UI.clickOnTestId("color-red");
    togglePopover("Background");
    UI.clickOnTestId("color-blue");
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByTestId("opacity"), {
      target: { value: "60" },
    });

    // closing the background popover as this blocks
    // context menu from rendering after we started focussing
    // the popover once rendered :/
    togglePopover("Background");

    mouse.reset();

    // Copy styles of second rectangle
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });

    let contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu!, "Copy styles")!);
    const secondRect = JSON.parse(copiedStyles)[0];
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu!, "Paste styles")!);

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe("#e03131");
    expect(firstRect.backgroundColor).toBe("#a5d8ff");
    expect(firstRect.fillStyle).toBe("cross-hatch");
    expect(firstRect.strokeWidth).toBe(2); // Bold: 2
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });

  it("selecting 'Delete' in context menu deletes element", () => {
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(10, 10);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryAllByText(contextMenu!, "Delete")[0]);
    expect(API.getSelectedElements()).toHaveLength(0);
    expect(h.elements[0].isDeleted).toBe(true);
  });

  it("selecting 'Add to library' in context menu adds element to library", async () => {
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(10, 10);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu!, "Add to library")!);

    await waitFor(async () => {
      const libraryItems = await h.app.library.getLatestLibrary();
      expect(libraryItems[0].elements[0]).toEqual(h.elements[0]);
    });
  });

  it("selecting 'Duplicate' in context menu duplicates element", () => {
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(10, 10);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu!, "Duplicate")!);
    expect(h.elements).toHaveLength(2);
    const {
      id: _id0,
      seed: _seed0,
      x: _x0,
      y: _y0,
      index: _fractionalIndex0,
      version: _version0,
      versionNonce: _versionNonce0,
      ...rect1
    } = h.elements[0];
    const {
      id: _id1,
      seed: _seed1,
      x: _x1,
      y: _y1,
      index: _fractionalIndex1,
      version: _version1,
      versionNonce: _versionNonce1,
      ...rect2
    } = h.elements[1];
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
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu!, "Send backward")!);
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
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu!, "Bring forward")!);
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
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu!, "Send to back")!);
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
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    const contextMenu = UI.queryContextMenu();
    const elementsBefore = h.elements;
    fireEvent.click(queryByText(contextMenu!, "Bring to front")!);
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

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByText(contextMenu!, "Group selection")!);
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
      Keyboard.keyPress(KEYS.G);
    });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 3,
      clientY: 3,
    });

    const contextMenu = UI.queryContextMenu();
    expect(contextMenu).not.toBeNull();
    fireEvent.click(queryByText(contextMenu!, "Ungroup selection")!);

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
    API.setElements([rectangle1, rectangle2]);

    mouse.rightClickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(2);
    expect(API.getSelectedElements()).toEqual([
      expect.objectContaining({ id: rectangle1.id }),
      expect.objectContaining({ id: rectangle2.id }),
    ]);
  });
});

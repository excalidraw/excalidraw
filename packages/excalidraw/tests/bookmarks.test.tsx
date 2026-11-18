import React from "react";

import {
  BOOKMARKS_SIDEBAR_TAB,
  DEFAULT_SIDEBAR,
  isDarwin,
} from "@excalidraw/common";
import { CaptureUpdateAction, LinearElementEditor } from "@excalidraw/element";

import { Excalidraw } from "../index";

import {
  actionBringToFront,
  actionDeleteSelected,
  actionNextBookmark,
  actionPreviousBookmark,
  actionSendToBack,
  actionToggleElementBookmark,
} from "../actions";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";

import { API } from "./helpers/api";
import { act, fireEvent, render, waitFor } from "./test-utils";

const pressBookmarkShortcut = (
  direction: "next" | "previous",
  target: HTMLElement | Document = document,
) => {
  fireEvent.keyDown(target, {
    code: direction === "next" ? "BracketRight" : "BracketLeft",
    key: direction === "next" ? "]" : "[",
    ctrlKey: !isDarwin,
    metaKey: isDarwin,
    altKey: true,
    shiftKey: true,
  });
};

const { h } = window;

const eraseElements = (ids: string[]) => {
  act(() => {
    // Access the private eraser handler to test deletion/history atomically.
    // eslint-disable-next-line dot-notation
    h.app["elementsPendingErasure"] = new Set(ids);
    // eslint-disable-next-line dot-notation
    h.app["eraseElements"]();
  });
};

describe("bookmarks sidebar", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      openSidebar: {
        name: DEFAULT_SIDEBAR.name,
        tab: BOOKMARKS_SIDEBAR_TAB,
      },
    });
  });

  it("undoes and redoes adding a bookmark without changing scene elements", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-history-add",
    });
    const initialElements = [element];

    API.updateScene({
      elements: initialElements,
      appState: {
        bookmarkedElementIds: [],
        selectedElementIds: { [element.id]: true },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const elementsBeforeToggle = h.elements;
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(actionToggleElementBookmark);

    expect(h.state.bookmarkedElementIds).toEqual([element.id]);
    expect(h.history.undoStack).toHaveLength(1);
    expect(h.elements).toEqual(elementsBeforeToggle);
    expect(h.history.undoStack[0].elements.isEmpty()).toBe(true);

    API.executeAction(undoAction);
    expect(h.state.bookmarkedElementIds).toEqual([]);
    expect(h.elements).toEqual(elementsBeforeToggle);

    API.executeAction(redoAction);
    expect(h.state.bookmarkedElementIds).toEqual([element.id]);
    expect(h.elements).toEqual(elementsBeforeToggle);
  });

  it("undoes and redoes removing a bookmark", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-history-remove",
    });

    API.updateScene({
      elements: [element],
      appState: {
        bookmarkedElementIds: [element.id],
        selectedElementIds: { [element.id]: true },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(actionToggleElementBookmark);
    expect(h.state.bookmarkedElementIds).toEqual([]);

    API.executeAction(undoAction);
    expect(h.state.bookmarkedElementIds).toEqual([element.id]);

    API.executeAction(redoAction);
    expect(h.state.bookmarkedElementIds).toEqual([]);
    expect(h.elements).toEqual([expect.objectContaining({ id: element.id })]);
  });

  it("preserves redo entries when recording a bookmark-only change", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-history-redo",
    });

    API.updateScene({
      elements: [element],
      appState: {
        bookmarkedElementIds: [],
        selectedElementIds: { [element.id]: true },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    API.updateScene({
      appState: { name: "history-name" },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(undoAction);
    expect(h.history.redoStack).toHaveLength(1);

    API.executeAction(actionToggleElementBookmark);

    expect(h.state.bookmarkedElementIds).toEqual([element.id]);
    expect(h.history.redoStack).toHaveLength(1);
    expect(h.history.undoStack.at(-1)?.elements.isEmpty()).toBe(true);

    API.executeAction(redoAction);
    expect(h.state.name).toBe("history-name");
    expect(h.state.bookmarkedElementIds).toEqual([element.id]);
    expect(h.elements).toEqual([expect.objectContaining({ id: element.id })]);
  });

  it("renders empty state when there are no bookmarks", async () => {
    API.setAppState({
      bookmarkedElementIds: [],
    });

    await waitFor(() => {
      const emptyState =
        h.app.excalidrawContainerValue.container?.querySelector(
          ".layer-ui__bookmarks-empty",
        );
      expect(emptyState).not.toBeNull();
      expect(emptyState?.textContent).toContain("No bookmarks yet...");
      expect(emptyState?.textContent).toContain(
        "Right-click an element to bookmark it.",
      );
    });
  });

  it("renders bookmarked elements with labels and types", async () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect-1",
      x: 0,
      y: 0,
    });
    const textElem = API.createElement({
      type: "text",
      id: "text-1",
      text: "Hello World\nSecond line",
      x: 100,
      y: 100,
    });
    const frame = {
      ...API.createElement({
        type: "frame",
        id: "frame-1",
        x: 200,
        y: 200,
      }),
      name: "My Frame",
    };

    API.setElements([rect, textElem, frame]);
    API.setAppState({
      bookmarkedElementIds: [rect.id, textElem.id, frame.id],
    });

    await waitFor(() => {
      const items = h.app.excalidrawContainerValue.container?.querySelectorAll(
        ".layer-ui__bookmarks-item",
      );
      expect(items?.length).toBe(3);

      expect(
        items?.[0].querySelector(".layer-ui__bookmarks-item-label")
          ?.textContent,
      ).toBe("Rectangle");
      expect(
        items?.[1].querySelector(".layer-ui__bookmarks-item-label")
          ?.textContent,
      ).toBe("Hello World");
      expect(
        items?.[2].querySelector(".layer-ui__bookmarks-item-label")
          ?.textContent,
      ).toBe("My Frame");
    });
  });

  it("exposes the active bookmark to assistive technology", async () => {
    const first = API.createElement({
      type: "text",
      id: "bookmark-accessibility-first",
      text: "First bookmark",
    });
    const second = API.createElement({
      type: "text",
      id: "bookmark-accessibility-second",
      text: "Second bookmark",
    });

    API.setElements([first, second]);
    API.setAppState({
      bookmarkedElementIds: [first.id, second.id],
      selectedElementIds: { [second.id]: true },
    });

    const container = h.app.excalidrawContainerValue.container;
    const getBookmark = (label: string) =>
      container?.querySelector<HTMLButtonElement>(
        `.layer-ui__bookmarks-item[aria-label="${label}"]`,
      );

    await waitFor(() => {
      expect(getBookmark("First bookmark")).not.toHaveAttribute("aria-current");
      expect(getBookmark("Second bookmark")).toHaveAttribute(
        "aria-current",
        "location",
      );
      expect(getBookmark("Second bookmark")).toHaveClass("active");
    });

    API.setAppState({ selectedElementIds: { [first.id]: true } });

    await waitFor(() => {
      expect(getBookmark("First bookmark")).toHaveAttribute(
        "aria-current",
        "location",
      );
      expect(getBookmark("First bookmark")).toHaveClass("active");
      expect(getBookmark("Second bookmark")).not.toHaveAttribute(
        "aria-current",
      );
      expect(getBookmark("Second bookmark")).not.toHaveClass("active");
    });
  });

  it("distinguishes bookmarks with duplicate labels accessibly", async () => {
    const first = API.createElement({
      type: "text",
      id: "bookmark-duplicate-label-first",
      text: "Repeated label",
    });
    const second = API.createElement({
      type: "text",
      id: "bookmark-duplicate-label-second",
      text: "Repeated label",
    });

    API.setElements([first, second]);
    API.setAppState({ bookmarkedElementIds: [first.id, second.id] });

    await waitFor(() => {
      const items =
        h.app.excalidrawContainerValue.container?.querySelectorAll<HTMLButtonElement>(
          ".layer-ui__bookmarks-item",
        );
      expect(items).toHaveLength(2);
      expect(
        items?.[0].querySelector(".layer-ui__bookmarks-item-label"),
      ).toHaveTextContent("Repeated label");
      expect(
        items?.[1].querySelector(".layer-ui__bookmarks-item-label"),
      ).toHaveTextContent("Repeated label");
      expect(items?.[0]).toHaveAccessibleName("Repeated label (1 of 2)");
      expect(items?.[1]).toHaveAccessibleName("Repeated label (2 of 2)");
    });
  });

  it("sets tooltip title and truncation styling on items for long label", async () => {
    const longText =
      "This is a very long label that should be truncated in UI but preserved in full text tooltip attribute";
    const textElem = API.createElement({
      type: "text",
      id: "text-long",
      text: longText,
    });

    API.setElements([textElem]);
    API.setAppState({
      bookmarkedElementIds: [textElem.id],
    });

    await waitFor(() => {
      const item =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
          ".layer-ui__bookmarks-item",
        );
      expect(item).not.toBeNull();
      expect(item?.getAttribute("title")).toBe(longText);

      const label = item?.querySelector<HTMLSpanElement>(
        ".layer-ui__bookmarks-item-label",
      );
      expect(label?.textContent).toBe(longText);
      expect(label).toHaveClass("layer-ui__bookmarks-item-label");

      const computedStyle = window.getComputedStyle(label as Element);
      expect(computedStyle.overflow || label?.style.overflow).toBe("hidden");
      expect(computedStyle.textOverflow || label?.style.textOverflow).toBe(
        "ellipsis",
      );
      expect(computedStyle.whiteSpace || label?.style.whiteSpace).toBe(
        "nowrap",
      );
    });
  });

  it("preserves bookmark ordering according to bookmarkedElementIds", async () => {
    const text1 = API.createElement({
      type: "text",
      id: "text-1",
      text: "First Text Element",
    });
    const text2 = API.createElement({
      type: "text",
      id: "text-2",
      text: "Second Text Element",
    });
    const text3 = API.createElement({
      type: "text",
      id: "text-3",
      text: "Third Text Element",
    });

    API.setElements([text1, text2, text3]);
    // Bookmarks in distinct custom order: [3, 1, 2]
    API.setAppState({
      bookmarkedElementIds: [text3.id, text1.id, text2.id],
    });

    await waitFor(() => {
      const items = h.app.excalidrawContainerValue.container?.querySelectorAll(
        ".layer-ui__bookmarks-item-label",
      );
      expect(items?.length).toBe(3);

      const labels = Array.from(items || []).map((el) => el.textContent);
      expect(labels).toEqual([
        "Third Text Element",
        "First Text Element",
        "Second Text Element",
      ]);
    });
  });

  it("does not revalidate bookmarks on app state-only updates", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-app-state-update",
    });

    API.setElements([element]);
    API.setAppState({ bookmarkedElementIds: [element.id] });

    const getElementSpy = vi.spyOn(h.app.scene, "getElement");
    API.setAppState({ name: "App state-only update" });

    await waitFor(() => {
      expect(h.state.name).toBe("App state-only update");
    });

    expect(getElementSpy).not.toHaveBeenCalled();
    getElementSpy.mockRestore();
    expect(h.state.bookmarkedElementIds).toEqual([element.id]);
  });

  it("excludes deleted or non-existent elements from the bookmarks list", async () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect-live",
    });
    const deletedRect = API.createElement({
      type: "rectangle",
      id: "rect-deleted",
      isDeleted: true,
    });

    API.setElements([rect, deletedRect]);
    API.setAppState({
      bookmarkedElementIds: [rect.id, deletedRect.id, "missing-id"],
    });

    await waitFor(() => {
      const items = h.app.excalidrawContainerValue.container?.querySelectorAll(
        ".layer-ui__bookmarks-item",
      );
      expect(items?.length).toBe(1);
    });
  });

  it("clicking a bookmark navigates viewport, focuses container, and selects element", async () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect-target",
      x: 300,
      y: 400,
      width: 100,
      height: 100,
    });

    API.setElements([rect]);
    API.setAppState({
      bookmarkedElementIds: [rect.id],
      selectedElementIds: {},
    });

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");
    const focusContainerSpy = vi.spyOn(h.app, "focusContainer");

    await waitFor(() => {
      const item =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
          ".layer-ui__bookmarks-item",
        );
      expect(item).not.toBeNull();
    });

    const item =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
        ".layer-ui__bookmarks-item",
      )!;

    act(() => {
      fireEvent.click(item);
    });

    expect(setViewportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ id: rect.id }),
        fit: "scale-down",
      }),
    );
    expect(focusContainerSpy).toHaveBeenCalled();
    expect(h.app.state.selectedElementIds[rect.id]).toBe(true);
    expect(item).toHaveClass("active");
  });

  it("supports focus and click interaction for bookmark items", async () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect-keyboard",
    });

    API.setElements([rect]);
    API.setAppState({
      bookmarkedElementIds: [rect.id],
      selectedElementIds: {},
    });

    await waitFor(() => {
      const button =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
          "button.layer-ui__bookmarks-item",
        );
      expect(button).not.toBeNull();
      expect(button?.tagName.toLowerCase()).toBe("button");
      expect(button?.getAttribute("type")).toBe("button");
      expect(button?.getAttribute("aria-label")).toBe("Rectangle");
    });

    const button =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
        "button.layer-ui__bookmarks-item",
      )!;

    // Verify the button is in the natural tab order (not excluded via tabIndex=-1)
    expect(button.tabIndex).not.toBe(-1);

    // Verify focusability
    button.focus();
    expect(document.activeElement).toBe(button);

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    // Clicking the focused bookmark item navigates to its element.
    act(() => {
      fireEvent.click(button);
    });
    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    expect(h.app.state.selectedElementIds[rect.id]).toBe(true);

    setViewportSpy.mockClear();
    API.setAppState({ selectedElementIds: {} });

    // Clicking again after clearing selection also navigates to its element.
    act(() => {
      fireEvent.click(button);
    });
    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    expect(h.app.state.selectedElementIds[rect.id]).toBe(true);
  });

  it("resolves bound-text labels on container elements", async () => {
    const textElem = API.createElement({
      type: "text",
      id: "bound-text-1",
      containerId: "rect-container-1",
      text: "Container Header\nSecond line description",
    });
    const containerRect = API.createElement({
      type: "rectangle",
      id: "rect-container-1",
      boundElements: [{ id: "bound-text-1", type: "text" }],
    });

    API.setElements([containerRect, textElem]);
    API.setAppState({
      bookmarkedElementIds: [containerRect.id],
    });

    await waitFor(() => {
      const item = h.app.excalidrawContainerValue.container?.querySelector(
        ".layer-ui__bookmarks-item-label",
      );
      expect(item?.textContent).toBe("Container Header");
    });
  });

  it("resolves fallback labels for unlabeled elements", async () => {
    const diamond = API.createElement({ type: "diamond", id: "diamond-1" });
    const ellipse = API.createElement({ type: "ellipse", id: "ellipse-1" });
    const arrow = API.createElement({ type: "arrow", id: "arrow-1" });
    const line = API.createElement({ type: "line", id: "line-1" });
    const freedraw = API.createElement({ type: "freedraw", id: "freedraw-1" });

    API.setElements([diamond, ellipse, arrow, line, freedraw]);
    API.setAppState({
      bookmarkedElementIds: [
        diamond.id,
        ellipse.id,
        arrow.id,
        line.id,
        freedraw.id,
      ],
    });

    await waitFor(() => {
      const labels = Array.from(
        h.app.excalidrawContainerValue.container?.querySelectorAll(
          ".layer-ui__bookmarks-item-label",
        ) || [],
      ).map((el) => el.textContent);

      expect(labels).toEqual([
        "Diamond",
        "Ellipse",
        "Arrow",
        "Line",
        "Freedraw",
      ]);
    });
  });

  it("reactively updates label when a frame name changes", async () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        id: "frame-renamed",
      }),
      name: "Original Frame Name",
    };

    API.setElements([frame]);
    API.setAppState({
      bookmarkedElementIds: [frame.id],
    });

    await waitFor(() => {
      const label = h.app.excalidrawContainerValue.container?.querySelector(
        ".layer-ui__bookmarks-item-label",
      );
      expect(label?.textContent).toBe("Original Frame Name");
    });

    // Update frame name
    API.setElements([
      {
        ...frame,
        name: "Renamed Frame Title",
      },
    ]);

    await waitFor(() => {
      const label = h.app.excalidrawContainerValue.container?.querySelector(
        ".layer-ui__bookmarks-item-label",
      );
      expect(label?.textContent).toBe("Renamed Frame Title");
    });
  });

  it("navigates next and previous in bookmark order", async () => {
    const first = API.createElement({
      type: "rectangle",
      id: "bookmark-first",
    });
    const second = API.createElement({
      type: "ellipse",
      id: "bookmark-second",
    });
    const third = API.createElement({ type: "diamond", id: "bookmark-third" });

    API.setElements([first, second, third]);
    API.setAppState({
      bookmarkedElementIds: [second.id, third.id, first.id],
      selectedElementIds: {},
    });

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    act(() => pressBookmarkShortcut("next"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[second.id]).toBe(true);
    });
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ id: second.id }),
      }),
    );

    act(() => pressBookmarkShortcut("previous"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[second.id]).toBeFalsy();
      expect(h.app.state.selectedElementIds[first.id]).toBe(true);
    });
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ id: first.id }),
      }),
    );
    expect(h.app.state.selectedGroupIds).toEqual({});
    expect(h.app.state.editingGroupId).toBeNull();
    expect(h.app.state.selectedLinearElement).toBeNull();
  });

  it("wraps at both ends of the bookmark order", async () => {
    const first = API.createElement({
      type: "rectangle",
      id: "bookmark-wrap-first",
    });
    const second = API.createElement({
      type: "ellipse",
      id: "bookmark-wrap-second",
    });

    API.setElements([first, second]);
    API.setAppState({
      bookmarkedElementIds: [first.id, second.id],
      selectedElementIds: { [second.id]: true },
    });

    act(() => pressBookmarkShortcut("next"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[first.id]).toBe(true);
    });

    act(() => pressBookmarkShortcut("previous"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[second.id]).toBe(true);
    });
  });

  it("starts at the appropriate end when the current selection is not bookmarked", async () => {
    const first = API.createElement({
      type: "rectangle",
      id: "bookmark-start-first",
    });
    const last = API.createElement({
      type: "ellipse",
      id: "bookmark-start-last",
    });
    const unbookmarked = API.createElement({
      type: "diamond",
      id: "bookmark-start-unbookmarked",
    });

    API.setElements([first, last, unbookmarked]);
    API.setAppState({
      bookmarkedElementIds: [first.id, last.id],
      selectedElementIds: { [unbookmarked.id]: true },
    });

    act(() => pressBookmarkShortcut("next"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[first.id]).toBe(true);
    });

    API.setAppState({ selectedElementIds: { [unbookmarked.id]: true } });
    act(() => pressBookmarkShortcut("previous"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[last.id]).toBe(true);
    });
  });

  it("uses the first selected bookmark in bookmark order as the anchor", async () => {
    const first = API.createElement({
      type: "rectangle",
      id: "bookmark-multi-first",
    });
    const second = API.createElement({
      type: "ellipse",
      id: "bookmark-multi-second",
    });
    const third = API.createElement({
      type: "diamond",
      id: "bookmark-multi-third",
    });

    API.setElements([first, second, third]);
    API.setAppState({
      bookmarkedElementIds: [third.id, first.id, second.id],
      selectedElementIds: {
        [second.id]: true,
        [third.id]: true,
      },
    });

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    act(() => pressBookmarkShortcut("next"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[first.id]).toBe(true);
    });
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ id: first.id }),
      }),
    );
  });

  it("skips stale and deleted bookmark IDs", async () => {
    const deleted = API.createElement({
      type: "rectangle",
      id: "bookmark-deleted",
      isDeleted: true,
    });
    const first = API.createElement({
      type: "ellipse",
      id: "bookmark-valid-first",
    });
    const last = API.createElement({
      type: "diamond",
      id: "bookmark-valid-last",
    });

    API.setElements([deleted, first, last]);
    API.setAppState({
      bookmarkedElementIds: ["bookmark-missing", deleted.id, first.id, last.id],
      selectedElementIds: { [last.id]: true },
    });

    act(() => pressBookmarkShortcut("next"));

    await waitFor(() => {
      expect(h.app.state.selectedElementIds[first.id]).toBe(true);
    });
  });

  it("does nothing when no valid bookmarks exist", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-empty-selection",
    });

    API.setElements([element]);
    API.setAppState({
      bookmarkedElementIds: [],
      selectedElementIds: { [element.id]: true },
    });

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    act(() => pressBookmarkShortcut("next"));
    act(() => pressBookmarkShortcut("previous"));

    expect(setViewportSpy).not.toHaveBeenCalled();
    expect(h.app.state.selectedElementIds).toEqual({ [element.id]: true });
  });

  it("does not navigate from writable inputs or while a dialog is open", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "bookmark-shortcut-guard",
    });
    API.setElements([element]);
    API.setAppState({ bookmarkedElementIds: [element.id] });
    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    const container = h.app.excalidrawContainerValue.container!;
    const input = document.createElement("input");
    container.appendChild(input);

    act(() => pressBookmarkShortcut("next", input));
    expect(setViewportSpy).not.toHaveBeenCalled();

    input.remove();
    API.setAppState({ openDialog: { name: "help" } });

    act(() => pressBookmarkShortcut("next"));

    expect(setViewportSpy).not.toHaveBeenCalled();
  });

  it("ignores bookmark shortcuts while a linear element is being edited", async () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "bookmark-editing-arrow",
    });
    const target = API.createElement({
      type: "rectangle",
      id: "bookmark-editing-target",
    });
    API.setElements([arrow, target]);
    API.setAppState({ bookmarkedElementIds: [target.id] });
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...new LinearElementEditor(
            arrow,
            h.app.scene.getElementsMapIncludingDeleted(),
          ),
          isEditing: true,
        },
      });
    });

    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");

    act(() => pressBookmarkShortcut("next"));

    expect(setViewportSpy).not.toHaveBeenCalled();
  });

  it("uses a distinct chord from the existing layer-order shortcuts", () => {
    const nextEvent = new KeyboardEvent("keydown", {
      code: "BracketRight",
      key: "]",
      ctrlKey: true,
      metaKey: true,
      altKey: true,
      shiftKey: true,
    });
    const previousEvent = new KeyboardEvent("keydown", {
      code: "BracketLeft",
      key: "[",
      ctrlKey: true,
      metaKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(actionNextBookmark.keyTest?.(nextEvent, h.app.state)).toBe(true);
    expect(actionPreviousBookmark.keyTest?.(previousEvent, h.app.state)).toBe(
      true,
    );
    expect(actionBringToFront.keyTest?.(nextEvent)).toBe(false);
    expect(actionSendToBack.keyTest?.(previousEvent)).toBe(false);

    const sendToBackEvent = new KeyboardEvent("keydown", {
      code: "BracketLeft",
      ctrlKey: !isDarwin,
      metaKey: isDarwin,
      altKey: isDarwin,
      shiftKey: !isDarwin,
    });
    const bringToFrontEvent = new KeyboardEvent("keydown", {
      code: "BracketRight",
      ctrlKey: !isDarwin,
      metaKey: isDarwin,
      altKey: isDarwin,
      shiftKey: !isDarwin,
    });
    expect(actionSendToBack.keyTest?.(sendToBackEvent)).toBe(true);
    expect(actionBringToFront.keyTest?.(bringToFrontEvent)).toBe(true);

    expect(actionNextBookmark.navigation).toBe(true);
    expect(actionNextBookmark.viewMode).toBe(true);

    const editingTextElement = API.createElement({
      type: "text",
      id: "bookmark-editing-text",
    });
    expect(
      actionNextBookmark.keyTest?.(nextEvent, {
        ...h.app.state,
        editingTextElement,
      }),
    ).toBe(false);
  });

  it("preserves order of remaining bookmarks when one bookmark is deleted", async () => {
    const textA = API.createElement({
      type: "text",
      id: "text-a",
      text: "Item A",
    });
    const textB = API.createElement({
      type: "text",
      id: "text-b",
      text: "Item B",
    });
    const textC = API.createElement({
      type: "text",
      id: "text-c",
      text: "Item C",
    });

    API.setElements([textA, textB, textC]);
    API.setAppState({
      bookmarkedElementIds: [textA.id, textB.id, textC.id],
    });

    await waitFor(() => {
      const labels = Array.from(
        h.app.excalidrawContainerValue.container?.querySelectorAll(
          ".layer-ui__bookmarks-item-label",
        ) || [],
      ).map((el) => el.textContent);
      expect(labels).toEqual(["Item A", "Item B", "Item C"]);
    });

    // Delete item B (mark isDeleted)
    API.setElements([
      textA,
      {
        ...textB,
        isDeleted: true,
      },
      textC,
    ]);

    await waitFor(() => {
      const labels = Array.from(
        h.app.excalidrawContainerValue.container?.querySelectorAll(
          ".layer-ui__bookmarks-item-label",
        ) || [],
      ).map((el) => el.textContent);
      expect(labels).toEqual(["Item A", "Item C"]);
    });
  });

  it("undoes and redoes deletion of a bookmarked element with its bookmark", () => {
    const first = API.createElement({ type: "rectangle", id: "delete-first" });
    const target = API.createElement({
      type: "rectangle",
      id: "delete-target",
    });
    const last = API.createElement({ type: "rectangle", id: "delete-last" });
    const originalBookmarks = [first.id, target.id, last.id];

    API.updateScene({
      elements: [first, target, last],
      appState: {
        bookmarkedElementIds: originalBookmarks,
        selectedElementIds: { [target.id]: true },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(actionDeleteSelected);

    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(true);
    expect(h.state.bookmarkedElementIds).toEqual([first.id, last.id]);

    API.executeAction(undoAction);
    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(false);
    expect(h.state.bookmarkedElementIds).toEqual(originalBookmarks);

    API.executeAction(redoAction);
    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(true);
    expect(h.state.bookmarkedElementIds).toEqual([first.id, last.id]);
  });

  it("cleans only deleted bookmarks when deleting multiple elements", () => {
    const first = API.createElement({ type: "rectangle", id: "multi-first" });
    const deletedBookmark = API.createElement({
      type: "rectangle",
      id: "multi-delete-bookmark",
    });
    const unbookmarked = API.createElement({
      type: "rectangle",
      id: "multi-delete-unbookmarked",
    });
    const middle = API.createElement({ type: "rectangle", id: "multi-middle" });
    const secondDeletedBookmark = API.createElement({
      type: "rectangle",
      id: "multi-delete-second-bookmark",
    });
    const last = API.createElement({ type: "rectangle", id: "multi-last" });
    const originalBookmarks = [
      first.id,
      deletedBookmark.id,
      middle.id,
      secondDeletedBookmark.id,
      last.id,
    ];

    API.updateScene({
      elements: [
        first,
        deletedBookmark,
        unbookmarked,
        middle,
        secondDeletedBookmark,
        last,
      ],
      appState: {
        bookmarkedElementIds: originalBookmarks,
        selectedElementIds: {
          [deletedBookmark.id]: true,
          [unbookmarked.id]: true,
          [secondDeletedBookmark.id]: true,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(actionDeleteSelected);

    expect(h.state.bookmarkedElementIds).toEqual([
      first.id,
      middle.id,
      last.id,
    ]);
    expect(
      h.elements
        .filter((element) =>
          [
            deletedBookmark.id,
            unbookmarked.id,
            secondDeletedBookmark.id,
          ].includes(element.id),
        )
        .map((element) => element.isDeleted),
    ).toEqual([true, true, true]);

    API.executeAction(undoAction);
    expect(h.state.bookmarkedElementIds).toEqual(originalBookmarks);
    expect(
      h.elements
        .filter((element) => element.id === unbookmarked.id)
        .map((element) => element.isDeleted),
    ).toEqual([false]);

    API.executeAction(redoAction);
    expect(h.state.bookmarkedElementIds).toEqual([
      first.id,
      middle.id,
      last.id,
    ]);
    expect(
      h.elements
        .filter((element) =>
          [
            deletedBookmark.id,
            unbookmarked.id,
            secondDeletedBookmark.id,
          ].includes(element.id),
        )
        .map((element) => element.isDeleted),
    ).toEqual([true, true, true]);
  });

  it("undoes and redoes erasing a bookmarked element with its bookmark", () => {
    const first = API.createElement({
      type: "rectangle",
      id: "erase-bookmark-first",
      x: -40,
      y: -20,
      width: 40,
      height: 40,
    });
    const target = API.createElement({
      type: "rectangle",
      id: "erase-bookmark-target",
      x: 20,
      y: -20,
      width: 40,
      height: 40,
    });
    const last = API.createElement({
      type: "rectangle",
      id: "erase-bookmark-last",
      x: 80,
      y: -20,
      width: 40,
      height: 40,
    });
    const originalBookmarks = [first.id, target.id, last.id];

    API.updateScene({
      elements: [first, target, last],
      appState: { bookmarkedElementIds: originalBookmarks },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    eraseElements([target.id]);

    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(true);
    expect(h.state.bookmarkedElementIds).toEqual([first.id, last.id]);

    API.executeAction(undoAction);
    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(false);
    expect(h.state.bookmarkedElementIds).toEqual(originalBookmarks);

    API.executeAction(redoAction);
    expect(
      h.elements.find((element) => element.id === target.id)?.isDeleted,
    ).toBe(true);
    expect(h.state.bookmarkedElementIds).toEqual([first.id, last.id]);
  });

  it("preserves remaining bookmark order when erasing multiple elements", () => {
    const first = API.createElement({
      type: "rectangle",
      id: "erase-multi-first",
    });
    const erasedBookmark = API.createElement({
      type: "rectangle",
      id: "erase-multi-second",
    });
    const erasedUnbookmarked = API.createElement({
      type: "rectangle",
      id: "erase-multi-unbookmarked",
    });
    const remainingBookmark = API.createElement({
      type: "rectangle",
      id: "erase-multi-third",
    });
    const secondErasedBookmark = API.createElement({
      type: "rectangle",
      id: "erase-multi-fourth",
    });
    const elements = [
      first,
      erasedBookmark,
      erasedUnbookmarked,
      remainingBookmark,
      secondErasedBookmark,
    ];
    const originalBookmarks = [
      first.id,
      erasedBookmark.id,
      remainingBookmark.id,
      secondErasedBookmark.id,
    ];

    API.updateScene({
      elements,
      appState: { bookmarkedElementIds: originalBookmarks },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    h.history.clear();
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    eraseElements([
      erasedBookmark.id,
      erasedUnbookmarked.id,
      secondErasedBookmark.id,
    ]);

    expect(
      h.elements
        .filter((element) =>
          elements.some((original) => original.id === element.id),
        )
        .map((element) => element.isDeleted),
    ).toEqual([false, true, true, false, true]);
    expect(h.state.bookmarkedElementIds).toEqual([
      first.id,
      remainingBookmark.id,
    ]);

    API.executeAction(undoAction);
    expect(h.state.bookmarkedElementIds).toEqual(originalBookmarks);
    expect(
      h.elements
        .filter((element) =>
          elements.some((original) => original.id === element.id),
        )
        .map((element) => element.isDeleted),
    ).toEqual([false, false, false, false, false]);

    API.executeAction(redoAction);
    expect(h.state.bookmarkedElementIds).toEqual([
      first.id,
      remainingBookmark.id,
    ]);
    expect(
      h.elements
        .filter((element) =>
          elements.some((original) => original.id === element.id),
        )
        .map((element) => element.isDeleted),
    ).toEqual([false, true, true, false, true]);
  });

  it("clicking a bookmark belonging to a group selects only the bookmarked element", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect-in-group-1",
      groupIds: ["group-shared"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      id: "rect-in-group-2",
      groupIds: ["group-shared"],
    });

    API.setElements([rect1, rect2]);
    API.setAppState({
      bookmarkedElementIds: [rect1.id],
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    });

    await waitFor(() => {
      const item =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
          ".layer-ui__bookmarks-item",
        );
      expect(item).not.toBeNull();
    });

    const item =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
        ".layer-ui__bookmarks-item",
      )!;

    act(() => {
      fireEvent.click(item);
    });

    // Verify direct-element selection is preserved (not expanded to the group)
    expect(h.app.state.selectedElementIds[rect1.id]).toBe(true);
    expect(h.app.state.selectedElementIds[rect2.id]).toBeFalsy();
    expect(h.app.state.selectedGroupIds).toEqual({});
    expect(h.app.state.editingGroupId).toBeNull();
  });

  it("verifies sidebar tab trigger has accessible title and aria-label", async () => {
    const trigger =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
        `button.sidebar-tab-trigger[data-state][value="${BOOKMARKS_SIDEBAR_TAB}"]`,
      ) ||
      h.app.excalidrawContainerValue.container?.querySelector<HTMLButtonElement>(
        `button[title="Bookmarks"]`,
      );

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("title")).toBe("Bookmarks");
    expect(trigger?.getAttribute("aria-label")).toBe("Bookmarks");
  });
});

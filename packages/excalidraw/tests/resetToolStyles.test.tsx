import React from "react";

import { actionResetToolStyles } from "../actions/actionResetToolStyles";
import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const changedStyles = {
  currentItemStrokeColor: "#e03131",
  currentItemBackgroundColor: "#a5d8ff",
  currentItemFillStyle: "solid",
  currentItemStrokeWidthKey: "bold",
  currentItemStrokeStyle: "dotted",
  currentItemRoughness: 2,
  currentItemOpacity: 40,
  currentItemFontFamily: 3,
  currentItemFontSize: 48,
  currentItemTextAlign: "right",
  currentItemStartArrowhead: "circle",
  currentItemEndArrowhead: "triangle",
  currentItemRoundness: "round",
  currentItemArrowType: "elbow",
  currentItemStrokeVariability: "variable",
  currentItemStickynoteStrokeColor: "#e03131",
  currentItemStickynoteBackgroundColor: "#a5d8ff",
} as const;

describe("reset tool styles", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    mouse.reset();
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("resets all creation styles from the main menu", () => {
    API.setAppState(changedStyles);
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByTestId("reset-tool-styles"));

    const defaults = getDefaultAppState();
    for (const key of Object.keys(
      changedStyles,
    ) as (keyof typeof changedStyles)[]) {
      expect(h.state[key]).toEqual(defaults[key]);
    }
  });

  it("preserves selected elements, tool, canvas settings, and undo history", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
      opacity: 40,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    API.setAppState({
      ...changedStyles,
      viewBackgroundColor: "#ffff00",
      scrollX: 120,
      scrollY: 240,
      gridModeEnabled: true,
    });
    const before = h.state;
    const elements = JSON.stringify(h.elements);
    const historyLength = API.getUndoStack().length;

    API.executeAction(actionResetToolStyles);

    expect(JSON.stringify(h.elements)).toBe(elements);
    expect(h.state.selectedElementIds).toEqual(before.selectedElementIds);
    expect(h.state.activeTool).toEqual(before.activeTool);
    expect(h.state.viewBackgroundColor).toBe(before.viewBackgroundColor);
    expect(h.state.scrollX).toBe(before.scrollX);
    expect(h.state.scrollY).toBe(before.scrollY);
    expect(h.state.zoom).toEqual(before.zoom);
    expect(h.state.gridModeEnabled).toBe(true);
    expect(API.getUndoStack()).toHaveLength(historyLength);
  });

  it("uses restored styles for the next drawing without changing the previous one", () => {
    API.setAppState(changedStyles);
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);
    const first = JSON.stringify(h.elements[0]);

    API.executeAction(actionResetToolStyles);
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(300, 300);

    expect(JSON.stringify(h.elements[0])).toBe(first);
    expect(h.elements[1]).toMatchObject({
      strokeColor: getDefaultAppState().currentItemStrokeColor,
      backgroundColor: getDefaultAppState().currentItemBackgroundColor,
      fillStyle: getDefaultAppState().currentItemFillStyle,
      opacity: getDefaultAppState().currentItemOpacity,
      strokeStyle: getDefaultAppState().currentItemStrokeStyle,
    });
  });

  it("hides the menu action in view mode", () => {
    API.setAppState({ viewModeEnabled: true });
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    expect(screen.queryByTestId("reset-tool-styles")).not.toBeInTheDocument();
  });
});

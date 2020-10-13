import React from "react";
import { render } from "./test-utils";
import App from "../components/App";
import { UI } from "./helpers/ui";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";
import { waitFor } from "@testing-library/react";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";

const { h } = window;

describe("history", () => {
  it("initializing scene should end up with single history entry", async () => {
    render(
      <App
        initialData={{
          appState: {
            ...getDefaultAppState(),
            zenModeEnabled: true,
          },
          elements: [API.createElement({ type: "rectangle", id: "A" })],
        }}
      />,
    );

    await waitFor(() => expect(h.state.zenModeEnabled).toBe(true));
    await waitFor(() =>
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]),
    );
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
    ]);
    const rectangle = UI.createElement("rectangle");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A" }),
      expect.objectContaining({ id: rectangle.id }),
    ]);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: true }),
    ]);

    // noop
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: true }),
    ]);
    expect(API.getStateHistory().length).toBe(1);

    h.app.actionManager.executeAction(redoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: false }),
    ]);
    expect(API.getStateHistory().length).toBe(2);
  });

  it("scene import via drag&drop should create new history entry", async () => {
    render(
      <App
        initialData={{
          appState: {
            ...getDefaultAppState(),
            viewBackgroundColor: "#FFF",
          },
          elements: [API.createElement({ type: "rectangle", id: "A" })],
        }}
      />,
    );

    await waitFor(() => expect(h.state.viewBackgroundColor).toBe("#FFF"));
    await waitFor(() =>
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]),
    );

    API.dropFile({
      appState: {
        ...getDefaultAppState(),
        viewBackgroundColor: "#000",
      },
      elements: [API.createElement({ type: "rectangle", id: "B" })],
    });

    await waitFor(() => expect(API.getStateHistory().length).toBe(2));
    expect(h.state.viewBackgroundColor).toBe("#000");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "B", isDeleted: false }),
    ]);

    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: "B", isDeleted: true }),
    ]);
    expect(h.state.viewBackgroundColor).toBe("#FFF");
    h.app.actionManager.executeAction(redoAction);
    expect(h.state.viewBackgroundColor).toBe("#000");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "B", isDeleted: false }),
      expect.objectContaining({ id: "A", isDeleted: true }),
    ]);
  });
});

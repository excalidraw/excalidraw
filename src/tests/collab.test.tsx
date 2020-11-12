import React from "react";
import { render, waitFor } from "./test-utils";
import AppWithCollab from "../excalidraw-app";
import { API } from "./helpers/api";
import { createUndoAction } from "../actions/actionHistory";
import * as localStorage from "../data/localStorage";
const { h } = window;

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

Object.defineProperty(window, "confirm", {
  value: () => false,
});

const importFromLocalStorageSpy = jest.spyOn(
  localStorage,
  "importFromLocalStorage",
);

jest.mock("../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
  };
});

jest.mock("socket.io-client", () => {
  return () => {
    return {
      close: () => {},
      on: () => {},
      off: () => {},
      emit: () => {},
    };
  };
});

describe("collaboration", () => {
  it("creating room should reset deleted elements", async () => {
    importFromLocalStorageSpy.mockImplementation(() => ({
      elements: [
        API.createElement({ type: "rectangle", id: "A" }),
        API.createElement({
          type: "rectangle",
          id: "B",
          isDeleted: true,
        }),
      ],
      appState: null,
    }));
    await render(<AppWithCollab />);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(API.getStateHistory().length).toBe(1);
    });
    // FIXME haven't investigated why we need this
    await new Promise((r) => setTimeout(r, 500));
    h.collab.openPortal();
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      expect(API.getStateHistory().length).toBe(1);
    });

    const undoAction = createUndoAction(h.history);
    // noop
    h.app.actionManager.executeAction(undoAction);
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      expect(API.getStateHistory().length).toBe(1);
    });
  });
});

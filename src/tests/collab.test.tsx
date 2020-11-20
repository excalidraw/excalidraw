import React from "react";
import { render, storageMock, waitFor } from "./test-utils";
import AppWithCollab from "../excalidraw-app";
import { API } from "./helpers/api";
import { createUndoAction } from "../actions/actionHistory";
import { STORAGE_KEYS } from "../constants";
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
    storageMock.getItem({
      [STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS]: [
        API.createElement({ type: "rectangle", id: "A" }),
        API.createElement({
          type: "rectangle",
          id: "B",
          isDeleted: true,
        }),
      ],
    });

    await render(<AppWithCollab />);

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

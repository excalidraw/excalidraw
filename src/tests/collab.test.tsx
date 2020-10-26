import React from "react";
import { render, waitFor } from "./test-utils";
import App from "../components/App";
import { API } from "./helpers/api";
import { createUndoAction } from "../actions/actionHistory";

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

jest.mock("../data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
  };
});

describe("collaboration", () => {
  it("creating room should reset deleted elements", async () => {
    render(
      <App
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", id: "A" }),
            API.createElement({ type: "rectangle", id: "B", isDeleted: true }),
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(API.getStateHistory().length).toBe(1);
    });

    h.app.openPortal();
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

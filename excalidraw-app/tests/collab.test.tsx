import { vi } from "vitest";
import {
  render,
  updateSceneData,
  waitFor,
} from "../../packages/excalidraw/tests/test-utils";
import ExcalidrawApp from "../App";
import { API } from "../../packages/excalidraw/tests/helpers/api";
import { createUndoAction } from "../../packages/excalidraw/actions/actionHistory";
import { syncInvalidIndices } from "../../packages/excalidraw/fractionalIndex";

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

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;
  const loadFilesFromFirebase = async () => ({
    loadedFiles: [],
    erroredFiles: [],
  });
  const saveFilesToFirebase = async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  });

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
    loadFilesFromFirebase,
    saveFilesToFirebase,
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => {
      return {
        close: () => {},
        on: () => {},
        once: () => {},
        off: () => {},
        emit: () => {},
      };
    },
  };
});

describe("collaboration", () => {
  it("creating room should reset deleted elements", async () => {
    await render(<ExcalidrawApp />);
    // To update the scene with deleted elements before starting collab
    updateSceneData({
      elements: syncInvalidIndices([
        API.createElement({ type: "rectangle", id: "A" }),
        API.createElement({
          type: "rectangle",
          id: "B",
          isDeleted: true,
        }),
      ]),
    });
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(API.getStateHistory().length).toBe(1);
    });
    window.collab.startCollaboration(null);
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

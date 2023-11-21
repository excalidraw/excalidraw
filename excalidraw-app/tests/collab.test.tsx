import { vi } from "vitest";
import { render, updateSceneData, waitFor } from "../../src/tests/test-utils";
import ExcalidrawApp from "../../excalidraw-app";
import { API } from "../../src/tests/helpers/api";
import { createUndoAction } from "../../src/actions/actionHistory";
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

vi.mock("../../excalidraw-app/data/index.ts", async (importActual) => {
  const module = (await importActual()) as any;
  return {
    __esmodule: true,
    ...module,
    getCollabServer: vi.fn(() => ({
      url: /* doesn't really matter */ "http://localhost:3002",
    })),
  };
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
  it("creating room should reset deleted elements while keeping store snapshot in sync", async () => {
    await render(<ExcalidrawApp />);
    // To update the scene with deleted elements before starting collab
    updateSceneData({
      elements: [
        API.createElement({ type: "rectangle", id: "A" }),
        API.createElement({
          type: "rectangle",
          id: "B",
          isDeleted: true,
        }),
      ],
      commitToStore: true,
    });
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(Array.from(h.store.snapshot.elements.values())).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
    });
    window.collab.startCollaboration(null);
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      // We never delete from the local store as it is used for correct diff calculation
      expect(Array.from(h.store.snapshot.elements.values())).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
    });

    const undoAction = createUndoAction(h.history);
    // noop
    h.app.actionManager.executeAction(undoAction);

    // As it was introduced #2270, undo is a noop here, but we might want to re-enable it,
    // since inability to undo your own deletions could be a bigger upsetting factor here
    await waitFor(() => {
      expect(h.history.isUndoStackEmpty).toBeTruthy();
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      expect(Array.from(h.store.snapshot.elements.values())).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
    });
  });
});

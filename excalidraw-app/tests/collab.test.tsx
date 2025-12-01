import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import {
  createRedoAction,
  createUndoAction,
} from "@excalidraw/excalidraw/actions/actionHistory";
import { syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";
// Replace with correct import path or define EVENT locally if not available
const EVENT = {
  POINTER_MOVE: "pointermove",
  VISIBILITY_CHANGE: "visibilitychange",
};

import { StoreIncrement } from "@excalidraw/element";

import type { DurableIncrement, EphemeralIncrement } from "@excalidraw/element";

import ExcalidrawApp from "../App";
import Collab from "excalidraw-app/collab/Collab";

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

/**
 * These test would deserve to be extended by testing collab with (at least) two clients simultanouesly,
 * while having access to both scenes, appstates stores, histories and etc.
 * i.e. multiplayer history tests could be a good first candidate, as we could test both history stacks simultaneously.
 */
describe("collaboration", () => {
  it("should emit two ephemeral increments even though updates get batched", async () => {
    const durableIncrements: DurableIncrement[] = [];
    const ephemeralIncrements: EphemeralIncrement[] = [];

    await render(<ExcalidrawApp />);

    h.store.onStoreIncrementEmitter.on((increment) => {
      if (StoreIncrement.isDurable(increment)) {
        durableIncrements.push(increment);
      } else {
        ephemeralIncrements.push(increment);
      }
    });

    // eslint-disable-next-line dot-notation
    expect(h.store["scheduledMicroActions"].length).toBe(0);
    expect(durableIncrements.length).toBe(0);
    expect(ephemeralIncrements.length).toBe(0);

    const rectProps = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
      x: 0,
      y: 0,
    } as const;

    const rect = API.createElement({ ...rectProps });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      expect(durableIncrements.length).toBe(1);
    });

    // simulate two batched remote updates
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 200 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(2);
    });

    await waitFor(() => {
      expect(ephemeralIncrements.length).toBe(2);
      expect(ephemeralIncrements[0].change.elements.A).toEqual(
        expect.objectContaining({ x: 100 }),
      );
      expect(ephemeralIncrements[1].change.elements.A).toEqual(
        expect.objectContaining({ x: 200 }),
      );
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(0);
    });
  });

  it("should allow to undo / redo even on force-deleted elements", async () => {
    await render(<ExcalidrawApp />);
    const rect1Props = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
    } as const;

    const rect2Props = {
      type: "rectangle",
      id: "B",
      width: 100,
      height: 200,
    } as const;

    const rect1 = API.createElement({ ...rect1Props });
    const rect2 = API.createElement({ ...rect2Props });

    API.updateScene({
      elements: syncInvalidIndices([rect1, rect2]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.updateScene({
      elements: syncInvalidIndices([
        rect1,
        newElementWith(h.elements[1], { isDeleted: true }),
      ]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });

    window.collab.startCollaboration(null);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const undoAction = createUndoAction(h.history);
    act(() => h.app.actionManager.executeAction(undoAction));

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
    });

    API.updateScene({
      elements: syncInvalidIndices([rect1]),
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const redoAction = createRedoAction(h.history);
    act(() => h.app.actionManager.executeAction(redoAction));

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });
  });


  it("should remove idle detector listeners from document on unmount", async () => {
  const addSpy = vi.spyOn(document, "addEventListener");
  const removeSpy = vi.spyOn(document, "removeEventListener");

  const { unmount } = await render(<ExcalidrawApp />);

  // listeners foram registrados corretamente
  expect(addSpy).toHaveBeenCalledWith(EVENT.POINTER_MOVE, expect.any(Function));
  expect(addSpy).toHaveBeenCalledWith(
    EVENT.VISIBILITY_CHANGE,
    expect.any(Function)
  );

  unmount();

  expect(removeSpy).toHaveBeenCalledWith(
    EVENT.POINTER_MOVE,
    expect.any(Function)
  );

  expect(removeSpy).toHaveBeenCalledWith(
    EVENT.VISIBILITY_CHANGE,
    expect.any(Function)
  );
});

it("should not accumulate idle listeners across multiple mount/unmount cycles", async () => {
  const addSpy = vi.spyOn(document, "addEventListener");
  const removeSpy = vi.spyOn(document, "removeEventListener");

  const { unmount } = await render(<ExcalidrawApp />);

  const firstIdleAdds = addSpy.mock.calls.filter(
    (call) =>
      call[0] === EVENT.POINTER_MOVE ||
      call[0] === EVENT.VISIBILITY_CHANGE
  ).length;

  expect(firstIdleAdds).toBe(10);

  unmount();

  const firstIdleRemoves = removeSpy.mock.calls.filter(
    (call) =>
      call[0] === EVENT.POINTER_MOVE ||
      call[0] === EVENT.VISIBILITY_CHANGE
  ).length;

  expect(firstIdleRemoves).toBe(10);

  const addSpy2 = vi.spyOn(document, "addEventListener");
  const { unmount: unmount2 } = await render(<ExcalidrawApp />);

  const secondIdleAdds = addSpy2.mock.calls.filter(
    (call) =>
      call[0] === EVENT.POINTER_MOVE ||
      call[0] === EVENT.VISIBILITY_CHANGE
  ).length;

  expect(secondIdleAdds).toBe(15);

  const removeSpy2 = vi.spyOn(document, "removeEventListener");

  unmount2();

  const secondIdleRemoves = removeSpy2.mock.calls.filter(
    (call) =>
      call[0] === EVENT.POINTER_MOVE ||
      call[0] === EVENT.VISIBILITY_CHANGE
  ).length;

  expect(secondIdleRemoves).toBe(15);
});

it("should not respond to idle events after unmount", async () => {
  const { unmount } = await render(<ExcalidrawApp />);

  const collab = window.collab as any;

  const onPointerMoveSpy = vi.spyOn(collab, "onPointerMove");
  const onVisibilityChangeSpy = vi.spyOn(collab, "onVisibilityChange");

  unmount();

  document.dispatchEvent(new Event(EVENT.POINTER_MOVE));
  document.dispatchEvent(new Event(EVENT.VISIBILITY_CHANGE));

  expect(onPointerMoveSpy).not.toHaveBeenCalled();
  expect(onVisibilityChangeSpy).not.toHaveBeenCalled();
});



});


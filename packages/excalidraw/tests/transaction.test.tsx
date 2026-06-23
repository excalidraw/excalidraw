import React from "react";

import { arrayToMap, reseed } from "@excalidraw/common";

import type { SceneElementsMap } from "@excalidraw/element/types";

import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { GlobalTestState, act, render, unmountComponent } from "./test-utils";

const { h } = window;

describe("TransactionManager", () => {
  beforeEach(async () => {
    unmountComponent();
    reseed(7);
    await render(<Excalidraw />);
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  describe("default transaction", () => {
    it("is active on mount", () => {
      expect(h.app.transactionManager.get().status).toBe("active");
    });

    it("get() (no key) returns the current default transaction", () => {
      const manager = h.app.transactionManager;
      expect(manager.get()).toBe(manager.get());
      expect(manager.get().status).toBe("active");
    });

    it("begin() (no key) restarts the default with a fresh transaction", () => {
      const manager = h.app.transactionManager;
      const before = manager.get();

      const restarted = manager.begin();

      expect(restarted).not.toBe(before);
      expect(restarted).toBe(manager.get());
      expect(restarted.status).toBe("active");
    });

    it("commit() records an undo entry for scene changes and auto-restarts a fresh default", () => {
      const rect = API.createElement({ type: "rectangle" });
      const before = h.app.transactionManager.get();

      // Transparent model: the scene is mutated through the normal flow, then the
      // touched elements are registered with the transaction.
      API.setElements([rect]);
      const historyLengthBefore = h.history.undoStack.length;
      before.update({ elements: arrayToMap([rect]) as SceneElementsMap });

      act(() => {
        before.commit();
      });

      expect(before.status).toBe("committed");
      expect(h.elements.some((el) => el.id === rect.id)).toBe(true);
      expect(h.history.undoStack.length).toBeGreaterThan(historyLengthBefore);

      const after = h.app.transactionManager.get();
      expect(after).not.toBe(before);
      expect(after.status).toBe("active");
    });

    it("rollback() restores scene and auto-restarts a fresh default", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);

      // Default was created at mount (0 elements). Externally add another element.
      const newRect = API.createElement({ type: "rectangle" });
      API.setElements([rect, newRect]);
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(2);

      const before = h.app.transactionManager.get();

      act(() => {
        before.rollback();
      });

      // Rolled back to mount state (0 elements — rollbackState was captured at mount).
      expect(before.status).toBe("rolled-back");
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(0);

      const after = h.app.transactionManager.get();
      expect(after).not.toBe(before);
      expect(after.status).toBe("active");
    });

    it("rollback() does not add an undo history entry", () => {
      const rect = API.createElement({ type: "rectangle" });
      const historyLengthBefore = h.history.undoStack.length;

      h.app.transactionManager.get().update({
        elements: arrayToMap([rect]) as SceneElementsMap,
      });
      act(() => {
        h.app.transactionManager.get().rollback();
      });

      expect(h.history.undoStack.length).toBe(historyLengthBefore);
    });
  });

  describe("keyed transactions", () => {
    it("begin() returns an active transaction", () => {
      const txn = h.app.transactionManager.begin("txA");
      expect(txn.status).toBe("active");
    });

    it("get() retrieves an active transaction by key", () => {
      const txn = h.app.transactionManager.begin("txA");
      expect(h.app.transactionManager.get("txA")).toBe(txn);
    });

    it("get() returns undefined for unknown key", () => {
      expect(h.app.transactionManager.get("nonexistent")).toBeUndefined();
    });

    it("begin() throws if key is already active", () => {
      h.app.transactionManager.begin("txA");
      expect(() => h.app.transactionManager.begin("txA")).toThrow();
    });

    describe("update()", () => {
      it("registering an element does not by itself affect the scene", () => {
        const rect = API.createElement({ type: "rectangle" });
        const historyLengthBefore = h.history.undoStack.length;

        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });
        });

        // update() only registers the element; it does not add it to the scene
        expect(h.elements.some((el) => el.id === rect.id)).toBe(false);
        expect(h.history.undoStack.length).toBe(historyLengthBefore);
      });

      it("throws after commit", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.commit();
        });
        expect(() => txn.update({})).toThrow();
      });

      it("throws after rollback", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.rollback();
        });
        expect(() => txn.update({})).toThrow();
      });
    });

    describe("commit()", () => {
      it("records an undo history entry for scene changes", () => {
        const rect = API.createElement({ type: "rectangle" });

        const txn = h.app.transactionManager.begin("txA");
        API.setElements([rect]);
        const historyLengthBefore = h.history.undoStack.length;
        txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });

        act(() => {
          txn.commit();
        });

        expect(h.elements.some((el) => el.id === rect.id)).toBe(true);
        expect(txn.status).toBe("committed");
        expect(h.history.undoStack.length).toBeGreaterThan(historyLengthBefore);
      });

      it("commit() without prior update() does not crash", () => {
        const txn = h.app.transactionManager.begin("txA");
        expect(() => {
          act(() => {
            txn.commit();
          });
        }).not.toThrow();
        expect(txn.status).toBe("committed");
      });

      it("removes transaction from keyed map after commit", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.commit();
        });
        expect(h.app.transactionManager.get("txA")).toBeUndefined();
      });

      it("throws when called twice", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.commit();
        });
        expect(() => txn.commit()).toThrow();
      });

      it("undo after commit() removes the committed element", () => {
        const rect = API.createElement({ type: "rectangle" });
        const undoAction = createUndoAction(h.history);

        const txn = h.app.transactionManager.begin("txA");
        API.setElements([rect]);
        txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });

        act(() => {
          txn.commit();
        });
        expect(
          h.elements.some((el) => el.id === rect.id && !el.isDeleted),
        ).toBe(true);

        act(() => {
          API.executeAction(undoAction);
        });
        expect(
          h.elements.some((el) => el.id === rect.id && !el.isDeleted),
        ).toBe(false);
      });

      it("redo after undo re-applies the committed element", () => {
        const rect = API.createElement({ type: "rectangle" });
        const undoAction = createUndoAction(h.history);
        const redoAction = createRedoAction(h.history);

        const txn = h.app.transactionManager.begin("txA");
        API.setElements([rect]);
        txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });

        act(() => {
          txn.commit();
        });

        act(() => {
          API.executeAction(undoAction);
        });
        expect(
          h.elements.some((el) => el.id === rect.id && !el.isDeleted),
        ).toBe(false);

        act(() => {
          API.executeAction(redoAction);
        });
        expect(
          h.elements.some((el) => el.id === rect.id && !el.isDeleted),
        ).toBe(true);
      });

      it("detects an in-place mutation and supports undo/redo", () => {
        const rect = API.createElement({ type: "rectangle", x: 0 });
        API.setElements([rect]);
        const undoAction = createUndoAction(h.history);
        const redoAction = createRedoAction(h.history);

        const txn = h.app.transactionManager.begin("txA");
        const historyLengthBefore = h.history.undoStack.length;

        // Mutate in place (same object reference the scene holds).
        act(() => {
          h.app.scene.mutateElement(rect, { x: 100 });
        });
        txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });

        act(() => {
          txn.commit();
        });

        expect(h.history.undoStack.length).toBeGreaterThan(historyLengthBefore);
        expect(h.elements.find((el) => el.id === rect.id)?.x).toBe(100);

        act(() => {
          API.executeAction(undoAction);
        });
        expect(h.elements.find((el) => el.id === rect.id)?.x).toBe(0);

        act(() => {
          API.executeAction(redoAction);
        });
        expect(h.elements.find((el) => el.id === rect.id)?.x).toBe(100);
      });
    });

    describe("rollback()", () => {
      it("restores elements to the state at begin() time", () => {
        const rect = API.createElement({ type: "rectangle" });
        API.setElements([rect]);

        const txn = h.app.transactionManager.begin("txA");

        // Modify scene externally (not via txn.update)
        const newRect = API.createElement({ type: "rectangle" });
        API.setElements([rect, newRect]);
        expect(h.elements.filter((el) => !el.isDeleted).length).toBe(2);

        act(() => {
          txn.rollback();
        });

        expect(txn.status).toBe("rolled-back");
        expect(h.elements.filter((el) => !el.isDeleted).length).toBe(1);
        expect(h.elements.some((el) => el.id === rect.id)).toBe(true);
      });

      it("discards registered changes without recording history", () => {
        const rect = API.createElement({ type: "rectangle" });
        const txn = h.app.transactionManager.begin("txA");
        const historyLengthBefore = h.history.undoStack.length;

        act(() => {
          txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });
          txn.rollback();
        });

        // element was only registered, never applied to the scene; no history entry
        expect(h.elements.some((el) => el.id === rect.id)).toBe(false);
        expect(h.history.undoStack.length).toBe(historyLengthBefore);
      });

      it("removes transaction from keyed map after rollback", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.rollback();
        });
        expect(h.app.transactionManager.get("txA")).toBeUndefined();
      });

      it("throws when called twice", () => {
        const txn = h.app.transactionManager.begin("txA");
        act(() => {
          txn.rollback();
        });
        expect(() => txn.rollback()).toThrow();
      });
    });

    describe("concurrent transactions", () => {
      it("two transactions can be active simultaneously", () => {
        const txnA = h.app.transactionManager.begin("txA");
        const txnB = h.app.transactionManager.begin("txB");
        expect(txnA.status).toBe("active");
        expect(txnB.status).toBe("active");
        act(() => {
          txnA.commit();
          txnB.commit();
        });
        expect(txnA.status).toBe("committed");
        expect(txnB.status).toBe("committed");
      });

      it("rollbackAll() reverts all keyed transactions and the default", () => {
        const rectA = API.createElement({ type: "rectangle" });
        const rectB = API.createElement({ type: "rectangle" });

        const txnA = h.app.transactionManager.begin("txA");
        const txnB = h.app.transactionManager.begin("txB");
        const defaultBefore = h.app.transactionManager.get();

        txnA.update({ elements: arrayToMap([rectA]) as SceneElementsMap });
        txnB.update({ elements: arrayToMap([rectB]) as SceneElementsMap });

        act(() => {
          h.app.transactionManager.rollbackAll();
        });

        expect(txnA.status).toBe("rolled-back");
        expect(txnB.status).toBe("rolled-back");
        expect(defaultBefore.status).toBe("rolled-back");

        // default auto-restarts
        expect(h.app.transactionManager.get()).not.toBe(defaultBefore);
        expect(h.app.transactionManager.get().status).toBe("active");
      });

      it("rollbackAll() is a no-op for keyed when none are active", () => {
        const defaultBefore = h.app.transactionManager.get();
        expect(() => {
          act(() => {
            h.app.transactionManager.rollbackAll();
          });
        }).not.toThrow();
        // default still auto-restarts
        expect(h.app.transactionManager.get()).not.toBe(defaultBefore);
        expect(h.app.transactionManager.get().status).toBe("active");
      });
    });
  });

  describe("streaming (long async transaction)", () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

    it("collapses many async chunks into a single undoable/redoable unit", async () => {
      const undoAction = createUndoAction(h.history);
      const redoAction = createRedoAction(h.history);
      const historyLengthBefore = h.history.undoStack.length;

      // a long-lived keyed transaction, kept open across async chunk boundaries
      const txn = h.app.transactionManager.begin("stream");
      const streamed: ReturnType<typeof API.createElement>[] = [];

      const CHUNKS = 5;
      for (let i = 0; i < CHUNKS; i++) {
        // simulate a streaming gap (next token / network chunk)
        await tick();

        const el = API.createElement({ type: "rectangle", x: i * 50 });
        streamed.push(el);
        // render the chunk incrementally through the normal scene flow
        API.setElements([...streamed]);
        txn.update({ elements: arrayToMap([el]) as SceneElementsMap });

        // chunk is visible immediately, but nothing is committed to history yet
        expect(h.elements.filter((e) => !e.isDeleted)).toHaveLength(i + 1);
        expect(h.history.undoStack.length).toBe(historyLengthBefore);
      }

      act(() => {
        txn.commit();
      });

      // the whole stream becomes one consolidated history entry
      expect(txn.status).toBe("committed");
      expect(h.history.undoStack.length).toBe(historyLengthBefore + 1);
      expect(h.elements.filter((e) => !e.isDeleted)).toHaveLength(CHUNKS);

      // a single undo removes the entire streamed sequence
      act(() => {
        API.executeAction(undoAction);
      });
      expect(h.elements.filter((e) => !e.isDeleted)).toHaveLength(0);

      // a single redo restores the entire streamed sequence
      act(() => {
        API.executeAction(redoAction);
      });
      expect(h.elements.filter((e) => !e.isDeleted)).toHaveLength(CHUNKS);
      for (const el of streamed) {
        expect(
          h.elements.some((e) => e.id === el.id && !e.isDeleted),
        ).toBe(true);
      }
    });

    it("collapses incremental in-place mutations of a streamed element into one unit", async () => {
      const rect = API.createElement({ type: "rectangle", width: 10 });
      API.setElements([rect]);

      const undoAction = createUndoAction(h.history);
      const redoAction = createRedoAction(h.history);

      // begin AFTER the element exists, so the baseline captures width: 10
      const txn = h.app.transactionManager.begin("stream");
      const historyLengthBefore = h.history.undoStack.length;

      // an element that "grows" as tokens stream in (e.g. text/box being generated)
      const widths = [40, 90, 160, 250];
      for (const width of widths) {
        await tick();
        act(() => {
          h.app.scene.mutateElement(rect, { width });
        });
        txn.update({ elements: arrayToMap([rect]) as SceneElementsMap });

        // the growth is visible live, but not yet recorded
        expect(h.elements.find((e) => e.id === rect.id)?.width).toBe(width);
        expect(h.history.undoStack.length).toBe(historyLengthBefore);
      }

      act(() => {
        txn.commit();
      });

      expect(h.history.undoStack.length).toBe(historyLengthBefore + 1);
      expect(h.elements.find((e) => e.id === rect.id)?.width).toBe(250);

      // one undo collapses all incremental growth back to the starting width
      act(() => {
        API.executeAction(undoAction);
      });
      expect(h.elements.find((e) => e.id === rect.id)?.width).toBe(10);

      // one redo re-applies the final streamed width
      act(() => {
        API.executeAction(redoAction);
      });
      expect(h.elements.find((e) => e.id === rect.id)?.width).toBe(250);
    });
  });
});

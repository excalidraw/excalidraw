import React from "react";

import { arrayToMap } from "@excalidraw/common";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type { ElementUpdate } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { TransactionLedger, collectChangedElementIds } from "../transaction";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render, unmountComponent, waitFor } from "./test-utils";

import type { Transaction, TransactionSummary } from "../transaction";

const { h } = window;

type CaptureUpdateKey = keyof typeof CaptureUpdateAction;

const getElement = (id: ExcalidrawElement["id"]): ExcalidrawElement | null =>
  h.app.scene.getNonDeletedElementsMap().get(id) ?? null;

const getElementIncludingDeleted = (
  id: ExcalidrawElement["id"],
): ExcalidrawElement | null =>
  h.app.scene.getElementsMapIncludingDeleted().get(id) ?? null;

const getTextElement = (id: ExcalidrawElement["id"]): ExcalidrawTextElement => {
  const element = getElement(id);
  if (!element || element.type !== "text") {
    throw new Error(`Expected text element: ${id}`);
  }
  return element;
};

const applyElementUpdate = (
  id: ExcalidrawElement["id"],
  updates: ElementUpdate<OrderedExcalidrawElement>,
  captureUpdate: CaptureUpdateKey,
) => {
  const nextElements = h.app.scene
    .getElementsIncludingDeleted()
    .map((element) =>
      element.id === id ? newElementWith(element, updates) : element,
    );

  API.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction[captureUpdate],
  });
};

const applyTextUpdate = (
  id: ExcalidrawElement["id"],
  updates: ElementUpdate<ExcalidrawTextElement>,
  captureUpdate: CaptureUpdateKey,
) => {
  const nextElements = h.app.scene
    .getElementsIncludingDeleted()
    .map((element) =>
      element.id === id && element.type === "text"
        ? newElementWith(element, updates)
        : element,
    );

  API.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction[captureUpdate],
  });
};

const applyElementUpdatesInSingleAction = (
  updatesById: Partial<
    Record<ExcalidrawElement["id"], ElementUpdate<OrderedExcalidrawElement>>
  >,
  captureUpdate: CaptureUpdateKey,
) => {
  const nextElements = h.app.scene
    .getElementsIncludingDeleted()
    .map((element) => {
      const updates = updatesById[element.id];
      return updates ? newElementWith(element, updates) : element;
    });

  API.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction[captureUpdate],
  });
};

const selectElementsByIds = (
  ids: readonly ExcalidrawElement["id"][],
  captureUpdate: CaptureUpdateKey = "IMMEDIATELY",
) => {
  const selectedElementIds = ids.reduce<Record<ExcalidrawElement["id"], true>>(
    (acc, id) => {
      acc[id] = true;
      return acc;
    },
    {},
  );

  API.updateScene({
    appState: { selectedElementIds },
    captureUpdate: CaptureUpdateAction[captureUpdate],
  });
};

const getSelectedIds = () => Object.keys(h.state.selectedElementIds).sort();
const setSceneBaseline = (elements: readonly ExcalidrawElement[]) => {
  API.updateScene({
    elements,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

const commitTransaction = (tx: Transaction) => {
  let summary!: TransactionSummary;
  act(() => {
    summary = tx.commit();
  });
  return summary;
};

const setupCreateTransactionSuite = async () => {
  unmountComponent();
  vi.restoreAllMocks();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
};

// ---------------------------------------------------------------------------
// TransactionLedger (unit tests — no React render needed)
// ---------------------------------------------------------------------------

describe("TransactionLedger", () => {
  it("ignores metadata-only changes when collecting changed ids", () => {
    const before = API.createElement({
      type: "rectangle",
      id: "rect-1",
    });
    const after = {
      ...before,
      version: before.version + 1,
      versionNonce: before.versionNonce + 1,
      seed: before.seed + 1,
      updated: before.updated + 1,
      index: "a2" as ExcalidrawElement["index"],
    };

    expect(
      collectChangedElementIds(arrayToMap([before]), arrayToMap([after])),
    ).toEqual([]);
  });

  it("drops ledger entry when element is created and deleted in one transaction", () => {
    const ledger = new TransactionLedger();
    const created = API.createElement({
      type: "rectangle",
      id: "rect-1",
    });

    ledger.recordStep(new Map(), arrayToMap([created]));
    expect(ledger.hasEntries()).toBe(true);

    ledger.recordStep(arrayToMap([created]), new Map());
    expect(ledger.hasEntries()).toBe(false);
  });

  it("materializes create operation when live scene still matches target", () => {
    const ledger = new TransactionLedger();
    const created = API.createElement({
      type: "rectangle",
      id: "rect-1",
      strokeColor: "#ff006e",
    });

    ledger.recordStep(new Map(), arrayToMap([created]));

    const { elementsBefore, elementsAfter } = ledger.buildSyntheticSnapshots(
      arrayToMap([created]),
    );

    expect(elementsBefore.has(created.id)).toBe(false);
    expect(elementsAfter.get(created.id)?.strokeColor).toBe("#ff006e");
  });

  it("skips conflicting touched-prop updates and keeps live values", () => {
    const ledger = new TransactionLedger();
    const baseline = API.createElement({
      type: "rectangle",
      id: "rect-1",
      strokeColor: "#000000",
    });
    const target = {
      ...baseline,
      strokeColor: "#ff006e",
      version: baseline.version + 1,
    };
    const live = {
      ...target,
      strokeColor: "#3a86ff",
      version: target.version + 1,
    };

    ledger.recordStep(arrayToMap([baseline]), arrayToMap([target]));

    const { elementsBefore, elementsAfter } = ledger.buildSyntheticSnapshots(
      arrayToMap([live]),
    );
    expect(elementsBefore.get(live.id)?.strokeColor).toBe("#3a86ff");
    expect(elementsAfter.get(live.id)?.strokeColor).toBe("#3a86ff");
  });
});

// ---------------------------------------------------------------------------
// createTransaction (integration tests — requires full Excalidraw render)
// ---------------------------------------------------------------------------

describe("createTransaction lifecycle", () => {
  beforeEach(setupCreateTransactionSuite);

  it("commits a single undo entry after tx.updateScene() calls", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "rect-1",
    });
    setSceneBaseline([element]);

    const commitSpy = vi
      .spyOn(h.store, "commitSyntheticIncrement")
      .mockReturnValue(true);

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#ff006e" })
              : el,
          ),
      });
    });

    const summary = commitTransaction(tx);

    expect(summary.status).toBe("committed");
    expect(summary.historyCommitted).toBe(true);
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it("cancel() does not commit history", () => {
    const commitSpy = vi.spyOn(h.store, "commitSyntheticIncrement");
    const tx = h.app.createTransaction();

    const summary = tx.cancel();

    expect(summary.status).toBe("canceled");
    expect(summary.historyCommitted).toBe(false);
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it("commit() is idempotent and skips empty transactions", () => {
    const commitSpy = vi.spyOn(h.store, "commitSyntheticIncrement");
    const tx = h.app.createTransaction();

    const first = tx.commit();
    const second = tx.commit();

    expect(second).toBe(first);
    expect(first.status).toBe("committed");
    expect(first.historyCommitted).toBe(false);
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it("commits tx history without flushing pending micro actions", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "isolated-commit",
      x: 0,
      y: 0,
    });
    setSceneBaseline([element]);

    const incrementTypes: Array<"durable" | "ephemeral"> = [];
    const detach = h.store.onStoreIncrementEmitter.on((increment) => {
      incrementTypes.push(increment.type);
    });

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id ? newElementWith(el, { x: 120 }) : el,
          ),
      });

      h.store.scheduleMicroAction({
        action: CaptureUpdateAction.NEVER,
        elements: undefined,
        appState: {
          ...h.state,
          selectedElementIds: { [element.id]: true },
        },
      });
    });

    const eventsBeforeCommit = incrementTypes.length;
    const summary = commitTransaction(tx);

    expect(summary.historyCommitted).toBe(true);
    expect(incrementTypes.slice(eventsBeforeCommit)).toEqual(["durable"]);

    const eventsBeforeStoreCommit = incrementTypes.length;
    act(() => {
      h.store.commit(h.app.scene.getElementsMapIncludingDeleted(), h.state);
    });

    expect(incrementTypes.slice(eventsBeforeStoreCommit)).toEqual([
      "ephemeral",
    ]);
    detach();
  });

  it("closes the transaction when commitSyntheticIncrement throws", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "commit-throws",
      x: 0,
      y: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: element.id,
            type: "rectangle",
            updates: { x: 120 },
          },
        ],
      });
    });

    const expectedError = new Error("synthetic commit failed");
    vi.spyOn(h.store, "commitSyntheticIncrement").mockImplementation(() => {
      throw expectedError;
    });

    let thrownError: unknown;
    act(() => {
      try {
        tx.commit();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBe(expectedError);
    expect(tx.status).toBe("committed");
    expect(API.getUndoStack().length).toBe(0);
    expect(() => tx.updateScene({ elements: [] })).toThrow(/already committed/);
    expect(() =>
      tx.updateElements({
        elements: [{ id: element.id, type: "rectangle", updates: { y: 240 } }],
      }),
    ).toThrow(/already committed/);
  });

  it("throws on updateScene after commit", () => {
    const tx = h.app.createTransaction();
    commitTransaction(tx);

    expect(() => tx.updateScene({ elements: [] })).toThrow(/already committed/);
  });

  it("throws on updateScene after cancel", () => {
    const tx = h.app.createTransaction();
    tx.cancel();

    expect(() => tx.updateScene({ elements: [] })).toThrow(/already canceled/);
  });

  it("throws on updateElements after commit", () => {
    const tx = h.app.createTransaction();
    commitTransaction(tx);

    expect(() =>
      tx.updateElements({
        elements: [{ id: "missing", type: "rectangle", updates: { x: 10 } }],
      }),
    ).toThrow(/already committed/);
  });

  it("throws on updateElements after cancel", () => {
    const tx = h.app.createTransaction();
    tx.cancel();

    expect(() =>
      tx.updateElements({
        elements: [{ id: "missing", type: "rectangle", updates: { x: 10 } }],
      }),
    ).toThrow(/already canceled/);
  });
});

describe("createTransaction updateElements", () => {
  beforeEach(setupCreateTransactionSuite);

  it("supports partial element patches via tx.updateElements()", async () => {
    const elementA = API.createElement({
      type: "rectangle",
      id: "patch-a",
      x: 0,
      y: 0,
      strokeColor: "#000",
      backgroundColor: "#fff",
    });
    const elementB = API.createElement({
      type: "rectangle",
      id: "patch-b",
      x: 300,
      y: 100,
      strokeColor: "#222",
      backgroundColor: "#eee",
    });
    setSceneBaseline([elementA, elementB]);

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateElements({
        elements: [
          {
            id: elementA.id,
            type: "rectangle",
            updates: { strokeColor: "#f00" },
          },
          {
            id: elementB.id,
            type: "rectangle",
            updates: { x: 420, y: 180 },
          },
        ],
      });
    });

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);
    expect(API.getUndoStack().length).toBe(1);

    let liveA = getElement(elementA.id)!;
    let liveB = getElement(elementB.id)!;
    expect(liveA.strokeColor).toBe("#f00");
    expect(liveA.backgroundColor).toBe(elementA.backgroundColor);
    expect(liveA.x).toBe(elementA.x);
    expect(liveB.x).toBe(420);
    expect(liveB.y).toBe(180);
    expect(liveB.strokeColor).toBe(elementB.strokeColor);

    Keyboard.undo();
    await waitFor(() => {
      liveA = getElement(elementA.id)!;
      liveB = getElement(elementB.id)!;
      expect(liveA.strokeColor).toBe(elementA.strokeColor);
      expect(liveA.backgroundColor).toBe(elementA.backgroundColor);
      expect(liveA.x).toBe(elementA.x);
      expect(liveB.x).toBe(elementB.x);
      expect(liveB.y).toBe(elementB.y);
      expect(liveB.strokeColor).toBe(elementB.strokeColor);
    });
  });

  it("treats updateElements() with unknown ids as a no-op", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "known",
      x: 0,
      y: 0,
      strokeColor: "#000",
    });
    setSceneBaseline([element]);
    expect(API.getUndoStack().length).toBe(0);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: "missing-element-id",
            type: "rectangle",
            updates: { x: 999, strokeColor: "#f00" },
          },
        ],
      });
    });

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(false);
    expect(API.getUndoStack().length).toBe(0);

    const live = getElement(element.id)!;
    expect(live.x).toBe(element.x);
    expect(live.y).toBe(element.y);
    expect(live.strokeColor).toBe(element.strokeColor);
  });

  it("throws when update type mismatches the live element type", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "type-mismatch",
      x: 0,
      y: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    expect(() =>
      tx.updateElements({
        elements: [
          {
            id: element.id,
            type: "text",
            updates: { text: "should-throw" },
          },
        ],
      }),
    ).toThrow(/expected "text", got "rectangle"/);
  });

  it("uses last update for duplicate ids within a single updateElements() call", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "duplicate-update-id",
      x: 0,
      y: 0,
      strokeColor: "#000",
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: element.id,
            type: "rectangle",
            updates: { strokeColor: "#f00" },
          },
          {
            id: element.id,
            type: "rectangle",
            updates: { x: 240 },
          },
        ],
      });
    });

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);

    let live = getElement(element.id)!;
    expect(live.x).toBe(240);
    expect(live.y).toBe(element.y);
    expect(live.strokeColor).toBe(element.strokeColor);

    Keyboard.undo();
    await waitFor(() => {
      live = getElement(element.id)!;
      expect(live.x).toBe(element.x);
      expect(live.y).toBe(element.y);
      expect(live.strokeColor).toBe(element.strokeColor);
    });
  });
});

describe("createTransaction appState", () => {
  beforeEach(setupCreateTransactionSuite);

  it("forwards appState intent to commitSyntheticIncrement", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "rect-1",
    });
    setSceneBaseline([element]);

    const commitSpy = vi
      .spyOn(h.store, "commitSyntheticIncrement")
      .mockReturnValue(true);

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { backgroundColor: "#ffbe0b" })
              : el,
          ),
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    tx.commit();

    expect(commitSpy).toHaveBeenCalledTimes(1);
    const call = commitSpy.mock.calls[0]![0];
    expect(call.logicalAfter.appState).toBeDefined();
    expect(call.logicalAfter.appState?.selectedElementIds).toEqual({
      [element.id]: true,
    });
  });

  it("uses resolveAppState output instead of accumulated appState intent", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "resolver-source",
    });
    setSceneBaseline([element]);

    const commitSpy = vi
      .spyOn(h.store, "commitSyntheticIncrement")
      .mockReturnValue(true);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    const resolverTargetId = "resolver-target";
    let summary!: TransactionSummary;
    act(() => {
      summary = tx.commit({
        resolveAppState: ({ initial, accumulated, live }) => {
          expect(initial.selectedElementIds).toEqual({});
          expect(accumulated.selectedElementIds).toEqual({
            [element.id]: true,
          });
          expect(live.selectedElementIds).toEqual({
            [element.id]: true,
          });
          return { selectedElementIds: { [resolverTargetId]: true } };
        },
      });
    });

    expect(summary.historyCommitted).toBe(true);
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const call = commitSpy.mock.calls[0]![0];
    expect(call.logicalAfter.appState?.selectedElementIds).toEqual({
      [resolverTargetId]: true,
    });
  });

  it("allows resolveAppState to suppress appState-only synthetic history", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "resolver-suppress",
    });
    setSceneBaseline([element]);

    const commitSpy = vi.spyOn(h.store, "commitSyntheticIncrement");

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    let summary!: TransactionSummary;
    act(() => {
      summary = tx.commit({
        resolveAppState: () => undefined,
      });
    });

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(summary.historyCommitted).toBe(false);
    expect(API.getUndoStack().length).toBe(0);
  });

  it("closes the transaction when resolveAppState throws", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "resolver-throws",
    });
    setSceneBaseline([element]);

    const commitSpy = vi.spyOn(h.store, "commitSyntheticIncrement");

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    const expectedError = new Error("resolveAppState failed");
    let thrownError: unknown;
    act(() => {
      try {
        tx.commit({
          resolveAppState: () => {
            throw expectedError;
          },
        });
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBe(expectedError);
    expect(commitSpy).not.toHaveBeenCalled();
    expect(tx.status).toBe("committed");
    expect(API.getUndoStack().length).toBe(0);
    expect(() =>
      tx.updateScene({
        appState: { selectedElementIds: {} },
      }),
    ).toThrow(/already committed/);
  });

  it("supports appState-only commit via tx.updateElements()", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "appstate-only",
    });
    setSceneBaseline([element]);

    const commitSpy = vi
      .spyOn(h.store, "commitSyntheticIncrement")
      .mockReturnValue(true);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [],
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const call = commitSpy.mock.calls[0]![0];
    expect(call.logicalAfter.appState?.selectedElementIds).toEqual({
      [element.id]: true,
    });
  });
});

describe("createTransaction interleaving and undo ordering", () => {
  beforeEach(setupCreateTransactionSuite);

  it("keeps interleaved user edits and transaction history entries separated", async () => {
    const transactionElement = API.createElement({
      type: "rectangle",
      id: "tx-rect",
      x: 0,
      y: 0,
      strokeColor: "#1e1e1e",
      opacity: 100,
    });
    const userElement = API.createElement({
      type: "rectangle",
      id: "user-rect",
      x: 300,
      y: 0,
      backgroundColor: "#ffe8cc",
    });

    setSceneBaseline([transactionElement, userElement]);
    expect(API.getUndoStack().length).toBe(0);

    const tx = h.app.createTransaction();

    // First tx mutation
    act(() => {
      tx.updateScene({
        elements: h.app.scene.getElementsIncludingDeleted().map((el) =>
          el.id === transactionElement.id
            ? newElementWith(el, {
                x: 180,
                strokeColor: "#ff006e",
              })
            : el,
        ),
      });
    });

    // User edit interleaved
    applyElementUpdate(
      userElement.id,
      { backgroundColor: "#00f5d4" },
      "IMMEDIATELY",
    );

    // Second tx mutation
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === transactionElement.id
              ? newElementWith(el, { opacity: 60 })
              : el,
          ),
      });
    });

    // Another user edit
    applyElementUpdate(userElement.id, { y: 220 }, "IMMEDIATELY");

    expect(API.getUndoStack().length).toBe(2);
    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(3);
    });

    let liveTxElement = getElement(transactionElement.id)!;
    let liveUserElement = getElement(userElement.id)!;
    expect(liveTxElement.x).toBe(180);
    expect(liveTxElement.strokeColor).toBe("#ff006e");
    expect(liveTxElement.opacity).toBe(60);
    expect(liveUserElement.backgroundColor).toBe("#00f5d4");
    expect(liveUserElement.y).toBe(220);

    // Undo transaction entry
    Keyboard.undo();
    await waitFor(() => {
      liveTxElement = getElement(transactionElement.id)!;
      expect(liveTxElement.x).toBe(transactionElement.x);
      expect(liveTxElement.strokeColor).toBe(transactionElement.strokeColor);
      expect(liveTxElement.opacity).toBe(transactionElement.opacity);
    });
    liveUserElement = getElement(userElement.id)!;
    expect(liveUserElement.backgroundColor).toBe("#00f5d4");
    expect(liveUserElement.y).toBe(220);

    // Undo user edit
    Keyboard.undo();
    await waitFor(() => {
      liveUserElement = getElement(userElement.id)!;
      expect(liveUserElement.y).toBe(userElement.y);
      expect(liveUserElement.backgroundColor).toBe("#00f5d4");
    });

    // Undo another user edit
    Keyboard.undo();
    await waitFor(() => {
      liveUserElement = getElement(userElement.id)!;
      expect(liveUserElement.backgroundColor).toBe(userElement.backgroundColor);
      expect(liveUserElement.y).toBe(userElement.y);
    });
  });

  it("undoes transaction-created elements without rolling back user history", async () => {
    const base = API.createElement({
      type: "rectangle",
      id: "base",
      x: 0,
      y: 0,
    });
    const txCreated = API.createElement({
      type: "ellipse",
      id: "tx-created",
      x: 420,
      y: 100,
      backgroundColor: "#b197fc",
    });

    setSceneBaseline([base]);
    expect(getElement(txCreated.id)).toBeNull();

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateScene({
        elements: [...h.app.scene.getElementsIncludingDeleted(), txCreated],
      });
    });

    applyElementUpdate(base.id, { x: 120 }, "IMMEDIATELY");
    expect(API.getUndoStack().length).toBe(1);

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
    });
    expect(getElement(txCreated.id)).not.toBeNull();

    Keyboard.undo();
    await waitFor(() => {
      expect(getElement(txCreated.id)).toBeNull();
      expect(getElement(base.id)?.x).toBe(120);
    });

    Keyboard.undo();
    await waitFor(() => {
      expect(getElement(base.id)?.x).toBe(base.x);
    });
  });

  it("transaction commit time not affected by tx creation time", async () => {
    const element = API.createElement({
      type: "rectangle",
      id: "shared",
      strokeColor: "#000",
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();

    applyElementUpdate(element.id, { strokeColor: "#f0f" }, "IMMEDIATELY");
    expect(getElement(element.id)!.strokeColor).toBe("#f0f");

    act(() => {
      tx.updateScene({
        elements: h.app.scene.getElementsIncludingDeleted().map((el) =>
          el.id === element.id
            ? newElementWith(el, {
                strokeColor: "#f00",
              })
            : el,
        ),
      });
    });

    commitTransaction(tx);
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#f0f");

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe(element.strokeColor);
  });
});

describe("createTransaction live-wins-per-prop behavior", () => {
  beforeEach(setupCreateTransactionSuite);

  const setupSamePropertyConflictScenario = () => {
    const element = API.createElement({
      type: "rectangle",
      id: "shared",
      x: 0,
      y: 0,
      strokeColor: "#000",
      backgroundColor: "#fff",
    });
    setSceneBaseline([element]);
    expect(API.getUndoStack().length).toBe(0);

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateScene({
        elements: h.app.scene.getElementsIncludingDeleted().map((el) =>
          el.id === element.id
            ? newElementWith(el, {
                strokeColor: "#f00",
                x: 200,
              })
            : el,
        ),
      });
    });

    // conflicting regular edit
    applyElementUpdate(element.id, { strokeColor: "#f0f" }, "IMMEDIATELY");

    commitTransaction(tx);
    expect(API.getUndoStack().length).toBe(2);

    return element;
  };

  it("undoing regular edit after tx rollback restores pre-tx baseline value", () => {
    const element = setupSamePropertyConflictScenario();

    Keyboard.undo();
    Keyboard.undo();

    const live = getElement(element.id)!;
    // strokeColor should be #000 (pre-tx baseline), not #f00 (tx intermediate).
    // The commit-time patching replaces the tx intermediate in the user's
    // undo entry with the pre-tx baseline.
    expect(live.strokeColor).toBe("#000");
    expect(live.x).toBe(0);
    expect(live.backgroundColor).toBe("#fff");
  });
});

// ---------------------------------------------------------------------------
// Transaction undo markers + effective delta resolution
// ---------------------------------------------------------------------------

describe("transaction undo markers", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(() => {
    unmountComponent();
  });

  it("keeps pre-commit undo action-local (override is inactive while tx is active)", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "redo-patch",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();

    // tx sets strokeColor to purple
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    // User overrides strokeColor to red
    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    // Undo before tx is ended should still restore tx intermediate (purple).
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#800080");

    // Ending the tx later should not rewrite the already-undone user entry.
    commitTransaction(tx);

    // strokeColor should stay purple (tx committed value, user undid their change)
    expect(getElement(element.id)!.strokeColor).toBe("#800080");
    expect(getElement(element.id)!.x).toBe(200);
  });

  it("handles multiple user actions during tx correctly", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "multi-action",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();

    // tx sets strokeColor to purple
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    // User action 1: change strokeColor to red
    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    // User action 2: change strokeColor to green
    applyElementUpdate(element.id, { strokeColor: "#0f0" }, "IMMEDIATELY");

    commitTransaction(tx);

    // Undo tx entry
    Keyboard.undo();
    expect(getElement(element.id)!.x).toBe(0);

    // Undo user action 2 (green → red)
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    // Undo user action 1 (red → black, NOT purple)
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#000");
  });

  it("preserves undo/redo roundtrip after applying ended-tx override", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "roundtrip-after-override",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    commitTransaction(tx);

    // Undo tx entry
    Keyboard.undo();
    expect(getElement(element.id)!.x).toBe(0);
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    // Undo user entry (with override)
    Keyboard.undo();
    expect(getElement(element.id)!.x).toBe(0);
    expect(getElement(element.id)!.strokeColor).toBe("#000");

    // Redo user then redo tx should return to committed live state.
    Keyboard.redo();
    expect(getElement(element.id)!.x).toBe(0);
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    Keyboard.redo();
    expect(getElement(element.id)!.x).toBe(200);
    expect(getElement(element.id)!.strokeColor).toBe("#f00");
  });

  it("does not inject override for user entry on tx-created element", () => {
    // Start with an empty scene
    setSceneBaseline([]);

    const tx = h.app.createTransaction();
    const created = API.createElement({
      type: "rectangle",
      id: "tx-created",
      strokeColor: "#800080",
      x: 100,
    });

    // tx creates the element
    act(() => {
      tx.updateScene({
        elements: [...h.app.scene.getElementsIncludingDeleted(), created],
      });
    });

    // User modifies the tx-created element
    applyElementUpdate("tx-created", { strokeColor: "#f00" }, "IMMEDIATELY");

    commitTransaction(tx);

    // The user's undo entry has inserted.strokeColor = #800080 (tx value).
    // Since baselineElement is null for a tx-created element, no override
    // marker is added — #800080 is correct to restore to here.
    Keyboard.undo();
    expect(getElement("tx-created")!.strokeColor).toBe("#800080");
  });

  it("does not over-override later user action that intentionally returns to tx intermediate", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "intentional-intermediate",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    // polluted entry: purple -> red (should override to black on undo baseline)
    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    // intentional action: red -> purple (should keep red as undo baseline)
    applyElementUpdate(element.id, { strokeColor: "#800080" }, "IMMEDIATELY");

    commitTransaction(tx);

    // undo tx synthetic entry first
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#000");
    expect(getElement(element.id)!.x).toBe(0);

    // undo intentional user action: should go back to red, not baseline black
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    // undo first polluted user action: should go back to pre-tx black
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#000");
  });

  it("overrides only polluted props when one user entry updates multiple props", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "single-entry-multi-prop",
      strokeColor: "#000",
      x: 0,
      y: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
    });

    // One user history entry modifies both a polluted prop (strokeColor)
    // and a non-polluted prop (x).
    applyElementUpdatesInSingleAction(
      {
        [element.id]: {
          strokeColor: "#f00",
          x: 120,
        },
      },
      "IMMEDIATELY",
    );

    commitTransaction(tx);

    // No tx synthetic entry expected in this scenario; undoing once applies the
    // user entry's baseline. strokeColor should be patched to pre-tx baseline,
    // while x should remain action-local baseline.
    Keyboard.undo();
    const live = getElement(element.id)!;
    expect(live.strokeColor).toBe("#000");
    expect(live.x).toBe(0);
    expect(live.y).toBe(0);
  });

  it("overrides only polluted elements when one user entry updates multiple elements", () => {
    const elementA = API.createElement({
      type: "rectangle",
      id: "single-entry-multi-element-a",
      strokeColor: "#000",
      x: 0,
    });
    const elementB = API.createElement({
      type: "rectangle",
      id: "single-entry-multi-element-b",
      strokeColor: "#222",
      x: 0,
    });
    setSceneBaseline([elementA, elementB]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === elementA.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
    });

    // One user history entry touches two elements:
    // - elementA has tx pollution on strokeColor and should be patched.
    // - elementB is unrelated and should keep action-local baseline.
    applyElementUpdatesInSingleAction(
      {
        [elementA.id]: { strokeColor: "#f00" },
        [elementB.id]: { x: 240 },
      },
      "IMMEDIATELY",
    );

    commitTransaction(tx);

    Keyboard.undo();
    const liveA = getElement(elementA.id)!;
    const liveB = getElement(elementB.id)!;
    expect(liveA.strokeColor).toBe("#000");
    expect(liveA.x).toBe(0);
    expect(liveB.x).toBe(0);
    expect(liveB.strokeColor).toBe("#222");
  });

  it("applies pre-tx baseline override after transaction is canceled", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "cancel-no-patch",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    const summary = tx.cancel();
    expect(summary.status).toBe("canceled");
    expect(summary.historyCommitted).toBe(false);

    // Cancel ends the tx without a synthetic history entry. Undo for the
    // interleaved user action should recover the pre-tx baseline.
    Keyboard.undo();
    const live = getElement(element.id)!;
    expect(live.strokeColor).toBe("#000");
    expect(live.x).toBe(200);
  });

  it("keeps undo markers across undo/redo cycles before commit", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "lifecycle-carry",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080", x: 200 })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    // move user entry to redo and back to undo before commit
    Keyboard.undo();
    Keyboard.redo();
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    commitTransaction(tx);

    Keyboard.undo();
    expect(getElement(element.id)!.x).toBe(0);

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#000");
  });

  it("keeps undo ordering across text+rectangle interleaving with selection entries", async () => {
    const text = API.createElement({
      type: "text",
      id: "interleave-text",
      text: "alpha",
      x: 40,
      y: 40,
      strokeColor: "#000",
    });
    const rectangle = API.createElement({
      type: "rectangle",
      id: "interleave-rectangle",
      x: 300,
      y: 80,
      strokeColor: "#111",
      backgroundColor: "#fff",
    });
    setSceneBaseline([text, rectangle]);

    const tx = h.app.createTransaction();

    act(() => {
      tx.updateElements({
        elements: [
          {
            id: text.id,
            type: "text",
            updates: { text: "tx-draft" },
          },
        ],
      });
    });

    // regular #1: select text
    selectElementsByIds([text.id]);
    // regular #2: edit text
    applyTextUpdate(text.id, { text: "beta" }, "IMMEDIATELY");

    act(() => {
      tx.updateElements({
        elements: [
          {
            id: rectangle.id,
            type: "rectangle",
            updates: { x: 520, strokeColor: "#800080" },
          },
        ],
      });
    });

    // regular #3: select rectangle
    selectElementsByIds([rectangle.id]);
    // regular #4: edit rectangle (conflicting prop + additional prop)
    applyElementUpdate(
      rectangle.id,
      { strokeColor: "#f00", backgroundColor: "#ffd43b" },
      "IMMEDIATELY",
    );

    expect(API.getUndoStack().length).toBe(4);

    const summary = commitTransaction(tx);
    expect(summary.historyCommitted).toBe(true);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(5);
    });

    let liveText = getTextElement(text.id);
    let liveRectangle = getElement(rectangle.id)!;
    expect(liveText.text).toBe("beta");
    expect(liveRectangle.x).toBe(520);
    expect(liveRectangle.strokeColor).toBe("#f00");
    expect(liveRectangle.backgroundColor).toBe("#ffd43b");
    expect(getSelectedIds()).toEqual([rectangle.id]);

    // 1) undo tx entry
    Keyboard.undo();
    await waitFor(() => {
      liveText = getTextElement(text.id);
      liveRectangle = getElement(rectangle.id)!;
      expect(liveText.text).toBe("beta");
      expect(liveRectangle.x).toBe(300);
      expect(liveRectangle.strokeColor).toBe("#f00");
      expect(liveRectangle.backgroundColor).toBe("#ffd43b");
    });
    expect(getSelectedIds()).toEqual([rectangle.id]);

    // 2) undo regular rectangle edit
    Keyboard.undo();
    await waitFor(() => {
      liveRectangle = getElement(rectangle.id)!;
      expect(liveRectangle.strokeColor).toBe("#111");
      expect(liveRectangle.backgroundColor).toBe("#fff");
      expect(liveRectangle.x).toBe(300);
    });
    expect(getSelectedIds()).toEqual([rectangle.id]);

    // 3) undo rectangle selection
    Keyboard.undo();
    await waitFor(() => {
      expect(getSelectedIds()).toEqual([text.id]);
    });

    // 4) undo regular text edit
    Keyboard.undo();
    await waitFor(() => {
      liveText = getTextElement(text.id);
      expect(liveText.text).toBe("alpha");
    });
    expect(getSelectedIds()).toEqual([text.id]);

    // 5) undo text selection
    Keyboard.undo();
    await waitFor(() => {
      expect(getSelectedIds()).toEqual([]);
      liveText = getTextElement(text.id);
      liveRectangle = getElement(rectangle.id)!;
      expect(liveText.text).toBe("alpha");
      expect(liveRectangle.x).toBe(300);
      expect(liveRectangle.strokeColor).toBe("#111");
      expect(liveRectangle.backgroundColor).toBe("#fff");
    });
  });

  it("keeps bound text + container consistent across interleaved undo chain", () => {
    const [container, text] = API.createTextContainer({
      label: { text: "alpha" },
    });
    const baselineContainerX = container.x;
    const baselineContainerBackground = container.backgroundColor;
    setSceneBaseline([container, text]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: container.id,
            type: "rectangle",
            updates: { x: 240, backgroundColor: "#800080" },
          },
        ],
      });
    });

    applyElementUpdate(
      container.id,
      { backgroundColor: "#f00" },
      "IMMEDIATELY",
    );

    commitTransaction(tx);
    expect(API.getUndoStack().length).toBe(2);

    let liveText = getTextElement(text.id);
    let liveContainer = getElement(container.id)!;
    expect(liveContainer.x).toBe(240);
    expect(liveContainer.backgroundColor).toBe("#f00");
    expect(liveText.containerId).toBe(container.id);
    expect(liveContainer.boundElements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: text.id })]),
    );

    Keyboard.undo();
    liveText = getTextElement(text.id);
    liveContainer = getElement(container.id)!;
    expect(liveContainer.x).toBe(baselineContainerX);
    expect(liveContainer.backgroundColor).toBe("#f00");
    expect(liveText.containerId).toBe(container.id);

    Keyboard.undo();
    liveText = getTextElement(text.id);
    liveContainer = getElement(container.id)!;
    expect(liveContainer.backgroundColor).toBe(baselineContainerBackground);
    expect(liveText.containerId).toBe(container.id);
    expect(liveContainer.boundElements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: text.id })]),
    );
  });

  it("restores pre-tx baseline for arrow binding conflicts", () => {
    const start = API.createElement({
      type: "rectangle",
      id: "arrow-start",
      x: 0,
      y: 0,
      width: 120,
      height: 120,
    });
    const endBaseline = API.createElement({
      type: "rectangle",
      id: "arrow-end-baseline",
      x: 300,
      y: 0,
      width: 120,
      height: 120,
    });
    const endTx = API.createElement({
      type: "rectangle",
      id: "arrow-end-tx",
      x: 600,
      y: 0,
      width: 120,
      height: 120,
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "interleave-arrow",
      strokeColor: "#000",
      startBinding: {
        elementId: start.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
      endBinding: {
        elementId: endBaseline.id,
        fixedPoint: [0, 0.5],
        mode: "orbit",
      },
    });
    setSceneBaseline([start, endBaseline, endTx, arrow]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: arrow.id,
            type: "arrow",
            updates: {
              strokeColor: "#800080",
              endBinding: {
                elementId: endTx.id,
                fixedPoint: [0, 0.5],
                mode: "orbit",
              },
            },
          },
        ],
      });
    });

    const nextElements = h.app.scene
      .getElementsIncludingDeleted()
      .map((element) =>
        element.id === arrow.id && element.type === "arrow"
          ? newElementWith(element, {
              endBinding: {
                elementId: start.id,
                fixedPoint: [1, 0.5],
                mode: "orbit",
              },
            })
          : element,
      );
    API.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    commitTransaction(tx);

    let liveArrow = getElement(arrow.id);
    if (!liveArrow || liveArrow.type !== "arrow") {
      throw new Error(`Expected arrow element: ${arrow.id}`);
    }
    expect(liveArrow.strokeColor).toBe("#800080");
    expect(liveArrow.endBinding?.elementId).toBe(start.id);

    Keyboard.undo();
    liveArrow = getElement(arrow.id);
    if (!liveArrow || liveArrow.type !== "arrow") {
      throw new Error(`Expected arrow element: ${arrow.id}`);
    }
    expect(liveArrow.strokeColor).toBe("#000");
    expect(liveArrow.endBinding?.elementId).toBe(start.id);

    Keyboard.undo();
    liveArrow = getElement(arrow.id);
    if (!liveArrow || liveArrow.type !== "arrow") {
      throw new Error(`Expected arrow element: ${arrow.id}`);
    }
    expect(liveArrow.endBinding?.elementId).toBe(endBaseline.id);
  });

  it("restores pre-tx baseline for frame membership conflicts", () => {
    const frameA = API.createElement({
      type: "frame",
      id: "frame-a",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    });
    const frameB = API.createElement({
      type: "frame",
      id: "frame-b",
      x: 500,
      y: 0,
      width: 300,
      height: 200,
    });
    const child = API.createElement({
      type: "rectangle",
      id: "frame-child",
      x: 80,
      y: 70,
      frameId: frameA.id,
    });
    setSceneBaseline([frameA, frameB, child]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: child.id,
            type: "rectangle",
            updates: { frameId: frameB.id, x: 560 },
          },
        ],
      });
    });

    applyElementUpdate(child.id, { frameId: null }, "IMMEDIATELY");
    commitTransaction(tx);

    let liveChild = getElement(child.id)!;
    expect(liveChild.frameId).toBeNull();
    expect(liveChild.x).toBe(560);

    Keyboard.undo();
    liveChild = getElement(child.id)!;
    expect(liveChild.frameId).toBeNull();
    expect(liveChild.x).toBe(80);

    Keyboard.undo();
    liveChild = getElement(child.id)!;
    expect(liveChild.frameId).toBe(frameA.id);
    expect(liveChild.x).toBe(80);
  });

  it("restores deleted element to pre-tx baseline on full undo", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "delete-interleave",
      x: 0,
      y: 0,
      strokeColor: "#000",
    });
    const sibling = API.createElement({
      type: "rectangle",
      id: "delete-interleave-sibling",
      x: 40,
      y: 40,
      strokeColor: "#111",
    });
    setSceneBaseline([element, sibling]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: element.id,
            type: "rectangle",
            updates: { x: 200, strokeColor: "#800080" },
          },
          {
            id: sibling.id,
            type: "rectangle",
            updates: { x: 300 },
          },
        ],
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    applyElementUpdate(element.id, { isDeleted: true }, "IMMEDIATELY");
    commitTransaction(tx);

    let live = getElementIncludingDeleted(element.id)!;
    expect(live.isDeleted).toBe(true);
    expect(live.strokeColor).toBe("#f00");
    expect(live.x).toBe(200);
    expect(getElement(sibling.id)!.x).toBe(300);

    expect(API.getUndoStack().length).toBe(3);

    Keyboard.undo();
    expect(getElement(sibling.id)!.x).toBe(40);
    live = getElementIncludingDeleted(element.id)!;
    expect(live.isDeleted).toBe(true);

    Keyboard.undo();
    live = getElementIncludingDeleted(element.id)!;
    expect(live.isDeleted).toBe(false);
    expect(live.strokeColor).toBe("#f00");

    Keyboard.undo();
    live = getElementIncludingDeleted(element.id)!;
    expect(live.isDeleted).toBe(false);
    expect(live.strokeColor).toBe("#000");
    expect(live.x).toBe(0);
  });

  it("supports concurrent transactions on different props without cross-override", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "concurrent-different-props",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const txStroke = h.app.createTransaction();
    const txX = h.app.createTransaction();

    act(() => {
      txStroke.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
      txX.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id ? newElementWith(el, { x: 200 }) : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    applyElementUpdate(element.id, { x: 300 }, "IMMEDIATELY");

    commitTransaction(txStroke);
    commitTransaction(txX);

    Keyboard.undo();
    expect(getElement(element.id)!.x).toBe(0);
    expect(getElement(element.id)!.strokeColor).toBe("#f00");

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#000");
  });

  it("supports concurrent transactions on the same prop with deterministic active-priority ordering", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "concurrent-same-prop",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const txPurple = h.app.createTransaction();
    const txBlue = h.app.createTransaction();

    act(() => {
      txPurple.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
      txBlue.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#0000ff" })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    commitTransaction(txPurple);
    commitTransaction(txBlue);

    // For txBlue, baseline was captured from live scene at its first update,
    // which was already purple due to txPurple.
    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#800080");
  });

  it("keeps active-priority ordering when concurrent txs end in reverse order", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "concurrent-reverse-end-order",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const txPurple = h.app.createTransaction();
    const txBlue = h.app.createTransaction();

    act(() => {
      txPurple.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
      txBlue.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#0000ff" })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    const blueSummary = commitTransaction(txBlue);
    const purpleSummary = commitTransaction(txPurple);

    expect(blueSummary.historyCommitted).toBe(false);
    expect(purpleSummary.historyCommitted).toBe(false);

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#800080");
  });

  it("keeps canceled concurrent tx markers active against older committed txs", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "concurrent-commit-cancel",
      strokeColor: "#000",
      x: 0,
    });
    setSceneBaseline([element]);

    const txPurple = h.app.createTransaction();
    const txBlue = h.app.createTransaction();

    act(() => {
      txPurple.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#800080" })
              : el,
          ),
      });
      txBlue.updateScene({
        elements: h.app.scene
          .getElementsIncludingDeleted()
          .map((el) =>
            el.id === element.id
              ? newElementWith(el, { strokeColor: "#0000ff" })
              : el,
          ),
      });
    });

    applyElementUpdate(element.id, { strokeColor: "#f00" }, "IMMEDIATELY");

    const blueSummary = txBlue.cancel();
    const purpleSummary = commitTransaction(txPurple);

    expect(blueSummary.status).toBe("canceled");
    expect(blueSummary.historyCommitted).toBe(false);
    expect(purpleSummary.historyCommitted).toBe(false);

    Keyboard.undo();
    expect(getElement(element.id)!.strokeColor).toBe("#800080");
  });

  it("handles multi-entry interleaving stress with stable undo ordering", () => {
    const elementA = API.createElement({
      type: "rectangle",
      id: "stress-a",
      x: 0,
      y: 0,
      strokeColor: "#000",
      backgroundColor: "#fff",
    });
    const elementB = API.createElement({
      type: "rectangle",
      id: "stress-b",
      x: 400,
      y: 0,
      strokeColor: "#222",
      backgroundColor: "#eee",
    });
    setSceneBaseline([elementA, elementB]);

    const tx = h.app.createTransaction();
    act(() => {
      tx.updateElements({
        elements: [
          {
            id: elementA.id,
            type: "rectangle",
            updates: { x: 200, strokeColor: "#800080" },
          },
          {
            id: elementB.id,
            type: "rectangle",
            updates: { y: 100, backgroundColor: "#ffec99" },
          },
        ],
      });
    });

    applyElementUpdate(elementA.id, { strokeColor: "#f00" }, "IMMEDIATELY");
    applyElementUpdate(elementB.id, { y: 160 }, "IMMEDIATELY");
    applyElementUpdate(elementA.id, { x: 260 }, "IMMEDIATELY");
    applyElementUpdate(elementB.id, { strokeColor: "#3a86ff" }, "IMMEDIATELY");

    commitTransaction(tx);
    expect(API.getUndoStack().length).toBe(5);

    let liveA = getElement(elementA.id)!;
    let liveB = getElement(elementB.id)!;
    expect(liveA.strokeColor).toBe("#f00");
    expect(liveA.x).toBe(260);
    expect(liveB.y).toBe(160);
    expect(liveB.backgroundColor).toBe("#ffec99");
    expect(liveB.strokeColor).toBe("#3a86ff");

    Keyboard.undo();
    liveA = getElement(elementA.id)!;
    liveB = getElement(elementB.id)!;
    expect(liveA.strokeColor).toBe("#f00");
    expect(liveA.x).toBe(260);
    expect(liveB.y).toBe(160);
    expect(liveB.backgroundColor).toBe("#eee");
    expect(liveB.strokeColor).toBe("#3a86ff");

    Keyboard.undo();
    expect(getElement(elementB.id)!.strokeColor).toBe("#222");

    Keyboard.undo();
    expect(getElement(elementA.id)!.x).toBe(0);

    Keyboard.undo();
    expect(getElement(elementB.id)!.y).toBe(0);

    Keyboard.undo();
    liveA = getElement(elementA.id)!;
    liveB = getElement(elementB.id)!;
    expect(liveA.strokeColor).toBe("#000");
    expect(liveA.x).toBe(0);
    expect(liveB.y).toBe(0);
    expect(liveB.backgroundColor).toBe("#eee");
    expect(liveB.strokeColor).toBe("#222");
  });
});

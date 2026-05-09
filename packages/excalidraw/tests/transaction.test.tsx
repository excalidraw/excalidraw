import React from "react";

import { reseed } from "@excalidraw/common";

import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

const { h } = window;

beforeEach(async () => {
  unmountComponent();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("Transaction", () => {
  describe("begin()", () => {
    it("marks transaction as active", () => {
      h.app.transaction.begin();
      expect(h.app.transaction.isActive).toBe(true);
    });

    it("throws when already active", () => {
      h.app.transaction.begin();
      expect(() => h.app.transaction.begin()).toThrow(
        "A transaction is already active",
      );
    });

    it("can begin again after commit", async () => {
      const tx = h.app.transaction.begin();
      await act(async () => tx.commit());
      expect(() => h.app.transaction.begin()).not.toThrow();
    });

    it("can begin again after rollback", async () => {
      const tx = h.app.transaction.begin();
      await act(async () => tx.rollback());
      expect(() => h.app.transaction.begin()).not.toThrow();
    });
  });

  describe("commit()", () => {
    it("groups multiple element changes into one undo entry", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 0, y: 0 });
      const rect2 = API.createElement({ type: "rectangle", x: 100, y: 0 });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [rect1],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => {
        API.updateScene({
          elements: [rect1, rect2],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.commit());

      expect(API.getUndoStack().length).toBe(1);
    });

    it("does not create an undo entry when there are no changes", async () => {
      const tx = h.app.transaction.begin();
      await act(async () => tx.commit());
      expect(API.getUndoStack().length).toBe(0);
    });

    it("marks transaction as inactive", async () => {
      const tx = h.app.transaction.begin();
      await act(async () => tx.commit());
      expect(h.app.transaction.isActive).toBe(false);
    });
  });

  describe("rollback()", () => {
    it("restores scene to pre-transaction state", async () => {
      const rect = API.createElement({ type: "rectangle" });

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(0);

      await act(async () => tx.rollback());

      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(1);
      expect(h.elements[0].id).toBe(rect.id);
    });

    it("does not create an undo entry", async () => {
      const rect = API.createElement({ type: "rectangle" });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.rollback());

      expect(API.getUndoStack().length).toBe(0);
    });

    it("marks transaction as inactive", async () => {
      const tx = h.app.transaction.begin();
      await act(async () => tx.rollback());
      expect(h.app.transaction.isActive).toBe(false);
    });

    it("undo works correctly after rollback", async () => {
      const rect = API.createElement({ type: "rectangle" });

      // pre-transaction action — creates an undo entry
      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      expect(API.getUndoStack().length).toBe(1);

      const tx = h.app.transaction.begin();

      // erase the element inside the transaction
      await act(async () => {
        API.updateScene({
          elements: [],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.rollback());

      // rollback must not change the undo stack
      expect(API.getUndoStack().length).toBe(1);
      // element must be back
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(1);

      // undo the pre-transaction add — must not throw
      await act(async () => Keyboard.undo());

      expect(API.getUndoStack().length).toBe(0);
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(0);
    });
  });

  describe("net change correctness", () => {
    it("element added then removed within transaction produces no undo entry", async () => {
      const rect = API.createElement({ type: "rectangle" });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => {
        API.updateScene({
          elements: [],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.commit());

      expect(API.getUndoStack().length).toBe(0);
      expect(h.elements.length).toBe(0);
    });

    it("element added then removed does not reappear on undo", async () => {
      const existing = API.createElement({ type: "rectangle", x: 0, y: 0 });

      await act(async () => {
        API.updateScene({
          elements: [existing],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      const rect = API.createElement({ type: "rectangle", x: 100, y: 0 });
      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [existing, rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => {
        API.updateScene({
          elements: [existing],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.commit());

      // transaction had net zero effect on `rect` — it should not appear in the undo stack
      expect(API.getUndoStack().length).toBe(1);
      expect(
        h.elements.map((el) => ({ id: el.id, isDeleted: el.isDeleted })),
      ).toEqual([
        expect.objectContaining({ id: existing.id, isDeleted: false }),
      ]);

      // undo the pre-transaction add of `existing`
      await act(async () => Keyboard.undo());

      // verify undo fired
      expect(API.getUndoStack().length).toBe(0);

      // `rect` must not reappear — it was never committed to history
      expect(h.elements.filter((el) => !el.isDeleted).length).toBe(0);
    });

    it("pre-existing element removed within transaction creates an undo entry", async () => {
      const rect = API.createElement({ type: "rectangle" });

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.commit());

      expect(API.getUndoStack().length).toBe(2);
    });
  });

  describe("property change correctness", () => {
    it("undo restores original property value, not an intermediate one", async () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeColor: "#000000",
      });

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [newElementWith(h.elements[0], { strokeColor: "#ff0000" })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => {
        API.updateScene({
          elements: [newElementWith(h.elements[0], { strokeColor: "#0000ff" })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.commit());

      expect(h.elements[0].strokeColor).toBe("#0000ff");

      await act(async () => Keyboard.undo());

      expect(h.elements.filter((el) => !el.isDeleted)[0].strokeColor).toBe(
        "#000000",
      );
    });

    it("rollback restores original property value, not an intermediate one", async () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeColor: "#000000",
      });

      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      const tx = h.app.transaction.begin();

      await act(async () => {
        API.updateScene({
          elements: [newElementWith(h.elements[0], { strokeColor: "#ff0000" })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => {
        API.updateScene({
          elements: [newElementWith(h.elements[0], { strokeColor: "#0000ff" })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      await act(async () => tx.rollback());

      expect(h.elements.filter((el) => !el.isDeleted)[0].strokeColor).toBe(
        "#000000",
      );
    });
  });

  describe("sequential transactions", () => {
    it("creates a separate undo entry for each transaction", async () => {
      const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });

      const tx1 = h.app.transaction.begin();
      await act(async () => {
        API.updateScene({
          elements: [rect],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });
      await act(async () => tx1.commit());

      expect(API.getUndoStack().length).toBe(1);

      const tx2 = h.app.transaction.begin();
      await act(async () => {
        API.updateScene({
          elements: [newElementWith(h.elements[0], { x: 100 })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });
      await act(async () => tx2.commit());

      expect(API.getUndoStack().length).toBe(2);
    });
  });
});

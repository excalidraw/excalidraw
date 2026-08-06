import React from "react";

import { newElementWith } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";

import "@excalidraw/utils/test-utils";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

const { h } = window;

const currentUser = { id: "user-a", name: "A" };

describe("element authorship", () => {
  beforeEach(() => {
    unmountComponent();
  });

  it("should stamp the authorship of locally created elements", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    UI.createElement("rectangle", { x: 10, y: 10 });

    expect(h.elements).toEqual([
      expect.objectContaining({
        createdBy: "user-a",
        createdAt: 1,
        updatedBy: "user-a",
      }),
    ]);

    Keyboard.undo();
    Keyboard.redo();

    expect(h.elements).toEqual([
      expect.objectContaining({
        isDeleted: false,
        createdBy: "user-a",
        createdAt: 1,
        updatedBy: "user-a",
      }),
    ]);
  });

  it("should not stamp the authorship without the `currentUser` prop", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    UI.createElement("rectangle", { x: 10, y: 10 });

    expect(h.elements).toEqual([
      expect.objectContaining({
        createdBy: null,
        createdAt: null,
        updatedBy: null,
      }),
    ]);
  });

  it("should not stamp elements which entered through a non-durable capture", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(h.elements[0].createdBy).toBe(null);

    // a subsequent local, durable update must not attribute the element either,
    // as it was already part of the document
    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0]).toEqual(
      expect.objectContaining({
        createdBy: null,
        createdAt: null,
        updatedBy: null,
      }),
    );
  });

  it("should not overwrite an existing authorship", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({
      type: "rectangle",
      createdBy: "someone-else",
    });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0]).toEqual(
      expect.objectContaining({
        createdBy: "someone-else",
        createdAt: null,
        updatedBy: null,
      }),
    );
  });

  it("should not leave the snapshot behind, resulting in a phantom history entry", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    const rect = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(API.getUndoStack().length).toBe(1);

    const stampedElement = h.elements[0];
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(stampedElement.createdBy).toBe("user-a");
    // the snapshot has to be in sync with the live element, otherwise the next
    // capture would detect a version-only change
    expect(snapshottedElement.createdBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(stampedElement.version);
    expect(snapshottedElement.versionNonce).toBe(stampedElement.versionNonce);

    // a durable capture without any other change must not push an entry
    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    expect(API.getUndoStack().length).toBe(1);

    // one more unrelated durable action, still exactly one new entry
    UI.createElement("rectangle", { x: 100, y: 100 });

    expect(h.elements.length).toBe(2);
    expect(API.getUndoStack().length).toBe(2);
  });

  it("should keep the interim content capturable while stamping just once", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // the change (including its element clone) is computed eagerly, here,
    // while the scheduled action itself gets flushed with the next commit
    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      elements: [rect],
      appState: undefined,
    });

    act(() => {
      h.elements = [rect];
      // interim edit, landing before the scheduled action gets flushed
      h.app.scene.mutateElement(rect, { x: 100 });
    });

    expect(h.elements[0]).toEqual(
      expect.objectContaining({
        x: 100,
        createdBy: "user-a",
        createdAt: 1,
        updatedBy: "user-a",
      }),
    );

    // the clone is intentionally left behind, so that the interim content
    // gets re-detected by the next capture
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(snapshottedElement).toEqual(
      expect.objectContaining({
        x: 0,
        createdBy: "user-a",
        createdAt: 1,
        updatedBy: "user-a",
      }),
    );
    expect(snapshottedElement.version).toBeLessThan(h.elements[0].version);

    const stampedVersion = h.elements[0].version;

    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    // interim content captured, authorship stamped exactly once
    expect(h.store.snapshot.elements.get(rect.id)!.x).toBe(100);
    expect(h.elements[0].version).toBe(stampedVersion);
  });
});

import React from "react";

import { KEYS } from "@excalidraw/common";
import {
  newElementWith,
  Attribution,
  ChangeOrigin,
  StoreChange,
  StoreDelta,
} from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";

import "@excalidraw/utils/test-utils";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

const { h } = window;

const currentUser = { id: "user-a", name: "A" };
const otherUser = { id: "user-b", name: "B" };

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
        created: 1,
        updatedBy: "user-a",
      }),
    ]);

    Keyboard.undo();
    Keyboard.redo();

    expect(h.elements).toEqual([
      expect.objectContaining({
        isDeleted: false,
        createdBy: "user-a",
        created: 1,
        updatedBy: "user-a",
      }),
    ]);
  });

  it("should not stamp the authorship without the `currentUser` prop", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    UI.createElement("rectangle", { x: 10, y: 10 });

    expect(h.elements.length).toBe(1);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();
  });

  it("should not attribute the creation of elements which entered through a non-durable capture", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(h.elements[0].createdBy).toBeNull();

    // a subsequent local, durable update must not attribute the creation of the
    // element, as it was already part of the document - only the last editor
    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-a");
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

    expect(h.elements[0].createdBy).toBe("someone-else");
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();
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
        created: 1,
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
        created: 1,
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

  it("should stamp `updatedBy` when editing an element authored by someone else", async () => {
    await render(<Excalidraw currentUser={otherUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();

    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].x).toBe(100);
    // the creation attribution is never overwritten by an edit
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-b");
  });

  it("should not churn the version when `updatedBy` is already up to date", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    UI.createElement("rectangle", { x: 10, y: 10 });

    expect(h.elements[0].updatedBy).toBe("user-a");

    const undoStackLength = API.getUndoStack().length;

    act(() => {
      h.app.scene.mutateElement(h.elements[0], { x: 100 });
    });

    const versionBeforeCapture = h.elements[0].version;

    const mutateElementSpy = vi.spyOn(h.app.scene, "mutateElement");

    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    // no stamping mutation attempted at all
    expect(mutateElementSpy).not.toHaveBeenCalled();
    mutateElementSpy.mockRestore();

    // the capture must not have bumped the version on top of the edit itself
    expect(h.elements[0].version).toBe(versionBeforeCapture);
    expect(h.elements[0].updatedBy).toBe("user-a");

    const snapshottedElement = h.store.snapshot.elements.get(h.elements[0].id)!;

    expect(snapshottedElement.version).toBe(versionBeforeCapture);
    expect(snapshottedElement.updatedBy).toBe("user-a");
    // exactly one entry for the edit, no phantom stamping entry
    expect(API.getUndoStack().length).toBe(undoStackLength + 1);

    // and nothing left to capture afterwards
    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    expect(API.getUndoStack().length).toBe(undoStackLength + 1);
    expect(h.elements[0].version).toBe(versionBeforeCapture);
  });

  it("should stamp `updatedBy` of the user who deleted the element", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={otherUser} />,
    );

    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.setSelectedElements([rect]);

    Keyboard.keyPress(KEYS.DELETE);

    expect(h.elements[0].isDeleted).toBe(true);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-b");
  });

  it("should restore the previous `updatedBy` on undo and re-stamp on redo", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={otherUser} />,
    );

    const rect = API.createElement({ type: "rectangle", x: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0]).toEqual(
      expect.objectContaining({ x: 100, updatedBy: "user-b" }),
    );

    Keyboard.undo();

    expect(h.elements[0].x).toBe(0);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    // undoing a stamp writes back the previous value - `null`, as the element
    // had never been updated before, which round-trips like any other attribute
    expect(h.elements[0].updatedBy).toBeNull();
    expect(JSON.parse(JSON.stringify(h.elements[0])).updatedBy).toBeNull();

    Keyboard.redo();

    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-b");
  });

  it("should not leave the snapshot behind when stamping `updatedBy` on the micro path", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    const rect = API.createElement({ type: "rectangle", x: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const undoStackLength = API.getUndoStack().length;

    expect(undoStackLength).toBe(1);

    const stampedElement = h.elements[0];
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(stampedElement.updatedBy).toBe("user-a");
    // the snapshot has to be in sync with the live element, otherwise the next
    // capture would detect a version-only change
    expect(snapshottedElement.updatedBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(stampedElement.version);
    expect(snapshottedElement.versionNonce).toBe(stampedElement.versionNonce);

    // a durable capture without any other change must not push an entry
    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    expect(API.getUndoStack().length).toBe(undoStackLength);
  });

  it("should keep the interim content capturable while stamping `updatedBy` just once", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // the element is already part of the document, hence an edit candidate
    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const editedElement = newElementWith(h.elements[0], { x: 50 });

    // the change (including its element clone) is computed eagerly, here,
    // while the scheduled action itself gets flushed with the next commit
    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      elements: [editedElement],
      appState: undefined,
    });

    act(() => {
      h.elements = [editedElement];
      // interim edit, landing before the scheduled action gets flushed
      h.app.scene.mutateElement(editedElement, { x: 100 });
    });

    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].created).not.toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-a");

    // the clone is intentionally left behind, so that the interim content
    // gets re-detected by the next capture
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(snapshottedElement.x).toBe(50);
    expect(snapshottedElement.createdBy).toBeNull();
    expect(snapshottedElement.created).not.toBeNull();
    expect(snapshottedElement.updatedBy).toBe("user-a");
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

  it("should keep the interim content capturable when the element is attributed already", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // the element is attributed to the current user already, so that the very
    // next capture has nothing left to stamp
    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].updatedBy).toBe("user-a");

    const undoStackLength = API.getUndoStack().length;
    const editedElement = newElementWith(h.elements[0], { x: 50 });

    // the change (including its element clone) is computed eagerly, here,
    // while the scheduled action itself gets flushed with the next commit
    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      elements: [editedElement],
      appState: undefined,
    });

    act(() => {
      h.elements = [editedElement];
      // interim edit, landing before the scheduled action gets flushed
      h.app.scene.mutateElement(editedElement, { x: 100 });
    });

    expect(h.elements[0].x).toBe(100);

    // even though nothing got stamped, the clone must not be pulled up to the
    // live version, otherwise the interim content would never be captured
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(snapshottedElement.x).toBe(50);
    expect(snapshottedElement.version).toBeLessThan(h.elements[0].version);

    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    // interim content captured, as an entry of its own
    expect(h.store.snapshot.elements.get(rect.id)!.x).toBe(100);
    expect(API.getUndoStack().length).toBe(undoStackLength + 2);
  });

  it("should reconcile the clones of all the packages flushed within one commit", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const undoStackLength = API.getUndoStack().length;

    // two durable updates within a single tick - both of them froze their own
    // element clones upfront, before either of them got flushed
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { y: 100 })],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    const stampedElement = h.elements[0];
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(stampedElement).toEqual(
      expect.objectContaining({ x: 100, y: 100, updatedBy: "user-a" }),
    );
    // the snapshot has to be in sync with the live element, otherwise the next
    // capture would detect a version-only change
    expect(snapshottedElement.updatedBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(stampedElement.version);
    expect(snapshottedElement.versionNonce).toBe(stampedElement.versionNonce);

    // neither of the two updates got swallowed by the stamping
    expect(API.getUndoStack().length).toBe(undoStackLength + 2);

    // a durable capture without any other change must not push an entry
    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    expect(API.getUndoStack().length).toBe(undoStackLength + 2);

    Keyboard.undo();
    expect(h.elements[0]).toEqual(
      expect.objectContaining({ x: 100, y: 0, updatedBy: "user-a" }),
    );

    Keyboard.undo();
    expect(h.elements[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, updatedBy: "user-a" }),
    );
  });

  it("should stamp the clone of a non-durable package flushed within the same commit", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const undoStackLength = API.getUndoStack().length;

    // a durable and a non-durable update within a single tick - the latter
    // froze its clone before the former stamped the live element, yet it is
    // the one which ends up in the snapshot
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { y: 100 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    const stampedElement = h.elements[0];
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(stampedElement.updatedBy).toBe("user-a");
    expect(snapshottedElement.updatedBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(stampedElement.version);
    expect(snapshottedElement.versionNonce).toBe(stampedElement.versionNonce);

    // a durable capture without any other change must not push a phantom entry
    act(() => {
      h.store.scheduleCapture();
      h.app.scene.triggerUpdate();
    });

    expect(API.getUndoStack().length).toBe(undoStackLength + 1);
  });

  it("should keep the creation attribution of an element edited within the same commit", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });

    // the element enters the document and gets edited within a single tick,
    // hence the second package froze its clone before the creation was stamped
    act(() => {
      h.app.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { y: 100 })],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    const stampedElement = h.elements[0];
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(stampedElement.createdBy).toBe("user-a");
    expect(stampedElement.updatedBy).toBe("user-a");
    // the creation attribution must not be dropped by the second package
    expect(snapshottedElement.createdBy).toBe("user-a");
    expect(snapshottedElement.created).toBe(stampedElement.created);
    expect(snapshottedElement.updatedBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(stampedElement.version);
    expect(snapshottedElement.versionNonce).toBe(stampedElement.versionNonce);
  });

  it("should stamp new content arriving through a pre-computed durable package", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // the element enters the scene silently, without a scheduled capture,
    // the same way a programmatic transaction would stream it in
    act(() => {
      h.elements = [rect];
    });

    expect(h.store.snapshot.elements.get(rect.id)).toBeUndefined();

    // the package is pre-computed by the caller, instead of letting the store
    // diff the whole scene at commit time
    const prevSnapshot = h.store.snapshot;
    const nextSnapshot = prevSnapshot.maybeClone(
      CaptureUpdateAction.IMMEDIATELY,
      h.app.scene.getElementsMapIncludingDeleted(),
      h.state,
    );
    const change = StoreChange.create(prevSnapshot, nextSnapshot);
    const delta = StoreDelta.calculate(prevSnapshot, nextSnapshot);

    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      change,
      delta,
      origin: ChangeOrigin.COMMIT,
    });

    act(() => {
      h.app.scene.triggerUpdate();
    });

    // carrying a pre-made delta alone must not suppress the authorship
    expect(h.elements[0]).toEqual(
      expect.objectContaining({
        createdBy: "user-a",
        created: 1,
        updatedBy: "user-a",
      }),
    );

    // the snapshot has to be in sync with the live element, otherwise the next
    // capture would detect a version-only change
    const snapshottedElement = h.store.snapshot.elements.get(rect.id)!;

    expect(snapshottedElement.createdBy).toBe("user-a");
    expect(snapshottedElement.version).toBe(h.elements[0].version);
    expect(snapshottedElement.versionNonce).toBe(h.elements[0].versionNonce);
  });

  it("should not author anything when replaying a pre-computed durable package", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    act(() => {
      h.elements = [rect];
    });

    const prevSnapshot = h.store.snapshot;
    const nextSnapshot = prevSnapshot.maybeClone(
      CaptureUpdateAction.IMMEDIATELY,
      h.app.scene.getElementsMapIncludingDeleted(),
      h.state,
    );
    const change = StoreChange.create(prevSnapshot, nextSnapshot);
    const delta = StoreDelta.calculate(prevSnapshot, nextSnapshot);

    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      change,
      delta,
      origin: ChangeOrigin.HISTORY,
    });

    act(() => {
      h.app.scene.triggerUpdate();
    });

    // a replay re-applies an already authored change as-is
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();
  });

  it("should keep the pre-stamped attribution of a pre-computed durable package", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    // the caller attributed the content itself (i.e. to an agent / service id)
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      createdBy: "agent-service",
    });

    act(() => {
      h.elements = [rect];
    });

    const prevSnapshot = h.store.snapshot;
    const nextSnapshot = prevSnapshot.maybeClone(
      CaptureUpdateAction.IMMEDIATELY,
      h.app.scene.getElementsMapIncludingDeleted(),
      h.state,
    );
    const change = StoreChange.create(prevSnapshot, nextSnapshot);
    const delta = StoreDelta.calculate(prevSnapshot, nextSnapshot);

    h.store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      change,
      delta,
      origin: ChangeOrigin.COMMIT,
    });

    act(() => {
      h.app.scene.triggerUpdate();
    });

    expect(h.elements[0].createdBy).toBe("agent-service");
    expect(h.elements[0].updatedBy).toBeNull();
  });

  it("should not credit an explicitly unattributed, immediately undoable insertion", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // i.e. a host inserting AI / import / system content as undoable
    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      attribution: Attribution.NONE,
    });

    // undoable, yet author-unknown
    expect(API.getUndoStack().length).toBe(1);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();

    // a subsequent local edit is credited as usual, while the creation
    // attribution stays unknown for good
    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].updatedBy).toBe("user-a");
  });

  it("should keep an explicitly unattributed insertion unattributed when folded into the next capture", async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true} currentUser={currentUser} />,
    );

    const rect = API.createElement({ type: "rectangle", x: 0 });

    // default capture ("eventually") - the content folds into whatever
    // durable capture comes next
    API.updateScene({
      elements: [rect],
      attribution: Attribution.NONE,
    });

    expect(h.elements[0].createdBy).toBeNull();

    // the user's next durable action folds the insertion in
    UI.createElement("rectangle", { x: 100, y: 100 });

    expect(h.elements.length).toBe(2);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();
    expect(h.elements[1].createdBy).toBe("user-a");
    expect(h.elements[1].updatedBy).toBe("user-a");
  });

  it("should not credit an explicitly unattributed, immediately undoable edit", async () => {
    await render(<Excalidraw currentUser={currentUser} />);

    const rect = API.createElement({ type: "rectangle", x: 0 });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // i.e. a host applying a programmatic, yet undoable edit
    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 100 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      attribution: Attribution.NONE,
    });

    expect(API.getUndoStack().length).toBe(1);
    expect(h.elements[0].x).toBe(100);
    expect(h.elements[0].updatedBy).toBeNull();

    // a subsequent local edit is credited as usual
    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 200 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    expect(h.elements[0].x).toBe(200);
    expect(h.elements[0].updatedBy).toBe("user-a");
  });
});

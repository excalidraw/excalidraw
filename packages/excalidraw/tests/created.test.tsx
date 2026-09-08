import { randomInteger } from "@excalidraw/common";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type { FractionalIndex } from "@excalidraw/element/types";

import { reconcileElements } from "../data/reconcile";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { RemoteExcalidrawElement } from "../data/reconcile";

const { h } = window;

describe("element creation timestamps", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it.each([123, null])(
    "preserves created=%s through capture, edits, and creation undo/redo",
    (created) => {
      const element = API.createElement({
        type: "rectangle",
        x: 10,
        created,
        index: "a0" as FractionalIndex,
      });

      API.updateScene({
        elements: [element],
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(API.getUndoStack()).toHaveLength(0);

      act(() => {
        h.app.scheduleCapture();
        h.setState({});
      });
      expect(API.getUndoStack()).toHaveLength(1);
      expect(h.elements[0]).toMatchObject({
        created,
        version: element.version,
        versionNonce: element.versionNonce,
      });

      const edited = newElementWith(h.elements[0], { x: 50 });
      API.updateScene({
        elements: [edited],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      expect(API.getUndoStack()).toHaveLength(2);
      expect(h.elements[0]).toMatchObject({
        created,
        x: 50,
        version: edited.version,
        versionNonce: edited.versionNonce,
      });
      expect(h.store.snapshot.elements.get(element.id)?.created).toBe(created);

      Keyboard.undo();
      expect(h.elements[0]).toMatchObject({
        created,
        x: 10,
        isDeleted: false,
      });
      expect(h.elements[0].version).toBeGreaterThan(edited.version);

      Keyboard.undo();
      expect(h.elements[0]).toMatchObject({ created, isDeleted: true });
      expect(API.getUndoStack()).toHaveLength(0);

      Keyboard.redo();
      expect(h.elements[0]).toMatchObject({
        created,
        x: 10,
        isDeleted: false,
      });

      Keyboard.redo();
      expect(h.elements[0]).toMatchObject({
        created,
        x: 50,
        isDeleted: false,
      });
      expect(API.getUndoStack()).toHaveLength(2);
      expect(API.getRedoStack()).toHaveLength(0);
    },
  );

  it("continues to a visible undo change after replaying creation metadata", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 10,
      created: null,
    });
    API.updateScene({
      elements: [element],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.updateScene({
      elements: [newElementWith(h.elements[0], { x: 50 })],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    // An explicit metadata repair must round-trip without consuming a
    // separate undo keypress before the user's visible edit. `created` is not
    // an element update, so a repair constructs a new element revision.
    API.updateScene({
      elements: [
        {
          ...h.elements[0],
          created: 123,
          version: h.elements[0].version + 1,
          versionNonce: randomInteger(),
        },
      ],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(API.getUndoStack()).toHaveLength(2);

    Keyboard.undo();

    expect(h.elements[0]).toMatchObject({ x: 10, created: null });
    expect(API.getUndoStack()).toHaveLength(0);
    expect(API.getRedoStack()).toHaveLength(2);
  });

  it("preserves the remote creation timestamp and revision during reconciliation", () => {
    const element = API.createElement({ type: "rectangle", created: 123 });
    API.updateScene({
      elements: [element],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const remoteElement = newElementWith(h.elements[0], { x: 50 });
    const reconciled = reconcileElements(
      h.app.scene.getElementsIncludingDeleted(),
      [remoteElement as RemoteExcalidrawElement],
      h.state,
    );

    API.updateScene({
      elements: reconciled,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    expect(h.elements[0]).toMatchObject({
      x: 50,
      created: 123,
      version: remoteElement.version,
      versionNonce: remoteElement.versionNonce,
    });
    expect(h.store.snapshot.elements.get(element.id)).toMatchObject({
      created: 123,
      version: remoteElement.version,
      versionNonce: remoteElement.versionNonce,
    });
    expect(API.getUndoStack()).toHaveLength(0);
  });
});

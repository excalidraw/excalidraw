import { afterEach, expect, it, vi } from "vitest";

import { AppEventBus } from "@excalidraw/common";
import { newTextElement, Scene, syncInvalidIndices } from "@excalidraw/element";

import { getDefaultAppState } from "../appState";

import { AppText } from "./App.text";

import type App from "./App";

afterEach(() => vi.restoreAllMocks());

it.each(["unmount", "pointerup", "pointercancel"] as const)(
  "releases edited-text resize listeners on %s",
  (ending) => {
    const element = newTextElement({ x: 100, y: 100, text: "Text" });
    const scene = new Scene();
    scene.replaceAllElements(syncInvalidIndices([element]));
    const events = new AppEventBus({
      "editor:unmount": { cardinality: "once", replay: "none" },
    } as const);
    const app = {
      state: {
        ...getDefaultAppState(),
        editingTextElement: element,
        offsetLeft: 0,
        offsetTop: 0,
      },
      scene,
      ownerWindow: window,
      editorInterface: {
        formFactor: "desktop",
        userAgent: { isMobileDevice: false },
      },
      getEffectiveGridSize: () => null,
      onEvent: events.on.bind(events),
    } as unknown as App;
    const text = new AppText(app, {
      getContainer: () => null,
      getStylesPanelMode: () => "full",
    });
    const onClick = vi.fn();
    const canvas = document.createElement("canvas");
    const onDown = vi.fn((event: PointerEvent) =>
      text.resizeEditedTextOnPointerDown(event, onClick),
    );
    canvas.addEventListener("pointerdown", onDown);
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    canvas.dispatchEvent(
      new MouseEvent("pointerdown", {
        clientX: element.x + element.width + 4,
        clientY: element.y + element.height / 2,
      }),
    );
    expect(onDown).toHaveReturnedWith(true);
    const listeners = add.mock.calls.filter(
      ([type, , capture]) =>
        ["pointermove", "pointerup", "pointercancel"].includes(type) &&
        capture === true,
    );
    expect(listeners).toHaveLength(3);

    try {
      if (ending === "unmount") {
        events.emit("editor:unmount");
        expect(onClick).not.toHaveBeenCalled();
      } else {
        window.dispatchEvent(new MouseEvent(ending));
        expect(onClick).toHaveBeenCalledOnce();
      }
      for (const [type, callback] of listeners) {
        expect(remove).toHaveBeenCalledWith(type, callback, true);
      }

      if (ending !== "unmount") {
        const removals = remove.mock.calls.length;
        events.emit("editor:unmount");
        expect(remove).toHaveBeenCalledTimes(removals);
      }
    } finally {
      // Also release the unfixed handler when this regression is run red.
      window.dispatchEvent(new MouseEvent("pointercancel"));
      scene.destroy();
    }
  },
);

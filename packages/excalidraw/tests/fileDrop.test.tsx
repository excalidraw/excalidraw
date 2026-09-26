import React from "react";

import { MIME_TYPES } from "@excalidraw/common";

import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

// jsdom has no DragEvent constructor. MouseEvent supplies the coordinates and
// modifier keys, and the data store models files being protected until drop.
const drag = (
  target: Element,
  type: string,
  {
    files = [],
    types = ["Files"],
    ...init
  }: MouseEventInit & { files?: File[]; types?: string[] } = {},
) => {
  const event = new target.ownerDocument.defaultView!.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 200,
    clientY: 200,
    ...init,
  });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "none",
      types,
      files: type === "drop" ? files : [],
      items: files.map((file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => (type === "drop" ? file : null),
      })),
    },
  });
  fireEvent(target, event);
  return event as MouseEvent & { dataTransfer: { dropEffect: string } };
};

const overlay = () =>
  GlobalTestState.renderResult.container.querySelector(".file-drop-overlay");

const sceneFile = () =>
  new h.app.ownerWindow.File(
    [
      serializeAsJSON(
        [API.createElement({ type: "ellipse", id: "existing" })],
        { ...h.state, viewBackgroundColor: "#ff0000" },
        {},
        "local",
      ),
    ],
    "scene.excalidraw",
    { type: MIME_TYPES.json },
  );

describe("file drop overlay", () => {
  it("ignores text and library-item drags, and stays visible across child boundaries", async () => {
    await render(<Excalidraw />);
    const canvas = GlobalTestState.interactiveCanvas;
    const container = canvas.closest(".excalidraw")!;

    for (const type of [MIME_TYPES.text, MIME_TYPES.excalidrawlibIds]) {
      drag(canvas, "dragenter", { types: [type] });
      expect(overlay()).toBeNull();
    }

    drag(container, "dragenter");
    expect(overlay()?.textContent).toContain("Drop to replace content");
    drag(canvas, "dragenter");
    drag(container, "dragleave");
    expect(overlay()).not.toBeNull();
    drag(canvas, "dragleave");
    expect(overlay()).toBeNull();
  });

  it("updates when Shift changes through drag events or keyboard events", async () => {
    await render(<Excalidraw />);
    const canvas = GlobalTestState.interactiveCanvas;
    drag(canvas, "dragenter", { shiftKey: true });
    expect(overlay()?.textContent).toContain("Drop to add to canvas");

    drag(canvas, "dragover", { shiftKey: false });
    expect(overlay()?.textContent).toContain("Drop to replace content");
    fireEvent.keyDown(h.app.ownerDocument, { key: "Shift", shiftKey: true });
    expect(overlay()?.textContent).toContain(
      "Your existing content will be kept",
    );
    fireEvent.keyUp(h.app.ownerDocument, { key: "Shift", shiftKey: false });
    expect(overlay()?.textContent).toContain("Drop to replace content");
  });

  it.each(["drop", "dragend", "Escape", "blur"])(
    "clears on %s and can show again for the next drag",
    async (type) => {
      await render(<Excalidraw />);
      const canvas = GlobalTestState.interactiveCanvas;
      drag(canvas, "dragenter");
      expect(overlay()).not.toBeNull();

      if (type === "Escape") {
        fireEvent.keyDown(h.app.ownerDocument, { key: "Escape" });
      } else if (type === "blur") {
        fireEvent.blur(h.app.ownerWindow);
      } else {
        drag(h.app.ownerDocument.body, type);
      }
      expect(overlay()).toBeNull();
      drag(canvas, "dragenter");
      expect(overlay()).not.toBeNull();
      drag(canvas, "dragleave");
      expect(overlay()).toBeNull();
    },
  );

  it.each([
    { types: [MIME_TYPES.jpg] },
    { types: [MIME_TYPES.webp] },
    { types: [MIME_TYPES.gif] },
    { types: [MIME_TYPES.png] },
    { types: [MIME_TYPES.svg] },
    { types: ["image/tiff"] },
    { types: [MIME_TYPES.png, MIME_TYPES.svg] },
    { types: [MIME_TYPES.json, MIME_TYPES.jpg] },
  ])("keeps the canvas visible for image drags: $types", async ({ types }) => {
    await render(<Excalidraw />);
    const canvas = GlobalTestState.interactiveCanvas;
    const files = types.map(
      (type) => new h.app.ownerWindow.File([], "file", { type }),
    );

    drag(canvas, "dragenter", { files });
    expect(overlay()).toBeNull();
    drag(canvas, "dragover", { files, shiftKey: true });
    fireEvent.keyDown(h.app.ownerDocument, { key: "Shift", shiftKey: true });
    expect(overlay()).toBeNull();
    fireEvent.keyUp(h.app.ownerDocument, { key: "Shift", shiftKey: false });
    drag(canvas, "dragleave", { files });

    // A later scene drag must still show the overlay.
    drag(canvas, "dragenter");
    expect(overlay()?.textContent).toContain("Drop to replace content");
  });

  it("describes library imports without reading protected files", async () => {
    await render(<Excalidraw />);
    const file = new h.app.ownerWindow.File([], "file", {
      type: MIME_TYPES.excalidrawlib,
    });
    drag(GlobalTestState.interactiveCanvas, "dragenter", { files: [file] });
    expect(overlay()?.textContent).toContain("Drop to import library");
  });

  it("mentions libraries when the file type is unknown, as for OS-dragged .excalidraw(lib) files", async () => {
    await render(<Excalidraw />);
    const canvas = GlobalTestState.interactiveCanvas;
    const untyped = new h.app.ownerWindow.File([], "file", { type: "" });
    drag(canvas, "dragenter", { files: [untyped] });
    expect(overlay()?.textContent).toContain("Drop to replace content");
    expect(overlay()?.textContent).toContain("Library files will append");
    drag(canvas, "dragleave");

    const json = new h.app.ownerWindow.File([], "file", {
      type: MIME_TYPES.json,
    });
    drag(canvas, "dragenter", { files: [json] });
    expect(overlay()?.textContent).toContain("Drop to replace content");
    expect(overlay()?.textContent).not.toContain("Library files");
  });

  it.each([
    { interaction: false as const },
    { ui: false as const },
    { viewModeEnabled: true },
  ])("respects disabled interaction/UI: %j", async (props) => {
    await render(<Excalidraw {...props} />);
    drag(GlobalTestState.interactiveCanvas, "dragenter");
    expect(overlay()).toBeNull();
  });
});

describe("dropping scenes", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        handleKeyboardGlobally
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "existing" })],
          appState: { viewBackgroundColor: "#ffffff" },
        }}
      />,
    );
  });

  it("replaces the scene by default and removes the overlay", async () => {
    drag(GlobalTestState.interactiveCanvas, "dragenter");
    drag(GlobalTestState.interactiveCanvas, "drop", { files: [sceneFile()] });
    expect(overlay()).toBeNull();
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "ellipse" }),
      ]);
      expect(h.state.viewBackgroundColor).toBe("#ff0000");
    });
  });

  it("Shift-drop keeps existing content and settings, remaps IDs, and can be undone", async () => {
    const original = h.elements[0];
    drag(GlobalTestState.interactiveCanvas, "dragenter");
    drag(GlobalTestState.interactiveCanvas, "drop", {
      files: [sceneFile()],
      shiftKey: true,
    });
    expect(overlay()).toBeNull();
    await waitFor(() => expect(h.elements).toHaveLength(2));
    expect(h.elements[0]).toEqual(original);
    expect(h.elements[1].id).not.toBe(original.id);
    expect(h.elements[1]).toMatchObject({ type: "ellipse", x: 150, y: 150 });
    expect(h.state.viewBackgroundColor).toBe("#ffffff");
    expect(h.state.selectedElementIds).toEqual({ [h.elements[1].id]: true });

    await waitFor(() => expect(API.getUndoStack()).toHaveLength(1));
    Keyboard.undo();
    expect(h.app.scene.getNonDeletedElements()).toEqual([original]);
    Keyboard.redo();
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(2);
  });

  it.each(["png", "svg"])(
    "Shift-drop adds the scene embedded in a %s",
    async (ext) => {
      const file = await API.loadFile(`./fixtures/smiley_embedded_v2.${ext}`);
      drag(GlobalTestState.interactiveCanvas, "drop", {
        files: [file],
        shiftKey: true,
      });
      await waitFor(() => expect(h.elements).toHaveLength(2));
      expect(h.elements[0].id).toBe("existing");
      expect(h.elements[1]).toMatchObject({ type: "text", text: "😀" });
    },
  );
});

describe("ignoring drops", () => {
  it.each([
    ["in view mode", { viewModeEnabled: true }],
    ["when non-interactive", { interaction: false as const }],
  ])(
    "%s, cancels the browser default and changes nothing",
    async (_, props) => {
      await render(
        <Excalidraw
          {...props}
          initialData={{
            elements: [
              API.createElement({ type: "rectangle", id: "existing" }),
            ],
            appState: { viewBackgroundColor: "#ffffff" },
          }}
        />,
      );
      const canvas = GlobalTestState.interactiveCanvas;
      const original = h.elements[0];

      drag(canvas, "dragenter");
      const dragOver = drag(canvas, "dragover");
      expect(dragOver.defaultPrevented).toBe(true);
      expect(dragOver.dataTransfer.dropEffect).toBe("none");
      expect(overlay()).toBeNull();

      const drop = drag(canvas, "drop", { files: [sceneFile()] });
      expect(drop.defaultPrevented).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(h.elements).toEqual([original]);
      expect(h.state.viewBackgroundColor).toBe("#ffffff");
    },
  );
});

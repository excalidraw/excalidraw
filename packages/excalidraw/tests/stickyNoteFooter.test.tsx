import React from "react";

import {
  getLineHeight,
  KEYS,
  STICKY_NOTE_PADDING,
  STICKY_NOTE_MIN_SIZE,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawStickyNoteElement,
  StickyNoteFooterOptions,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { restoreAppState, restoreElements } from "../data/restore";
import { serializeAsJSON } from "../data/json";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");
const footers: (StickyNoteFooterOptions | null)[] = [
  null,
  { type: "date", format: "short" },
  { type: "date", format: "time" },
  { type: "date", format: "long" },
  { type: "text", text: "Research" },
];

describe("host-controlled sticky note footers", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it.each(footers)(
    "uses the host default for a new note: %j",
    async (footerOptions) => {
      API.updateScene({
        appState: { currentItemStickynoteFooterOptions: footerOptions },
      });
      UI.clickTool("stickynote");
      mouse.downAt(300, 300);
      mouse.up();
      const note = h.elements.find(
        (element) => element.type === "stickynote",
      ) as ExcalidrawStickyNoteElement;
      expect(note.footerOptions).toEqual(footerOptions);
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
    },
  );

  it("restores the initial host default", async () => {
    const { unmount } = await render(
      <Excalidraw
        initialData={{ appState: { currentItemStickynoteFooterOptions: null } }}
      />,
    );
    expect(h.state.currentItemStickynoteFooterOptions).toBeNull();
    unmount();
  });

  it("reclaims footer space in the drag-creation minimum size", async () => {
    API.updateScene({
      appState: {
        currentItemStickynoteFooterOptions: null,
        currentItemFontSize: 60,
      },
    });
    UI.clickTool("stickynote");
    mouse.downAt(300, 300);
    mouse.moveTo(320, 320);
    mouse.up();
    const note = h.elements.find(
      (element) => element.type === "stickynote",
    ) as ExcalidrawStickyNoteElement;
    const minimum = Math.max(
      STICKY_NOTE_MIN_SIZE,
      Math.ceil(60 * getLineHeight(h.state.currentItemFontFamily)) +
        STICKY_NOTE_PADDING * 2,
    );
    expect(note.width).toBe(minimum);
    expect(note.height).toBe(minimum);
    Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
  });

  it.each(footers)(
    "preserves footer data through JSON and skeleton creation: %j",
    (footerOptions) => {
      const elements = convertToExcalidrawElements([
        {
          type: "stickynote",
          x: 0,
          y: 0,
          width: 250,
          height: 250,
          footerOptions,
          label: { text: "Idea" },
        },
      ]);
      expect(
        (elements[0] as ExcalidrawStickyNoteElement).footerOptions,
      ).toEqual(footerOptions);
      const saved = serializeAsJSON(elements, h.state, {}, "local");
      const restored = restoreElements(JSON.parse(saved).elements, null);
      expect(
        (restored[0] as ExcalidrawStickyNoteElement).footerOptions,
      ).toEqual(footerOptions);
    },
  );

  it("relayouts a host update and restores its layout through undo/redo", () => {
    const elements = convertToExcalidrawElements([
      {
        type: "stickynote",
        x: 0,
        y: 0,
        width: 250,
        height: 250,
        label: { text: "Idea", verticalAlign: "bottom" },
      },
    ]);
    API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
    const note = h.elements[0] as ExcalidrawStickyNoteElement;
    const label = h.elements[1];
    const oldY = label.y;
    API.updateScene({
      elements: restoreElements(
        h.elements.map((element) =>
          element.id === note.id
            ? newElementWith(note, { footerOptions: null })
            : element,
        ),
        null,
        { refreshDimensions: true, repairBindings: true },
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(
      (h.elements[0] as ExcalidrawStickyNoteElement).footerOptions,
    ).toBeNull();
    expect(h.elements[1].y).toBeGreaterThan(oldY);
    expect(h.elements[1].y + h.elements[1].height).toBeCloseTo(
      note.y + note.height - STICKY_NOTE_PADDING,
    );
    Keyboard.undo();
    expect(
      (h.elements[0] as ExcalidrawStickyNoteElement).footerOptions,
    ).toEqual({ type: "date", format: "short" });
    expect(h.elements[1].y).toBeCloseTo(oldY);
    Keyboard.redo();
    expect(
      (h.elements[0] as ExcalidrawStickyNoteElement).footerOptions,
    ).toBeNull();
    expect(h.elements[1].y).toBeGreaterThan(oldY);
  });

  it.each([
    undefined,
    42,
    true,
    "text",
    [],
    {},
    { type: "text", text: 42 },
    { type: "date", format: [] },
  ])("rejects malformed defaults without crashing: %j", (value) => {
    const restored = restoreAppState(
      { currentItemStickynoteFooterOptions: value } as any,
      null,
    );
    expect(restored.currentItemStickynoteFooterOptions).toEqual({
      type: "date",
      format: "short",
    });
  });

  it("exports host text safely and omits explicitly hidden footers", async () => {
    const elements = [
      API.createElement({
        type: "stickynote",
        width: 250,
        height: 250,
        created: null,
        footerOptions: { type: "text", text: "<Research>" },
      }),
      API.createElement({
        type: "stickynote",
        x: 300,
        width: 250,
        height: 250,
        created: new Date(2024, 1, 6, 12).getTime(),
        footerOptions: null,
      }),
    ];
    const svg = await exportScene({
      type: "svg",
      data: { elements, files: {} },
    });
    expect(
      [...svg.querySelectorAll("text")].map((text) => text.textContent),
    ).toEqual(["<Research>"]);
    expect(svg.querySelector("Research")).toBeNull();
    const canvas = await exportScene({
      type: "canvas",
      data: { elements, files: {} },
    });
    expect(canvas.getContext("2d")?.fillText).toHaveBeenCalledWith(
      "<Research>",
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvas.getContext("2d")?.fillText).not.toHaveBeenCalledWith(
      "6 Feb 2024",
      expect.any(Number),
      expect.any(Number),
    );
  });
});

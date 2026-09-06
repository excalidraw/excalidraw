import React from "react";

import {
  COLOR_PALETTE,
  DEFAULT_STICKY_NOTE_SIZE,
  KEYS,
  STICKY_NOTE_MIN_FONT_SIZE,
} from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import {
  getStickyNoteLayout,
  updateStickyNoteLayout,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionBindText, actionUnbindText } from "../actions";
import {
  actionChangeBackgroundColor,
  actionChangeRoundness,
} from "../actions/actionProperties";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const LONG_TEXT = Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n");

const getElement = <
  T extends
    | ExcalidrawStickyNoteElement
    | ExcalidrawTextElement
    | ExcalidrawArrowElement,
>(
  id: string,
) => h.elements.find((element) => element.id === id) as NonDeleted<T>;

/** a note with a label, laid out through the sticky fit */
const createNote = ({
  id,
  x = 100,
  y = 100,
  text,
  fontSize,
  boundArrowIds = [],
}: {
  id: string;
  x?: number;
  y?: number;
  text: string;
  fontSize: number;
  boundArrowIds?: string[];
}) => {
  const labelId = `${id}-label`;
  const note = API.createElement({
    type: "stickynote",
    id,
    x,
    y,
    width: DEFAULT_STICKY_NOTE_SIZE,
    height: DEFAULT_STICKY_NOTE_SIZE,
    baseHeight: DEFAULT_STICKY_NOTE_SIZE,
    boundElements: [
      { type: "text", id: labelId },
      ...boundArrowIds.map((arrowId) => ({
        type: "arrow" as const,
        id: arrowId,
      })),
    ],
  });
  const label = API.createElement({
    type: "text",
    id: labelId,
    x: x + DEFAULT_STICKY_NOTE_SIZE / 2,
    y: y + DEFAULT_STICKY_NOTE_SIZE / 2,
    text,
    fontSize,
    containerId: id,
    textAlign: "center",
    verticalAlign: "middle",
  });
  return { note, label };
};

const layoutNotes = (...ids: string[]) => {
  act(() => {
    for (const id of ids) {
      updateStickyNoteLayout(
        getElement<ExcalidrawStickyNoteElement>(id),
        h.app.scene,
      );
    }
  });
};

const arrowEndY = (id: string) => {
  const arrow = getElement<ExcalidrawArrowElement>(id);
  return arrow.y + arrow.points[arrow.points.length - 1][1];
};

describe("sticky notes", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("keeps arrows bound to a note attached while typing grows it", async () => {
    const { note, label } = createNote({
      id: "note",
      text: "short",
      fontSize: 28,
      boundArrowIds: ["arrow"],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: note.x + note.width / 2,
      y: 700,
      width: 0,
      height: -300,
      points: [pointFrom(0, 0), pointFrom(0, -300)],
      endBinding: {
        elementId: note.id,
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });
    API.setElements([note, label, arrow]);
    layoutNotes(note.id);

    const heightBefore = getElement<ExcalidrawStickyNoteElement>(
      note.id,
    ).height;
    const endYBefore = arrowEndY(arrow.id);
    expect(heightBefore).toBe(DEFAULT_STICKY_NOTE_SIZE);

    mouse.doubleClickAt(note.x + note.width / 2, note.y + note.height / 2);
    const editor = await getTextEditor();
    updateTextEditor(editor, LONG_TEXT);

    const grown = getElement<ExcalidrawStickyNoteElement>(note.id);
    expect(grown.height).toBeGreaterThan(heightBefore);
    expect(grown.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    // the bottom edge moved by the growth, and so did the arrow's end (the
    // orbit ring re-solves the exact contact point, hence the tolerance)
    const growth = grown.height - heightBefore;
    const endDelta = arrowEndY(arrow.id) - endYBefore;
    expect(Math.abs(endDelta - growth)).toBeLessThan(10);

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(getElement<ExcalidrawTextElement>(label.id).fontSize).toBe(
      STICKY_NOTE_MIN_FONT_SIZE,
    );
  });

  it("binds free text with a seeded ceiling and unbinding returns the note to its base height", () => {
    const note = API.createElement({
      type: "stickynote",
      id: "note",
      x: 100,
      y: 100,
      width: DEFAULT_STICKY_NOTE_SIZE,
      height: DEFAULT_STICKY_NOTE_SIZE,
      baseHeight: DEFAULT_STICKY_NOTE_SIZE,
    });
    const text = API.createElement({
      type: "text",
      id: "text",
      x: 600,
      y: 100,
      text: LONG_TEXT,
      fontSize: 28,
    });
    API.setElements([note, text]);
    API.setSelectedElements([note, text]);

    API.executeAction(actionBindText);

    const label = getElement<ExcalidrawTextElement>(text.id);
    const grown = getElement<ExcalidrawStickyNoteElement>(note.id);
    expect(label.containerId).toBe(note.id);
    expect(label.fontSizeMax).toBe(28);
    expect(label.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE);
    expect(grown.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(grown.height).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);

    API.setSelectedElements([grown]);
    API.executeAction(actionUnbindText);

    const freed = getElement<ExcalidrawTextElement>(text.id);
    const emptied = getElement<ExcalidrawStickyNoteElement>(note.id);
    expect(freed.containerId).toBe(null);
    // the ceiling is cleared for good (`undefined` would be skipped by the mutator)
    expect(freed.fontSizeMax).toBe(null);
    expect(emptied.boundElements ?? []).toEqual([]);
    expect(emptied.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
  });

  it("pasting styles onto a grown note lays out the note together with its label", () => {
    const source = createNote({
      id: "source",
      x: 600,
      text: "source",
      fontSize: 10,
    });
    const target = createNote({ id: "target", text: LONG_TEXT, fontSize: 28 });
    API.setElements([source.note, source.label, target.note, target.label]);
    layoutNotes(source.note.id, target.note.id);

    const grownHeight = getElement<ExcalidrawStickyNoteElement>(
      target.note.id,
    ).height;
    expect(grownHeight).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);

    API.setSelectedElements([getElement(source.note.id)]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([getElement(target.note.id)]);
    API.executeAction(actionPasteStyles);

    const note = getElement<ExcalidrawStickyNoteElement>(target.note.id);
    const label = getElement<ExcalidrawTextElement>(target.label.id);
    // the user's ceiling was copied, not the source's fitted size
    expect(label.fontSizeMax).toBe(10);
    // the note shrank with its smaller label, and the pair is self-consistent
    // (no phantom container: the returned note carries the new layout)
    expect(note.height).toBeLessThan(grownHeight);
    const layout = getStickyNoteLayout(note, label);
    expect(note.height).toBeCloseTo(layout.container.height);
    expect(label.fontSize).toBe(layout.text!.fontSize);
    expect(label.y).toBeCloseTo(layout.text!.y);
  });

  it("leaves unselected notes untouched by property actions", () => {
    const { note, label } = createNote({
      id: "note",
      text: "unrelated",
      fontSize: 28,
    });
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rectangle",
      x: 600,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([note, label, rectangle]);
    layoutNotes(note.id);
    const noteBefore = getElement<ExcalidrawStickyNoteElement>(note.id);
    const labelBefore = getElement<ExcalidrawTextElement>(label.id);

    API.setSelectedElements([getElement(rectangle.id)]);
    act(() => {
      h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
        color: "#ffc9c9",
      });
      h.app.actionManager.executeAction(actionChangeRoundness, "ui", "sharp");
    });

    expect(getElement(rectangle.id).backgroundColor).toBe("#ffc9c9");
    expect(getElement(note.id)).toBe(noteBefore);
    expect(getElement(label.id)).toBe(labelBefore);
  });

  it("keeps a note's invariants through plain property actions", () => {
    const { note, label } = createNote({
      id: "note",
      text: "hi",
      fontSize: 28,
    });
    API.setElements([note, label]);
    layoutNotes(note.id);
    API.setSelectedElements([getElement(note.id)]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
        color: "transparent",
      });
    });

    // never transparent — the normalization runs inside `changeProperty`
    expect(getElement(note.id).backgroundColor).not.toBe("transparent");
  });

  describe("colors", () => {
    const RED = COLOR_PALETTE.red[4];

    it("routes a closed-popup top pick to the sticky default after switching tools", () => {
      // regression: the memoized picker kept a stale `onChange` that had
      // captured the rectangle tool's target, so the top pick wrote the
      // shape default while the sticky tool was active
      UI.clickTool("rectangle");
      UI.clickTool("stickynote");
      const shapeDefault = h.state.currentItemStrokeColor;

      UI.clickOnTestId(`color-top-pick-${RED}`);

      expect(h.state.currentItemStickynoteStrokeColor).toBe(RED);
      expect(h.state.currentItemStrokeColor).toBe(shapeDefault);
    });

    it("writes both defaults and colors both domains for a mixed selection", () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rectangle",
        x: 600,
        y: 100,
        width: 100,
        height: 100,
      });
      API.setElements([note, label, rectangle]);
      layoutNotes(note.id);
      API.setSelectedElements([getElement(note.id), getElement(rectangle.id)]);

      UI.clickOnTestId(`color-top-pick-${RED}`);

      expect(getElement(rectangle.id).strokeColor).toBe(RED);
      expect(getElement(note.id).strokeColor).toBe(RED);
      // the note's visible text is its label
      expect(getElement(label.id).strokeColor).toBe(RED);
      expect(h.state.currentItemStrokeColor).toBe(RED);
      expect(h.state.currentItemStickynoteStrokeColor).toBe(RED);
    });

    it("creates notes from the sticky defaults, not the shape defaults", () => {
      API.setAppState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
        currentItemStrokeColor: COLOR_PALETTE.blue[4],
        currentItemStickynoteBackgroundColor: COLOR_PALETTE.pink[1],
        currentItemStickynoteStrokeColor: COLOR_PALETTE.black,
      });
      UI.clickTool("stickynote");
      mouse.downAt(300, 300);
      mouse.up();

      const note = h.elements.find(
        (element) => element.type === "stickynote",
      ) as ExcalidrawStickyNoteElement;
      expect(note.backgroundColor).toBe(COLOR_PALETTE.pink[1]);
      expect(note.strokeColor).toBe(COLOR_PALETTE.black);
      Keyboard.keyPress(KEYS.ESCAPE);
    });

    it("binding a transparent text to a note gives it the note's text color", () => {
      const note = API.createElement({
        type: "stickynote",
        id: "note",
        x: 100,
        y: 100,
        width: DEFAULT_STICKY_NOTE_SIZE,
        height: DEFAULT_STICKY_NOTE_SIZE,
        baseHeight: DEFAULT_STICKY_NOTE_SIZE,
        strokeColor: COLOR_PALETTE.blue[4],
      });
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 600,
        y: 100,
        text: "hello",
        fontSize: 20,
        strokeColor: COLOR_PALETTE.transparent,
      });
      API.setElements([note, text]);
      API.setSelectedElements([note, text]);

      API.executeAction(actionBindText);

      expect(getElement<ExcalidrawTextElement>(text.id).strokeColor).toBe(
        COLOR_PALETTE.blue[4],
      );
    });

    it("colors a selected note's label with the keyboard eyedropper", () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      API.setSelectedElements([getElement(note.id)]);

      const backgroundBefore = getElement(note.id).backgroundColor;
      // Shift+S opens the stroke eyedropper (`I` would pick the background)
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress("s");
      });
      const eyeDropper = editorJotaiStore.get(activeEyeDropperAtom);
      expect(eyeDropper).not.toBeNull();
      act(() => {
        eyeDropper!.onSelect(RED, { altKey: false } as PointerEvent);
      });

      expect(getElement(note.id).strokeColor).toBe(RED);
      expect(getElement(label.id).strokeColor).toBe(RED);
      expect(getElement(note.id).backgroundColor).toBe(backgroundBefore);
    });
  });
});

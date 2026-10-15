import React from "react";

import {
  COLOR_PALETTE,
  DEFAULT_STICKY_NOTE_SIZE,
  KEYS,
  STICKY_NOTE_MIN_FONT_SIZE,
  arrayToMap,
} from "@excalidraw/common";
import { queryByTestId } from "@testing-library/react";
import { pointFrom } from "@excalidraw/math";

import {
  getStickyNoteLayout,
  getTransformHandles,
  getBaseFontSize,
  resizeMultipleElements,
  resizeSingleElement,
  updateStickyNoteLayout,
} from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/utils";

import type {
  ExcalidrawArrowElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionBindText, actionGroup, actionUnbindText } from "../actions";
import {
  actionChangeBackgroundColor,
  actionChangeFontSize,
  actionChangeRoundness,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import { actionCopyStyles, actionPasteStyles } from "../actions/actionStyles";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { getShapeActionPredicates } from "../components/shapeActionPredicates";
import { editorJotaiStore } from "../editor-jotai";
import { Excalidraw } from "../index";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const LONG_TEXT = Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n");
const RED = COLOR_PALETTE.red[4];

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

    Keyboard.keyPress(KEYS.ESCAPE, editor);
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
    expect(label.baseFontSize).toBe(28);
    expect(label.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE);
    expect(grown.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(grown.height).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);

    API.setSelectedElements([grown]);
    API.executeAction(actionUnbindText);

    const freed = getElement<ExcalidrawTextElement>(text.id);
    const emptied = getElement<ExcalidrawStickyNoteElement>(note.id);
    expect(freed.containerId).toBe(null);
    // the ceiling is cleared for good (`undefined` would be skipped by the mutator)
    expect(freed.baseFontSize).toBe(null);
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
    expect(label.baseFontSize).toBe(10);
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

    it("creates notes from the sticky defaults, not the shape defaults", async () => {
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
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
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

    it("binding a colored text to a note gives the note the text's color", () => {
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
        strokeColor: RED,
      });
      API.setElements([note, text]);
      API.setSelectedElements([note, text]);

      API.executeAction(actionBindText);

      expect(getElement(note.id).strokeColor).toBe(RED);
      expect(getElement<ExcalidrawTextElement>(text.id).strokeColor).toBe(RED);
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

  describe("bound arrows", () => {
    const createNoteWithArrow = (text: string, fontSize = 28) => {
      const { note, label } = createNote({
        id: "note",
        text,
        fontSize,
        boundArrowIds: ["arrow"],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: note.x + note.width / 2,
        y: 900,
        width: 0,
        height: -500,
        points: [pointFrom(0, 0), pointFrom(0, -500)],
        endBinding: {
          elementId: note.id,
          fixedPoint: [0.5, 1],
          mode: "orbit",
        },
      });
      API.setElements([note, label, arrow]);
      layoutNotes(note.id);
      return { note, label, arrow };
    };
    const noteBottom = (id: string) => {
      const note = getElement<ExcalidrawStickyNoteElement>(id);
      return note.y + note.height;
    };

    it("follow the note back to its base height on unbind", () => {
      const { note, arrow } = createNoteWithArrow(LONG_TEXT);
      expect(getElement(note.id).height).toBeGreaterThan(
        DEFAULT_STICKY_NOTE_SIZE,
      );
      const gap = arrowEndY(arrow.id) - noteBottom(note.id);

      API.setSelectedElements([getElement(note.id)]);
      API.executeAction(actionUnbindText);

      expect(getElement(note.id).height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      // the orbit ring re-solves the contact point, hence the tolerance
      expect(
        Math.abs(arrowEndY(arrow.id) - noteBottom(note.id) - gap),
      ).toBeLessThan(10);
    });

    it("stay at the content bottom after a content-constrained resize", () => {
      const { note, arrow } = createNoteWithArrow(LONG_TEXT);
      const grown = getElement<ExcalidrawStickyNoteElement>(note.id);
      const heightBefore = grown.height;
      const gap = arrowEndY(arrow.id) - noteBottom(note.id);
      const originalElementsMap = arrayToMap(
        h.elements.map((element) => ({ ...element })),
      );

      act(() => {
        resizeSingleElement(
          grown.width,
          DEFAULT_STICKY_NOTE_SIZE,
          grown,
          { ...grown },
          originalElementsMap,
          h.app.scene,
          "s",
        );
      });

      const after = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(after.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(after.height).toBeCloseTo(heightBefore);
      // the arrow pass ran after the content correction, not before it
      expect(arrowEndY(arrow.id) - noteBottom(note.id)).toBeCloseTo(gap, 0);
    });

    it("follow a font-size change that grows the note", () => {
      // 12 lines at a 12px ceiling fit the base height; at 20 they don't
      const twelveLines = Array(12).fill("abcdefghij").join("\n");
      const { note, label, arrow } = createNoteWithArrow(twelveLines, 12);
      expect(getElement(note.id).height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      const gap = arrowEndY(arrow.id) - noteBottom(note.id);

      API.setSelectedElements([getElement(note.id)]);
      act(() => {
        h.app.actionManager.executeAction(actionChangeFontSize, "ui", 20);
      });

      expect(getElement<ExcalidrawTextElement>(label.id).baseFontSize).toBe(20);
      expect(getElement(note.id).height).toBeGreaterThan(
        DEFAULT_STICKY_NOTE_SIZE,
      );
      expect(arrowEndY(arrow.id) - noteBottom(note.id)).toBeCloseTo(gap, 0);
    });

    it("are not moved twice when they are part of a multi-select resize", () => {
      const { note, arrow } = createNoteWithArrow("short");
      const gap = arrowEndY(arrow.id) - noteBottom(note.id);
      const originalElementsMap = arrayToMap(
        h.elements.map((element) => ({ ...element })),
      );

      // selection bbox: note (100..350) + arrow down to y=900 → 250×800
      act(() => {
        resizeMultipleElements(
          h.app.scene.getNonDeletedElements(),
          h.app.scene.getNonDeletedElementsMap(),
          "se",
          h.app.scene,
          originalElementsMap,
          { nextWidth: 500, nextHeight: 1600, shouldMaintainAspectRatio: true },
        );
      });

      // the arrow was scaled with the selection (gap doubled); had the note's
      // arrow pass re-snapped it, the gap would be back at its ring distance
      expect(getElement(note.id).width).toBe(500);
      expect(arrowEndY(arrow.id) - noteBottom(note.id)).toBeCloseTo(gap * 2, 0);
    });
  });

  describe("editing", () => {
    it("routes a top pick to the label and the sticky default while editing a note", async () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      const shapeDefault = h.state.currentItemStrokeColor;

      mouse.doubleClickAt(note.x + note.width / 2, note.y + note.height / 2);
      await getTextEditor();
      UI.clickOnTestId(`color-top-pick-${RED}`);

      expect(getElement(label.id).strokeColor).toBe(RED);
      // one ink: the note (and so its footer) follows the label
      expect(getElement(note.id).strokeColor).toBe(RED);
      expect(h.state.currentItemStickynoteStrokeColor).toBe(RED);
      expect(h.state.currentItemStrokeColor).toBe(shapeDefault);
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
    });

    it("offers the note's background while editing its label and colors the note with it", async () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      const shapeDefault = h.state.currentItemBackgroundColor;
      const noteBackground = getElement(note.id).backgroundColor;

      mouse.doubleClickAt(note.x + note.width / 2, note.y + note.height / 2);
      await getTextEditor();

      // the label is the styles panel's target and has no fill of its own,
      // yet the background picker stays available and shows the note's fill
      const elementsMap = h.app.scene.getNonDeletedElementsMap();
      expect(
        getShapeActionPredicates(
          h.state,
          [getElement(label.id)],
          elementsMap,
          h.app,
        ).backgroundColor,
      ).toBe(true);
      const backgroundPicker = document.querySelector(
        ".color-picker__top-picks .color-picker__button.active[title]",
      );
      const activeSwatches = Array.from(
        document.querySelectorAll(".color-picker__top-picks .active"),
      ).map((button) => button.getAttribute("title"));
      expect(backgroundPicker).not.toBeNull();
      expect(activeSwatches).toContain(noteBackground);

      act(() => {
        h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
          color: COLOR_PALETTE.pink[1],
        });
      });

      // text and background in one editing pass: the pick lands on the note
      expect(getElement(note.id).backgroundColor).toBe(COLOR_PALETTE.pink[1]);
      expect(getElement(label.id).backgroundColor).toBe(label.backgroundColor);
      expect(h.state.currentItemStickynoteBackgroundColor).toBe(
        COLOR_PALETTE.pink[1],
      );
      expect(h.state.currentItemBackgroundColor).toBe(shapeDefault);
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
    });

    it("keeps the background picker away from plain text being edited", async () => {
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 100,
        y: 100,
        text: "hi",
        fontSize: 28,
      });
      API.setElements([text]);

      mouse.doubleClickAt(text.x + text.width / 2, text.y + text.height / 2);
      await getTextEditor();

      expect(
        getShapeActionPredicates(
          h.state,
          [getElement(text.id)],
          h.app.scene.getNonDeletedElementsMap(),
          h.app,
        ).backgroundColor,
      ).toBe(false);
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
    });

    it("colors a selected note's label with the preview eyedropper", () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      API.setSelectedElements([getElement(note.id)]);

      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress("s");
      });
      // the preview samples the canvas under the pointer (the mock yields
      // black) and applies it live — to the label as well as the note
      const backdrop = document.querySelector(
        ".excalidraw-eye-dropper-backdrop",
      )!;
      expect(backdrop).not.toBeNull();
      // the pick applies live only while the pointer is held down
      fireEvent.pointerDown(backdrop, { clientX: 150, clientY: 150 });
      fireEvent.pointerMove(window, { clientX: 150, clientY: 150 });

      const picked = getElement(label.id).strokeColor;
      expect(picked).not.toBe(COLOR_PALETTE.black);
      expect(getElement(note.id).strokeColor).toBe(picked);
      fireEvent.keyDown(backdrop, { key: KEYS.ESCAPE });
    });
  });

  describe("paste styles", () => {
    it("resolves the source ceiling from the copied snapshot after the source is gone", () => {
      const source = createNote({
        id: "source",
        x: 600,
        text: LONG_TEXT,
        fontSize: 28,
      });
      const target = createNote({ id: "target", text: "hi", fontSize: 10 });
      API.setElements([source.note, source.label, target.note, target.label]);
      layoutNotes(source.note.id, target.note.id);

      API.setSelectedElements([getElement(source.note.id)]);
      API.executeAction(actionCopyStyles);
      API.setElements([
        getElement(target.note.id),
        getElement(target.label.id),
      ]);
      API.setSelectedElements([getElement(target.note.id)]);
      API.executeAction(actionPasteStyles);

      expect(
        getElement<ExcalidrawTextElement>(target.label.id).baseFontSize,
      ).toBe(28);
    });

    it("gives a note one ink when the copied styles carry two colors", () => {
      // a rectangle with a differently colored label: the label's color is
      // the visible text color, so it becomes the note's ink
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 600,
        y: 100,
        width: 200,
        height: 100,
        strokeColor: COLOR_PALETTE.blue[4],
        boundElements: [{ type: "text", id: "rect-label" }],
      });
      const rectangleLabel = API.createElement({
        type: "text",
        id: "rect-label",
        x: 650,
        y: 130,
        text: "hi",
        fontSize: 20,
        containerId: "rect",
        strokeColor: RED,
      });
      const target = createNote({ id: "target", text: "hi", fontSize: 20 });
      API.setElements([rectangle, rectangleLabel, target.note, target.label]);
      layoutNotes(target.note.id);

      API.setSelectedElements([getElement(rectangle.id)]);
      API.executeAction(actionCopyStyles);
      API.setSelectedElements([getElement(target.note.id)]);
      API.executeAction(actionPasteStyles);

      expect(getElement(target.label.id).strokeColor).toBe(RED);
      expect(getElement(target.note.id).strokeColor).toBe(RED);
    });
  });

  describe("ceiling lifecycle", () => {
    it("ignores a stale ceiling on text that is no longer bound to a note", () => {
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 100,
        y: 100,
        text: "plain",
        fontSize: 20,
      });
      API.setElements([text]);
      // what generic binding repair can leave behind
      act(() => {
        h.app.scene.mutateElement(getElement<ExcalidrawTextElement>(text.id), {
          baseFontSize: 28,
        });
      });
      expect(
        getBaseFontSize(
          getElement<ExcalidrawTextElement>(text.id),
          h.app.scene.getNonDeletedElementsMap(),
        ),
      ).toBe(20);

      API.setSelectedElements([getElement(text.id)]);
      API.executeAction(actionIncreaseFontSize);

      const after = getElement<ExcalidrawTextElement>(text.id);
      expect(after.fontSize).toBe(22);
      expect(after.baseFontSize).toBe(28);
    });

    it("duplicates a note with its label's ceiling and base height", () => {
      const { note, label } = createNote({
        id: "note",
        text: LONG_TEXT,
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      API.setSelectedElements([getElement(note.id)]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress("d");
      });

      const notes = h.elements.filter(
        (element) => element.type === "stickynote" && !element.isDeleted,
      ) as ExcalidrawStickyNoteElement[];
      expect(notes).toHaveLength(2);
      const copy = notes.find((candidate) => candidate.id !== note.id)!;
      const copyLabel = h.elements.find(
        (element) =>
          element.type === "text" &&
          (element as ExcalidrawTextElement).containerId === copy.id,
      ) as ExcalidrawTextElement;
      expect(copy.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(copy.height).toBeCloseTo(getElement(note.id).height);
      expect(copyLabel.baseFontSize).toBe(28);
      expect(
        getBaseFontSize(copyLabel, h.app.scene.getNonDeletedElementsMap()),
      ).toBe(28);
    });
  });

  describe("creation", () => {
    it("keeps an empty note escaped from editing and removes it on undo", async () => {
      UI.clickTool("stickynote");
      mouse.downAt(300, 300);
      mouse.up();
      expect(h.state.editingTextElement).not.toBeNull();

      // the editor owns Escape (a document-level keypress would not end
      // editing, and undo is suppressed while editing)
      Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
      expect(h.state.editingTextElement).toBeNull();
      const note = h.elements.find(
        (element) => element.type === "stickynote" && !element.isDeleted,
      ) as ExcalidrawStickyNoteElement;
      expect(note.width).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(note.height).toBe(DEFAULT_STICKY_NOTE_SIZE);

      // the placement is one entry; the empty editing session may add another
      const liveNotes = () =>
        h.elements.filter(
          (element) => element.type === "stickynote" && !element.isDeleted,
        );
      Keyboard.undo();
      if (liveNotes().length) {
        Keyboard.undo();
      }
      expect(liveNotes()).toHaveLength(0);
    });
  });

  describe("history", () => {
    const liveNotes = () =>
      h.elements.filter(
        (element) => element.type === "stickynote" && !element.isDeleted,
      );
    const createNoteByClick = async () => {
      UI.clickTool("stickynote");
      mouse.downAt(300, 300);
      mouse.up();
      const editor = await getTextEditor();
      // the editor arms its submit-on-blur a tick after the pointer-up
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      return editor;
    };

    it("undoes an abandoned note when the editor is escaped", async () => {
      const editor = await createNoteByClick();
      expect(API.getUndoStack()).toHaveLength(1);

      Keyboard.keyPress(KEYS.ESCAPE, editor);

      expect(liveNotes()).toHaveLength(1);
      expect(API.getUndoStack()).toHaveLength(1);
      Keyboard.undo();
      expect(liveNotes()).toHaveLength(0);
      Keyboard.redo();
      expect(liveNotes()).toHaveLength(1);
    });

    it("skips the empty label's history entry when clicking out", async () => {
      const editor = await createNoteByClick();

      // a click on empty canvas blurs the editor (submitting it), then its
      // pointer-up records — which used to leave the empty label's deletion
      // as a second, invisible entry. The wysiwyg's own outside-pointerdown
      // submit is disabled under vitest, so the blur is fired explicitly.
      fireEvent.blur(editor);
      mouse.downAt(900, 800);
      mouse.up();

      expect(h.state.editingTextElement).toBeNull();
      expect(liveNotes()).toHaveLength(1);
      expect(API.getUndoStack()).toHaveLength(2);
      Keyboard.undo();
      expect(liveNotes()).toHaveLength(0);
      expect(API.getUndoStack()).toHaveLength(0);
      Keyboard.redo();
      expect(liveNotes()).toHaveLength(1);
    });

    it("skips empty-label cleanup after a font change captures creation", async () => {
      const editor = await createNoteByClick();
      // Changing the empty label's baseFontSize is invisible too.
      act(() => {
        h.app.actionManager.executeAction(actionChangeFontSize, "ui", 28);
      });
      expect(h.state.editingTextElement).not.toBeNull();

      fireEvent.blur(editor);
      mouse.downAt(900, 800);
      mouse.up();

      Keyboard.undo();
      expect(liveNotes()).toHaveLength(0);
      expect(API.getUndoStack()).toHaveLength(0);
      Keyboard.redo();
      expect(liveNotes()).toHaveLength(1);
    });

    it("undoes typing separately from creating the note", async () => {
      const editor = await createNoteByClick();
      updateTextEditor(editor, "hello");
      Keyboard.keyPress(KEYS.ESCAPE, editor);

      const label = h.elements.find(
        (element) => element.type === "text" && !element.isDeleted,
      ) as ExcalidrawTextElement;
      expect(label.text).toBe("hello");
      expect(API.getUndoStack()).toHaveLength(2);
      Keyboard.undo();
      expect(liveNotes()).toHaveLength(1);
      expect(getElement<ExcalidrawTextElement>(label.id).text).toBe("");
      Keyboard.undo();
      expect(liveNotes()).toHaveLength(0);
      Keyboard.redo();
      expect(liveNotes()).toHaveLength(1);
      Keyboard.redo();
      expect(getElement<ExcalidrawTextElement>(label.id).text).toBe("hello");
    });
  });

  describe("resize handles", () => {
    const setup = () => {
      const { note, label } = createNote({
        id: "note",
        text: "hi",
        fontSize: 28,
      });
      API.setElements([note, label]);
      layoutNotes(note.id);
      API.setSelectedElements([getElement(note.id)]);
      return { note: getElement<ExcalidrawStickyNoteElement>(note.id), label };
    };
    const ceiling = (id: string) =>
      getElement<ExcalidrawTextElement>(id).baseFontSize;

    it("resizes proportionally from a corner by default and scales the ceiling", () => {
      const { note, label } = setup();
      UI.resize(note, "se", [50, 0]);

      const resized = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(resized.width).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);
      expect(resized.height).toBeCloseTo(resized.width);
      expect(resized.baseHeight).toBeCloseTo(resized.height);
      expect(ceiling(label.id)).toBeCloseTo(
        (28 * resized.width) / DEFAULT_STICKY_NOTE_SIZE,
      );
    });

    it("resizes freely from a corner with Shift, leaving the ceiling alone", () => {
      const { note, label } = setup();
      UI.resize(note, "se", [50, 0], { shift: true });

      const resized = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(resized.width).toBe(DEFAULT_STICKY_NOTE_SIZE + 50);
      expect(resized.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(ceiling(label.id)).toBe(28);
    });

    it("resizes an edge freely by default, keeping the base height and ceiling", () => {
      const { note, label } = setup();
      UI.resize(note, "e", [50, 0]);

      const resized = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(resized.width).toBe(DEFAULT_STICKY_NOTE_SIZE + 50);
      expect(resized.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(resized.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(ceiling(label.id)).toBe(28);
    });

    it("flips over the far corner like a rectangle, keeping the label upright", () => {
      const { note, label } = setup();
      // `note` is the live element; keep the pre-resize position to compare
      const { x: originalX, y: originalY } = note;
      // the SE corner dragged 400px up and left: past the NW corner
      UI.resize(note, "se", [-400, -400]);

      const resized = getElement<ExcalidrawStickyNoteElement>(note.id);
      const resizedLabel = getElement<ExcalidrawTextElement>(label.id);
      // proportional: 150px past the corner on both axes → a 150 square,
      // mirrored so its bottom-right sits on the original top-left
      expect(resized.width).toBeCloseTo(150);
      expect(resized.height).toBeCloseTo(150);
      expect(resized.x + resized.width).toBeCloseTo(originalX);
      expect(resized.y + resized.height).toBeCloseTo(originalY);
      expect(ceiling(label.id)).toBeCloseTo(
        (28 * 150) / DEFAULT_STICKY_NOTE_SIZE,
      );
      // the label is inside the flipped note and not mirrored
      expect(resizedLabel.angle).toBe(0);
      expect(resizedLabel.x).toBeGreaterThan(resized.x);
      expect(resizedLabel.y).toBeGreaterThan(resized.y);
    });

    const hintWhileDragging = (
      note: ExcalidrawStickyNoteElement,
      handle: "se" | "e",
    ) => {
      const [x, y, width, height] = getTransformHandles(
        note,
        h.state.zoom,
        h.app.scene.getNonDeletedElementsMap(),
        "mouse",
        {},
      )[handle]!;
      mouse.reset();
      mouse.downAt(x + width / 2, y + height / 2);
      mouse.moveTo(x + width / 2 + 30, y + height / 2 + 30);
      const hint =
        h.app.ownerDocument.querySelector(".HintViewer")?.textContent ?? "";
      mouse.up();
      return hint;
    };

    it("hints that a corner is proportional and Shift frees it", () => {
      const { note } = setup();
      expect(hintWhileDragging(note, "se")).toContain("resize freely");
    });

    it("hints that an edge is free and Shift constrains it", () => {
      const { note } = setup();
      expect(hintWhileDragging(note, "e")).toContain("constrain proportions");
    });

    it("constrains an edge with Shift and scales the ceiling", () => {
      const { note, label } = setup();
      UI.resize(note, "e", [50, 0], { shift: true });

      const resized = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(resized.width).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);
      expect(resized.height).toBeCloseTo(resized.width);
      expect(ceiling(label.id)).toBeCloseTo(
        (28 * resized.width) / DEFAULT_STICKY_NOTE_SIZE,
      );
    });
  });

  describe("Stats", () => {
    beforeAll(() => {
      mockBoundingClientRect();
    });
    afterAll(() => {
      restoreOriginalGetBoundingClientRect();
    });

    const openStats = () => {
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = UI.queryContextMenu();
      fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    };
    const statsInput = (label: string) =>
      UI.queryStatsProperty(label)?.querySelector(
        ".drag-input",
      ) as HTMLInputElement;

    it("keeps the base height on a width edit and scales the ceiling on a group edit", () => {
      const { note, label } = createNote({
        id: "note",
        text: LONG_TEXT,
        fontSize: 28,
      });
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rectangle",
        x: 400,
        y: 100,
        width: 100,
        height: DEFAULT_STICKY_NOTE_SIZE,
      });
      API.setElements([note, label, rectangle]);
      layoutNotes(note.id);
      openStats();

      API.setSelectedElements([getElement(note.id)]);
      UI.updateInput(statsInput("W"), "400");
      let updated = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(updated.width).toBe(400);
      expect(updated.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);

      API.setSelectedElements([getElement(note.id), getElement(rectangle.id)]);
      // a group is one atomic unit with a common width (an ungrouped pair
      // shows "Mixed"); group scaling is uniform
      API.executeAction(actionGroup);
      const groupWidth = statsInput("W");
      UI.updateInput(groupWidth, String(Number(groupWidth.value) * 2));
      updated = getElement<ExcalidrawStickyNoteElement>(note.id);
      expect(updated.width).toBe(800);
      expect(getElement<ExcalidrawTextElement>(label.id).baseFontSize).toBe(56);
    });
  });

  describe("creation date", () => {
    it("exports the same absolute date to SVG and canvas, omitting unknown dates", async () => {
      const elements = [
        API.createElement({
          type: "stickynote",
          width: DEFAULT_STICKY_NOTE_SIZE,
          height: DEFAULT_STICKY_NOTE_SIZE,
          // a past year, so the label carries it in every "current year"
          created: new Date(2025, 2, 7, 12).getTime(),
        }),
        API.createElement({
          type: "stickynote",
          x: 300,
          width: DEFAULT_STICKY_NOTE_SIZE,
          height: DEFAULT_STICKY_NOTE_SIZE,
          created: null,
        }),
      ];

      const svg = await exportToSvg(
        elements,
        { exportBackground: false, viewBackgroundColor: "#ffffff" },
        {},
      );
      expect(
        [...svg.querySelectorAll("text")].map((text) => text.textContent),
      ).toEqual(["7 Mar 2025"]);

      const canvas = await exportToCanvas({ elements, files: {} });
      expect(canvas.getContext("2d")?.fillText).toHaveBeenCalledWith(
        "7 Mar 2025",
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});

import React from "react";

import { KEYS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  updateBoundElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";
import { screen } from "@testing-library/react";

import type {
  ExcalidrawStickyNoteElement,
  NonDeleted,
  StickyNoteFooterOptions,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { act, fireEvent, render, togglePopover, waitFor } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");
const picker = () =>
  screen.getByRole("combobox", {
    name: "Sticky note footer",
  }) as HTMLSelectElement;
const currentNote = () =>
  h.elements.find(
    (element) => element.type === "stickynote",
  ) as ExcalidrawStickyNoteElement;
const selectNote = (
  footerOptions: StickyNoteFooterOptions | null = {
    type: "date",
    format: "short",
  },
) => {
  const note = API.createElement({
    type: "stickynote",
    width: 250,
    height: 250,
    footerOptions,
  });
  API.updateScene({
    elements: [note],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  API.setSelectedElements([note]);
  return note;
};

describe("sticky note footer picker", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        handleKeyboardGlobally
        UIOptions={{ getFormFactor: () => "desktop" }}
      />,
    );
  });

  it("works on an empty note and changes it in one undoable step", () => {
    selectNote();
    expect(picker().value).toBe("short");
    fireEvent.change(picker(), { target: { value: "short" } });
    expect(h.history.isUndoStackEmpty).toBe(true);
    fireEvent.change(picker(), { target: { value: "none" } });
    expect(currentNote().footerOptions).toBeNull();
    Keyboard.undo();
    expect(currentNote().footerOptions).toEqual({
      type: "date",
      format: "short",
    });
    Keyboard.redo();
    expect(currentNote().footerOptions).toBeNull();
  });

  it("configures new notes before they have a label", async () => {
    UI.clickTool("stickynote");
    fireEvent.change(picker(), { target: { value: "time" } });
    expect(h.state.currentItemStickynoteFooterOptions).toEqual({
      type: "date",
      format: "time",
    });
    expect(h.history.isUndoStackEmpty).toBe(true);
    mouse.downAt(300, 300);
    mouse.up();
    expect(currentNote().footerOptions).toEqual({
      type: "date",
      format: "time",
    });
    Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
  });

  it("shows distinct custom labels as mixed and changes only notes in a mixed selection", () => {
    const a = API.createElement({
      type: "stickynote",
      footerOptions: { type: "text", text: "Research" },
    });
    const b = API.createElement({
      type: "stickynote",
      x: 300,
      footerOptions: { type: "text", text: "Decide" },
    });
    const rectangle = API.createElement({ type: "rectangle", x: 600 });
    API.updateScene({
      elements: [a, b, rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([a, b, rectangle]);
    expect(picker().value).toBe("mixed");
    expect(a.footerOptions).toEqual({ type: "text", text: "Research" });
    fireEvent.change(picker(), { target: { value: "long" } });
    expect(
      h.elements
        .slice(0, 2)
        .map(
          (element) => (element as ExcalidrawStickyNoteElement).footerOptions,
        ),
    ).toEqual([
      { type: "date", format: "long" },
      { type: "date", format: "long" },
    ]);
    expect(h.elements[2]).toBe(rectangle);
    Keyboard.undo();
    expect(
      (h.elements[0] as ExcalidrawStickyNoteElement).footerOptions,
    ).toEqual({ type: "text", text: "Research" });
    expect(
      (h.elements[1] as ExcalidrawStickyNoteElement).footerOptions,
    ).toEqual({ type: "text", text: "Decide" });
  });

  it("shows custom content without replacing it just by opening the panel", () => {
    selectNote({ type: "text", text: "Research" });
    expect(picker().value).toBe("custom");
    expect(screen.getByRole("option", { name: "Custom text" })).toBeDisabled();
    expect(currentNote().footerOptions).toEqual({
      type: "text",
      text: "Research",
    });
    expect(h.history.isUndoStackEmpty).toBe(true);
  });

  it("targets the note while editing its label, without changing the label text", async () => {
    const elements = convertToExcalidrawElements([
      { type: "stickynote", x: 100, y: 100, label: { text: "Keep this idea" } },
    ]);
    API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
    mouse.doubleClickAt(200, 200);
    const editor = await getTextEditor();
    fireEvent.change(picker(), { target: { value: "none" } });
    expect(currentNote().footerOptions).toBeNull();
    expect(editor.value).toBe("Keep this idea");
    Keyboard.keyPress(KEYS.ESCAPE, editor);
  });

  it("keeps bound arrows attached when reclaiming the footer shrinks a grown note", () => {
    const elements = convertToExcalidrawElements([
      {
        type: "stickynote",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        label: { text: Array(35).fill("Idea").join("\n") },
      },
    ]);
    const note = elements[0] as NonDeleted<ExcalidrawStickyNoteElement>;
    const arrow = API.createElement({
      type: "arrow",
      x: note.x + note.width / 2,
      y: note.y + note.height + 100,
      points: [pointFrom(0, 0), pointFrom(0, -100)],
      endBinding: { elementId: note.id, fixedPoint: [0.5, 1], mode: "orbit" },
    });
    const boundNote = {
      ...note,
      boundElements: [
        ...(note.boundElements ?? []),
        { type: "arrow" as const, id: arrow.id },
      ],
    };
    API.updateScene({
      elements: [boundNote, ...elements.slice(1), arrow],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([boundNote]);
    act(() =>
      updateBoundElements(boundNote, h.app.scene, {
        renderEnvironment: h.app.renderEnvironment,
      }),
    );
    const height = currentNote().height;
    const endY = () => {
      const latest = h.elements.find(
        (element) => element.id === arrow.id,
      ) as typeof arrow;
      return latest.y + latest.points[1][1];
    };
    const originalEndY = endY();
    fireEvent.change(picker(), { target: { value: "none" } });
    expect(currentNote().height).toBeLessThan(height);
    expect(endY() - originalEndY).toBeCloseTo(currentNote().height - height, 0);
    Keyboard.undo();
    expect(currentNote().height).toBe(height);
    expect(endY()).toBeCloseTo(originalEndY);
  });

  it("hides the picker for unrelated shapes", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    expect(
      screen.queryByRole("combobox", { name: "Sticky note footer" }),
    ).toBeNull();
  });
});

describe.each(["tablet", "phone"] as const)(
  "footer picker in %s layout",
  (formFactor) => {
    it("is reachable even on an empty note", async () => {
      await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );
      fireEvent.resize(window);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe(formFactor),
      );
      selectNote();
      togglePopover("Sticky note footer");
      fireEvent.change(picker(), { target: { value: "none" } });
      expect(currentNote().footerOptions).toBeNull();
    });
  },
);

describe("host footer UI override", () => {
  it("allows hosts to hide the picker while keeping custom data", async () => {
    await render(<Excalidraw ui={{ disabled: { stickyNoteFooter: true } }} />);
    selectNote({ type: "text", text: "Research" });
    expect(
      screen.queryByRole("combobox", { name: "Sticky note footer" }),
    ).toBeNull();
    expect(currentNote().footerOptions).toEqual({
      type: "text",
      text: "Research",
    });
  });
});

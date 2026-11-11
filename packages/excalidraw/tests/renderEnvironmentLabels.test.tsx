import React from "react";
import { KEYS, reseed } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { RenderEnvironment } from "@excalidraw/element";
import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw, convertToExcalidrawElements } from "../index";
import { actionAlignTop } from "../actions/actionAlign";

import { API } from "./helpers/api";
import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { fireEvent, render, unmountComponent, waitFor } from "./test-utils";

// Mock CodeMirror deps so the TTD dialog falls back to a <textarea>.
vi.mock("@codemirror/view", () => ({}));
vi.mock("@codemirror/state", () => ({}));
vi.mock("@codemirror/language", () => ({}));
vi.mock("@lezer/highlight", () => ({}));

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

const LABEL = "aaaa bbbb cccc dddd eeee ffff";

/**
 * A host whose text metrics differ from the default (canvas) ones, so that any
 * label re-measured without it wraps differently: with it, `LABEL` fits on one
 * line (145px); with the default metrics, it wraps after "dddd".
 */
const renderEnvironment: RenderEnvironment = {
  createCanvas: () => document.createElement("canvas"),
  createImage: () => document.createElement("img"),
  textMetrics: { getLineWidth: (text) => text.length * 5 },
};

const getLabel = () =>
  h.elements.find(
    (element) => element.type === "text",
  ) as ExcalidrawTextElement;
const getRect = (id: string) =>
  h.elements.find((element) => element.id === id)!;

const expectLabelMeasuredByHost = () => {
  const label = getLabel();
  expect(label.text).toBe(LABEL);
  expect(label.width).toBe(145);
};

describe("bound labels re-measured with the host's render environment", () => {
  beforeEach(async () => {
    reseed(7);
    mouse.reset();
    await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        renderEnvironment={renderEnvironment}
      />,
    );
    API.setElements(
      convertToExcalidrawElements(
        [
          { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 100 },
          {
            type: "rectangle",
            id: "B",
            x: 400,
            y: 10,
            width: 100,
            height: 100,
          },
          {
            type: "arrow",
            id: "arrow",
            x: 100,
            y: 50,
            points: [pointFrom(0, 0), pointFrom(300, 0)],
            start: { id: "A" },
            end: { id: "B" },
            label: { text: LABEL },
          },
        ],
        { regenerateIds: false, renderEnvironment },
      ),
    );
    expect(h.app.renderEnvironment).toBe(renderEnvironment);
    expectLabelMeasuredByHost();
  });

  const dragRectBBy1px = () => {
    const rectB = getRect("B");
    mouse.select(rectB);
    mouse.downAt(rectB.x + 50, rectB.y + 50);
    mouse.moveTo(rectB.x + 51, rectB.y + 50);
    mouse.upAt(rectB.x + 51, rectB.y + 50);
  };

  it("when dragging a bound shape", () => {
    dragRectBBy1px();

    expect(getRect("B").x).toBe(401);
    expectLabelMeasuredByHost();
  });

  it("when nudging a bound shape with the arrow keys", () => {
    mouse.select(getRect("B"));
    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(getRect("B").x).toBe(401);
    expectLabelMeasuredByHost();
  });

  it("when aligning bound shapes", () => {
    mouse.select([getRect("A"), getRect("B")]);
    API.executeAction(actionAlignTop);

    expect(getRect("B").y).toBe(0);
    expectLabelMeasuredByHost();
  });

  it("when undoing and redoing a drag of a bound shape", () => {
    dragRectBBy1px();
    expect(getRect("B").x).toBe(401);

    Keyboard.undo();
    expect(getRect("B").x).toBe(400);
    expectLabelMeasuredByHost();

    Keyboard.redo();
    expect(getRect("B").x).toBe(401);
    expectLabelMeasuredByHost();
  });

  it("when dragging an arrow's point", () => {
    const arrow = h.elements.find(
      (element) => element.id === "arrow",
    ) as ExcalidrawArrowElement;
    mouse.select(arrow);
    UI.clickTool("selection");
    const [x, y] = [arrow.x + arrow.points[0][0], arrow.y + arrow.points[0][1]];
    mouse.downAt(x, y);
    mouse.moveTo(x, y + 1);
    mouse.upAt(x, y + 1);

    expectLabelMeasuredByHost();
  });
});

describe("mermaid labels measured with the host's render environment", () => {
  beforeAll(() => {
    mockMermaidToExcalidraw({
      parseMermaidToExcalidraw: async () => ({
        elements: [
          {
            type: "rectangle",
            id: "A",
            x: 0,
            y: 0,
            width: 100,
            height: 40,
            // fits on one line with the host's metrics (70px), but wraps with
            // the default ones, growing the rectangle to fit two lines
            label: { text: "aaaa bbbb cccc" },
          },
          {
            type: "rectangle",
            id: "B",
            x: 400,
            y: 10,
            width: 100,
            height: 100,
          },
          {
            type: "arrow",
            id: "arrow",
            x: 100,
            y: 50,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(300, 0),
            ],
            start: { id: "A" },
            end: { id: "B" },
            label: { text: LABEL },
          },
        ],
      }),
    });
  });

  it("when inserting from the mermaid dialog", async () => {
    await render(
      <Excalidraw
        renderEnvironment={renderEnvironment}
        initialData={{
          appState: { openDialog: { name: "ttd", tab: "mermaid" } },
        }}
      />,
    );
    const dialog = document.querySelector(".ttd-dialog")!;
    await waitFor(() => expect(dialog.querySelector("canvas")).not.toBeNull());

    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === "Insert",
      )!,
    );

    const texts = h.elements.filter(
      (element): element is ExcalidrawTextElement => element.type === "text",
    );
    const rectLabel = texts.find((text) => text.originalText !== LABEL)!;
    const arrowLabel = texts.find((text) => text.originalText === LABEL)!;
    expect(rectLabel.text).toBe("aaaa bbbb cccc");
    expect(rectLabel.width).toBe(70);
    expect(
      h.elements.find((el) => el.id === rectLabel.containerId)!.height,
    ).toBe(40);
    expect(arrowLabel.text).toBe(LABEL);
    expect(arrowLabel.width).toBe(145);
  });
});

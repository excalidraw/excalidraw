import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

/**
 * An arrow whose endpoint sits at (endX, endY), approached from (startX, startY).
 */
const createArrow = (
  id: string,
  [startX, startY]: [number, number],
  [endX, endY]: [number, number],
  overrides: Partial<ExcalidrawArrowElement> = {},
) =>
  API.createElement({
    type: "arrow",
    id,
    x: startX,
    y: startY,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(endX - startX, endY - startY),
    ],
    ...overrides,
  }) as ExcalidrawArrowElement;

const getText = () =>
  h.elements.find(
    (element): element is ExcalidrawTextElement => element.type === "text",
  )!;

const getArrow = (id: string) =>
  h.elements.find(
    (element): element is ExcalidrawArrowElement => element.id === id,
  )!;

/** global coordinates of an arrow's start/end point */
const endpointOf = (arrow: ExcalidrawArrowElement, which: "start" | "end") => {
  const point = arrow.points[which === "start" ? 0 : arrow.points.length - 1];
  return [arrow.x + point[0], arrow.y + point[1]] as const;
};

/**
 * `normalizeFixedPoint` nudges exact side midpoints off 0.5 by 1e-4 to keep
 * headings unambiguous, which shows up as a sub-pixel offset scaled by the
 * text size.
 */
const expectPointsClose = (
  actual: readonly [number, number],
  expected: readonly [number, number],
) => {
  expect(actual[0]).toBeCloseTo(expected[0], 1);
  expect(actual[1]).toBeCloseTo(expected[1], 1);
};

/** creates a text bound to the arrow endpoint at (x, y) via the text tool */
const bindTextAt = async (x: number, y: number, text: string) => {
  UI.clickTool("text");
  mouse.moveTo(x, y);
  mouse.clickAt(x, y);
  const editor = await getTextEditor();
  updateTextEditor(editor, text);
  return editor;
};

describe("binding text to an arrow endpoint", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  describe("hover affordance", () => {
    it("highlights a free arrow endpoint while the text tool is active", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowEndpoint).toEqual({
        elementId: "arrow",
        startOrEnd: "end",
      });

      // away from the endpoint
      mouse.moveTo(100, 200);
      expect(h.state.hoveredArrowEndpoint).toBeNull();
    });

    it("does not highlight endpoints for other tools", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("selection");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowEndpoint).toBeNull();
    });

    it("does not highlight an endpoint that is already bound", () => {
      API.setElements([
        createArrow("arrow", [100, 300], [100, 100], {
          endBinding: {
            elementId: "other",
            fixedPoint: [0.5001, 0.5001],
            mode: "orbit",
          },
        }),
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowEndpoint).toBeNull();
    });

    it("clears the highlight when switching away from the text tool", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowEndpoint).not.toBeNull();

      UI.clickTool("selection");
      expect(h.state.hoveredArrowEndpoint).toBeNull();
    });
  });

  describe("placement strategy", () => {
    // the side of the text the arrow attaches to is the one it already points
    // at, so the text lands beyond the tip and the arrow needn't move
    it.each([
      {
        name: "arrow pointing up binds the text's bottom side midpoint",
        from: [100, 300] as [number, number],
        to: [100, 100] as [number, number],
        fixedPoint: [0.5001, 1],
        textAlign: "center",
        verticalAlign: "bottom",
      },
      {
        name: "arrow pointing right binds the text's left side midpoint",
        from: [100, 100] as [number, number],
        to: [300, 100] as [number, number],
        fixedPoint: [0, 0.5001],
        textAlign: "left",
        verticalAlign: "middle",
      },
      {
        name: "arrow pointing down binds the text's top side midpoint",
        from: [100, 100] as [number, number],
        to: [100, 300] as [number, number],
        fixedPoint: [0.5001, 0],
        textAlign: "center",
        verticalAlign: "top",
      },
      {
        name: "arrow pointing left binds the text's right side midpoint",
        from: [300, 100] as [number, number],
        to: [100, 100] as [number, number],
        fixedPoint: [1, 0.5001],
        textAlign: "right",
        verticalAlign: "middle",
      },
    ])("$name", async ({ from, to, fixedPoint, textAlign, verticalAlign }) => {
      API.setElements([createArrow("arrow", from, to)]);

      await bindTextAt(to[0], to[1], "label");

      const text = getText();
      expect(getArrow("arrow").endBinding).toEqual({
        elementId: text.id,
        fixedPoint,
        mode: "orbit",
      });
      expect(text.textAlign).toBe(textAlign);
      expect(text.verticalAlign).toBe(verticalAlign);
      expect(text.containerId).toBeNull();
      expect(text.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("binds the start point when that is the endpoint under the cursor", async () => {
      // arrow drawn away from (100, 100) to the right
      API.setElements([createArrow("arrow", [100, 100], [300, 100])]);

      await bindTextAt(100, 100, "label");

      const text = getText();
      const arrow = getArrow("arrow");
      expect(arrow.startBinding?.elementId).toBe(text.id);
      expect(arrow.endBinding).toBeNull();
      // the arrow leaves the tip heading right, so the text sits to its left
      expect(arrow.startBinding?.fixedPoint).toEqual([1, 0.5001]);
      expect(text.textAlign).toBe("right");
    });
  });

  describe("the arrow stays put", () => {
    it("does not move the arrow when the text is created and typed into", async () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);
      const tipBefore = endpointOf(getArrow("arrow"), "end");

      const editor = await bindTextAt(100, 100, "a label");
      expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);

      // growing the text (wider + a second line) must not drag the tip
      updateTextEditor(editor, "a much longer label\nspanning two lines");
      expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);
    });

    it("keeps the bound side midpoint pinned as the text grows", async () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      const editor = await bindTextAt(100, 100, "short");
      const bottomMidOf = (text: ExcalidrawTextElement) =>
        [text.x + text.width / 2, text.y + text.height] as const;
      const anchorBefore = bottomMidOf(getText());

      updateTextEditor(editor, "a much longer label\nspanning two lines");

      const text = getText();
      expect(text.width).toBeGreaterThan(0);
      expectPointsClose(bottomMidOf(text), anchorBefore);
    });
  });

  describe("interaction with existing text-tool behavior", () => {
    it("adds a label to the arrow when clicking away from the endpoints", async () => {
      API.setElements([createArrow("arrow", [100, 100], [500, 100])]);

      await bindTextAt(300, 100, "label");

      const text = getText();
      // mid-arrow click is still the "arrow label" gesture
      expect(text.containerId).toBe("arrow");
      expect(getArrow("arrow").endBinding).toBeNull();
      expect(getArrow("arrow").startBinding).toBeNull();
    });

    it("removes the binding when the text is submitted empty", async () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      const editor = await bindTextAt(100, 100, "temporary");
      expect(getArrow("arrow").endBinding).not.toBeNull();

      updateTextEditor(editor, "");
      Keyboard.exitTextEditor(editor);

      expect(getArrow("arrow").endBinding).toBeNull();
      expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(
        1,
      );
    });
  });
});

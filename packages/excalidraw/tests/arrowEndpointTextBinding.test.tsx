import { KEYS } from "@excalidraw/common";

import { isTextElement } from "@excalidraw/element";

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

      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "end",
      });

      // away from the arrow entirely
      mouse.moveTo(400, 400);
      expect(h.state.hoveredArrowTextAnchor).toBeNull();
    });

    it("highlights the label midpoint when hovering the arrow itself", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("text");
      // mid-arrow, clear of both endpoints
      mouse.moveTo(100, 200);

      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "label",
      });
    });

    it("prefers the endpoint over the label midpoint", () => {
      // short enough that the endpoint and the midpoint are close together
      API.setElements([createArrow("arrow", [100, 160], [100, 100])]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor?.anchor).toBe("end");
    });

    it("does not offer a label midpoint on an arrow that already has one", () => {
      const arrow = createArrow("arrow", [100, 300], [100, 100]);
      const label = API.createElement({
        type: "text",
        containerId: arrow.id,
        text: "existing",
      });
      API.setElements([
        { ...arrow, boundElements: [{ id: label.id, type: "text" }] },
        label,
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 200);

      expect(h.state.hoveredArrowTextAnchor).toBeNull();
    });

    // a click only becomes a label when it snaps to the arrow's center, so
    // merely being inside the arrow's bounding box must not raise the anchor
    it("does not offer a label midpoint away from the arrow's center", () => {
      // bounding box spans (100,400)-(400,580); label centers on (250,580)
      API.setElements([
        API.createElement({
          type: "arrow",
          id: "arrow",
          x: 100,
          y: 400,
          width: 300,
          height: 180,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(150, 180),
            pointFrom<LocalPoint>(300, 0),
          ],
        }),
      ]);

      UI.clickTool("text");

      // inside the bounding box but nowhere near the stroke or the midpoint
      mouse.moveTo(150, 560);
      expect(h.state.hoveredArrowTextAnchor).toBeNull();

      // on the stroke, but far from the midpoint
      mouse.moveTo(175, 490);
      expect(h.state.hoveredArrowTextAnchor).toBeNull();

      mouse.moveTo(250, 580);
      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "label",
      });
    });

    it("does not highlight endpoints for other tools", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("selection");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor).toBeNull();
    });

    it("clears the highlight on escape", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowTextAnchor).not.toBeNull();

      // escape reverts the tool via the action's appState rather than
      // `setActiveTool`, so the highlight has to be cleared there too
      Keyboard.keyPress(KEYS.ESCAPE);

      expect(h.state.hoveredArrowTextAnchor).toBeNull();
    });
  });

  describe("binding toggle (ctrl/cmd)", () => {
    it("does not offer an endpoint while binding is disabled", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);
      API.setAppState({ isBindingEnabled: false });

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor).toBeNull();
    });

    it("still offers the label anchor — a label is not an arrow binding", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);
      API.setAppState({ isBindingEnabled: false });

      UI.clickTool("text");
      mouse.moveTo(100, 200);

      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "label",
      });
    });

    it("drops plain text instead of binding the endpoint", async () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);
      API.setAppState({ isBindingEnabled: false });

      await bindTextAt(100, 100, "plain");

      expect(getArrow("arrow").endBinding).toBeNull();
      expect(getArrow("arrow").startBinding).toBeNull();
      expect(getText().containerId).toBeNull();
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
        API.createElement({
          type: "rectangle",
          id: "other",
          x: 400,
          y: 400,
          width: 100,
          height: 100,
        }),
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowTextAnchor).toBeNull();

      // ...but the arrow can still take a label at its midpoint
      mouse.moveTo(100, 200);
      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "label",
      });
    });

    it("clears the highlight when switching away from the text tool", () => {
      API.setElements([createArrow("arrow", [100, 300], [100, 100])]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowTextAnchor).not.toBeNull();

      UI.clickTool("selection");
      expect(h.state.hoveredArrowTextAnchor).toBeNull();
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

    // An orbit binding resolves the endpoint by intersecting the arrow's own
    // line with the gap-grown text outline. Anchoring along the bound side's
    // normal instead used to leave the tip `gap * tan(angle)` off to the side
    // — invisible on orthogonal arrows, several px on diagonal ones, and only
    // once the first keystroke triggered `updateBoundElements`.
    it.each([
      { name: "45°", from: [100, 100] as [number, number] },
      { name: "steep", from: [160, 100] as [number, number] },
      { name: "shallow", from: [100, 160] as [number, number] },
    ])("does not shift a diagonal arrow's tip ($name)", async ({ from }) => {
      API.setElements([createArrow("arrow", from, [300, 300])]);
      const tipBefore = endpointOf(getArrow("arrow"), "end");

      const editor = await bindTextAt(300, 300, "x");
      expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);

      updateTextEditor(editor, "a considerably longer label");
      expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);
    });

    // the binding gap is derived from the *bind target*, so anchoring with the
    // arrow's stroke width offsets the tip by half the difference between the
    // two the moment `updateBoundElements` first runs
    it.each([
      { arrowStroke: 2, textStroke: "bold" as const },
      { arrowStroke: 4, textStroke: "thin" as const },
      { arrowStroke: 1, textStroke: "medium" as const },
    ])(
      "does not shift when the text's stroke width differs (arrow $arrowStroke vs $textStroke)",
      async ({ arrowStroke, textStroke }) => {
        API.setElements([
          createArrow("arrow", [100, 300], [100, 100], {
            strokeWidth: arrowStroke,
          }),
        ]);
        API.setAppState({ currentItemStrokeWidthKey: textStroke });
        const tipBefore = endpointOf(getArrow("arrow"), "end");

        const editor = await bindTextAt(100, 100, "x");
        expect(getText().strokeWidth).not.toBe(arrowStroke);
        expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);

        updateTextEditor(editor, "a considerably longer label");
        expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);
      },
    );
  });

  describe("drag-sizing", () => {
    /** press at the endpoint, drag to `toX`, release */
    const dragTextAt = async (
      [x, y]: [number, number],
      toX: number,
      text: string,
    ) => {
      UI.clickTool("text");
      mouse.moveTo(x, y);
      mouse.downAt(x, y);
      // several moves so the drag registers
      for (let i = 1; i <= 4; i++) {
        mouse.moveTo(x + ((toX - x) * i) / 4, y);
      }
      mouse.upAt(toX, y);
      const editor = await getTextEditor();
      updateTextEditor(editor, text);
      return editor;
    };

    it("sets a fixed width without moving the anchor (left-bound)", async () => {
      API.setElements([createArrow("arrow", [100, 100], [300, 100])]);

      // arrow points right, so the text hangs off its left edge at x = tip+gap
      await dragTextAt([300, 100], 520, "a label long enough to wrap");

      const text = getText();
      expect(text.autoResize).toBe(false);
      expect(text.textAlign).toBe("left");
      // left edge is the anchor and must be untouched by the drag
      expect(text.x).toBeCloseTo(306, 0);
      expect(text.width).toBeCloseTo(214, 0);
    });

    it("grows leftwards for a right-bound text, pinning its right edge", async () => {
      API.setElements([createArrow("arrow", [500, 100], [300, 100])]);

      await dragTextAt([300, 100], 80, "a label long enough to wrap");

      const text = getText();
      expect(text.autoResize).toBe(false);
      expect(text.textAlign).toBe("right");
      // the right edge is the anchor
      expect(text.x + text.width).toBeCloseTo(294, 0);
    });

    it("keeps a centred text centred on the anchor", async () => {
      API.setElements([createArrow("arrow", [300, 100], [300, 300])]);

      await dragTextAt([300, 300], 430, "a label long enough to wrap");

      const text = getText();
      expect(text.autoResize).toBe(false);
      expect(text.textAlign).toBe("center");
      expect(text.x + text.width / 2).toBeCloseTo(300, 0);
    });

    it("does not let the drag run back over the arrow", async () => {
      API.setElements([createArrow("arrow", [100, 100], [300, 100])]);

      // drag towards the arrow, i.e. the wrong side of the anchor
      await dragTextAt([300, 100], 150, "label");

      const text = getText();
      // treated as no drag at all — the text keeps autogrowing
      expect(text.autoResize).toBe(true);
      expect(text.x).toBeCloseTo(306, 0);
    });

    it("leaves the arrow endpoint where it was", async () => {
      API.setElements([createArrow("arrow", [100, 100], [300, 100])]);
      const tipBefore = endpointOf(getArrow("arrow"), "end");

      await dragTextAt([300, 100], 520, "a label long enough to wrap");

      expectPointsClose(endpointOf(getArrow("arrow"), "end"), tipBefore);
    });
  });

  describe("occlusion", () => {
    const coveringRect = (overrides: Record<string, unknown> = {}) =>
      API.createElement({
        type: "rectangle",
        id: "rect",
        x: 40,
        y: 40,
        width: 120,
        height: 120,
        backgroundColor: "#ffc9c9",
        ...overrides,
      });

    it("does not reach through an element stacked above the endpoint", async () => {
      // rect is drawn after (above) the arrow and covers its tip at (100, 100)
      API.setElements([
        createArrow("arrow", [100, 300], [100, 100]),
        coveringRect(),
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowTextAnchor).toBeNull();

      // the click belongs to the rect, as it would without the arrow there
      await bindTextAt(100, 100, "label");
      expect(getArrow("arrow").endBinding).toBeNull();
      expect(getText().containerId).toBe("rect");
    });

    it("still offers the endpoint when the arrow is stacked above", () => {
      API.setElements([
        coveringRect(),
        createArrow("arrow", [100, 300], [100, 100]),
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "end",
      });
    });

    it("is not occluded by a transparent element above it", () => {
      // transparent shapes are only hit on their stroke, so they don't cover
      API.setElements([
        createArrow("arrow", [100, 300], [100, 100]),
        coveringRect({ backgroundColor: "transparent" }),
      ]);

      UI.clickTool("text");
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: "arrow",
        anchor: "end",
      });
    });
  });

  describe("history", () => {
    // generic text-creation history behaviour lives in textWysiwyg.test.tsx;
    // these cover what the endpoint binding adds on top
    it("removes the text and its binding in a single undo", async () => {
      UI.createElement("arrow", { x: 100, y: 300, width: 0, height: -200 });
      const arrowId = h.elements[0].id;
      const arrow = () =>
        h.elements.find(
          (el): el is ExcalidrawArrowElement => el.id === arrowId,
        )!;

      const editor = await bindTextAt(100, 100, "bound");
      Keyboard.exitTextEditor(editor);
      const textId = arrow().endBinding?.elementId;
      expect(textId).toBeDefined();

      Keyboard.undo();

      expect(h.elements.find((el) => el.id === textId)?.isDeleted).toBe(true);
      expect(arrow().isDeleted).toBe(false);
      expect(arrow().endBinding).toBeNull();

      // and the endpoint is immediately reusable
      UI.clickTool("text");
      mouse.moveTo(100, 100);
      expect(h.state.hoveredArrowTextAnchor).toEqual({
        elementId: arrowId,
        anchor: "end",
      });
    });

    it("restores the text and its binding on redo", async () => {
      UI.createElement("arrow", { x: 100, y: 300, width: 0, height: -200 });
      const arrowId = h.elements[0].id;
      const arrow = () =>
        h.elements.find(
          (el): el is ExcalidrawArrowElement => el.id === arrowId,
        )!;

      const editor = await bindTextAt(100, 100, "bound");
      Keyboard.exitTextEditor(editor);
      const textId = arrow().endBinding?.elementId;

      Keyboard.undo();
      Keyboard.redo();

      const text = h.elements.find((el) => el.id === textId)!;
      expect(text.isDeleted).toBe(false);
      expect(isTextElement(text) && text.text).toBe("bound");
      expect(arrow().endBinding?.elementId).toBe(textId);
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

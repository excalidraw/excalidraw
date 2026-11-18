import React from "react";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { GlobalTestState, render, unmountComponent } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

/**
 * Regression tests for #8435: alt-dragging a lone bound arrow must
 * duplicate it unbound and move the duplicate, leaving the original
 * (and its binding) untouched.
 *
 * The arrow is stored the way the editor stores a user-drawn one:
 * normalized, with its start point at (0, 0) — start free at (200, 50),
 * end bound to the rectangle's right edge at (100, 50).
 */
describe("alt-drag a bound arrow (#8435)", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    mouse.reset();
    await render(
      <Excalidraw
        initialData={{
          appState: { zoom: { value: 1 as NormalizedZoomValue } },
        }}
      />,
    );
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  afterEach(() => {
    mouse.reset();
  });

  /** alt-drag starting on the arrow's midpoint, by (offset, offset) */
  const altDrag = (offset: number) => {
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(150, 50);
      mouse.moveTo(150 + offset / 2, 50 + offset / 2);
      mouse.moveTo(150 + offset, 50 + offset);
      mouse.up();
    });
  };

  /** a rectangle with an arrow whose end is bound to it; only the arrow selected */
  const setup = (elbowed: boolean) => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed,
      x: 200,
      y: 50,
      width: 100,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-100, 0)],
      endBinding: {
        elementId: rectangle.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
      startBinding: null,
    }) as ExcalidrawArrowElement;
    API.setElements([
      { ...rectangle, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([arrow as NonDeleted<ExcalidrawArrowElement>]);
    // capture primitives: the element objects are replaced during the drag
    return {
      rectangleId: rectangle.id,
      arrowId: arrow.id,
      arrowX: arrow.x,
      arrowY: arrow.y,
    };
  };

  const getArrows = () =>
    h.elements.filter(
      (el): el is ExcalidrawArrowElement => el.type === "arrow",
    );

  for (const elbowed of [false, true]) {
    it(`elbowed=${elbowed}: duplicate is unbound and follows the drag`, () => {
      const { arrowId, arrowX, arrowY } = setup(elbowed);

      altDrag(100);

      // a duplicate was created
      const arrows = getArrows();
      expect(arrows).toHaveLength(2);
      const duplicate = arrows.find((a) => a.id !== arrowId)!;
      expect(duplicate).toBeDefined();

      // the duplicate carries no bindings
      expect(duplicate.startBinding).toBeNull();
      expect(duplicate.endBinding).toBeNull();

      // the duplicate follows the drag
      expect(duplicate.x).toBe(arrowX + 100);
      expect(duplicate.y).toBe(arrowY + 100);
    });

    it(`elbowed=${elbowed}: original keeps its binding`, () => {
      const { rectangleId, arrowId, arrowX, arrowY } = setup(elbowed);

      altDrag(100);

      const original = getArrows().find((a) => a.id === arrowId)!;
      // the original stays where it was
      expect(original.x).toBe(arrowX);
      expect(original.y).toBe(arrowY);
      // and keeps its binding to the rectangle
      expect(original.endBinding?.elementId).toBe(rectangleId);

      const rect = h.elements.find((el) => el.id === rectangleId)!;
      expect(rect.boundElements).toEqual([{ id: arrowId, type: "arrow" }]);
    });
  }
});

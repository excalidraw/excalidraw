import { KEYS, ROUNDNESS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

describe("convert element type", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // #9662
  it("recalculates roundness type when switching between generic shapes", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, // Dooesn't matter as long as it is set
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "diamond",
      });
    });

    expect(h.elements[0].type).toBe("diamond");
    expect(h.elements[0].roundness?.type).toBe(ROUNDNESS.PROPORTIONAL_RADIUS);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "rectangle",
      });
    });

    expect(h.elements[0].type).toBe("rectangle");
    expect(h.elements[0].roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
  });

  describe("switching a linear element back to a previous type", () => {
    const openSwitcher = (points: LocalPoint[]) => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        points,
        roundness: null,
      });
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);
      act(() => h.app.focusContainer());
      Keyboard.keyPress(KEYS.TAB);
    };

    const switchBack = () => {
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.TAB);
      });
    };

    it("moves the version forward, so it can be undone", () => {
      openSwitcher([pointFrom(0, 0), pointFrom(100, 0)]);
      Keyboard.keyPress(KEYS.TAB);
      const curved = API.getElement(h.elements[0]);
      expect(curved.roundness).not.toBe(null);

      switchBack();
      const sharp = API.getElement(h.elements[0]);
      expect(sharp.roundness).toBe(null);
      expect(sharp.version).toBeGreaterThan(curved.version);

      Keyboard.undo();
      expect(API.getElement(h.elements[0]).roundness).toEqual(curved.roundness);
    });

    it("keeps changes made since the type was left", () => {
      openSwitcher([pointFrom(0, 0), pointFrom(100, 0)]);
      Keyboard.keyPress(KEYS.TAB);
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.ARROW_RIGHT);
      });
      API.updateElement(h.elements[0], { strokeColor: "#e03131" });
      const { x, y } = h.elements[0];

      switchBack();
      expect(h.elements[0]).toMatchObject({
        roundness: null,
        x,
        y,
        strokeColor: "#e03131",
      });
    });

    it("restores the points an elbow conversion rewrote", () => {
      const points = [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 50),
      ];
      openSwitcher(points);
      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "elbowArrow",
        });
      });
      expect(h.elements[0]).not.toMatchObject({ points });

      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "sharpArrow",
        });
      });
      expect(h.elements[0]).toMatchObject({ elbowed: false, points });
      expect(h.elements[0]).not.toHaveProperty("fixedSegments");
    });
  });
});

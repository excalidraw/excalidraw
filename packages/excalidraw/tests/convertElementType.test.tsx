import { ROUNDNESS } from "@excalidraw/common";

import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
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

  // #11967
  it("preserves endArrowhead when converting an arrow to elbow", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
      endArrowhead: "triangle",
    });

    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "elbowArrow",
      });
    });

    expect((h.elements[0] as ExcalidrawArrowElement).endArrowhead).toBe(
      "triangle",
    );
  });
});

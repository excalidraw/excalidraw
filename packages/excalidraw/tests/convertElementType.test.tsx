import { ROUNDNESS } from "@excalidraw/common";

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

  it("drops roundness when converting a rectangle to a star", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 80,
      height: 60,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "star",
      });
    });

    expect(h.elements[0].type).toBe("star");
    expect(h.elements[0].x).toBe(10);
    expect(h.elements[0].y).toBe(20);
    expect(h.elements[0].width).toBe(80);
    expect(h.elements[0].height).toBe(60);
    expect(h.elements[0].roundness).toBeNull();
  });
});

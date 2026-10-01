import { ROUNDNESS } from "@excalidraw/common";
import { getLinearElementSubType } from "@excalidraw/element";

import {
  convertElementTypes,
  getConversionTypeFromElements,
} from "../components/ConvertElementTypePopup";
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

  // #9656
  describe("arrows bound to elements", () => {
    const setupBoundArrow = () => {
      const rectangle = API.createElement({
        type: "rectangle",
        x: 300,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        x: 0,
        y: 50,
        width: 250,
        height: 0,
        endBinding: {
          elementId: rectangle.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });

      API.setElements([rectangle, arrow]);
      API.setSelectedElements([arrow]);

      return arrow;
    };

    it("keeps a bound arrow eligible for the shape switcher", () => {
      const arrow = setupBoundArrow();

      // previously returned `null`, which disabled the Tab switcher entirely
      expect(getConversionTypeFromElements([arrow])).toBe("linear");
    });

    it("switches a bound arrow between arrow subtypes and keeps the binding", () => {
      const arrow = setupBoundArrow();

      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "curvedArrow",
        });
      });

      const converted = h.elements.find((element) => element.id === arrow.id)!;
      expect(getLinearElementSubType(converted as any)).toBe("curvedArrow");
      expect((converted as any).endBinding).not.toBeNull();
    });

    it("never cycles a bound arrow into a line", () => {
      const arrow = setupBoundArrow();

      // cycle through more steps than there are target types so any `line`
      // in the rotation would be hit
      const visitedSubTypes = new Set<string>();
      for (let i = 0; i < 4; i++) {
        act(() => {
          convertElementTypes(h.app, {
            conversionType: "linear",
            direction: "right",
          });
        });
        const current = h.elements.find((element) => element.id === arrow.id)!;
        visitedSubTypes.add(getLinearElementSubType(current as any));
      }

      expect(visitedSubTypes.has("line")).toBe(false);
    });

    it("still allows an unbound arrow to convert into a line", () => {
      const arrow = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
      });
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);

      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "line",
        });
      });

      expect(getLinearElementSubType(h.elements[0] as any)).toBe("line");
    });
  });
});

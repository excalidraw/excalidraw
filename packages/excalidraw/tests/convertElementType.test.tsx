import { ROUNDNESS } from "@excalidraw/common";

import { getLinearElementSubType } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import {
  convertElementTypes,
  convertElementTypePopupAtom,
} from "../components/ConvertElementTypePopup";
import { Excalidraw } from "../index";
import { editorJotaiStore } from "../editor-jotai";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

const createBoundArrow = () => {
  const rectangle = API.createElement({
    type: "rectangle",
    width: 100,
    height: 100,
  });
  const arrow = API.createElement({
    type: "arrow",
    x: 150,
    y: 50,
    width: 100,
  });

  API.setElements([rectangle, arrow]);

  act(() => {
    h.app.scene.mutateElement(arrow, {
      startBinding: {
        elementId: rectangle.id,
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
      endBinding: null,
    });
    h.app.scene.mutateElement(rectangle, {
      boundElements: [{ type: "arrow", id: arrow.id }],
    });
  });

  return { rectangle, arrow };
};

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

  describe("bound arrows (#9656)", () => {
    it("switches a bound arrow between arrow sub-types, preserving bindings", () => {
      const { rectangle, arrow } = createBoundArrow();
      API.setSelectedElements([arrow]);

      const assertBindingsIntact = () => {
        const current = h.elements.find(
          (el) => el.id === arrow.id,
        ) as ExcalidrawArrowElement;
        expect(current.startBinding?.elementId).toBe(rectangle.id);
        expect(current.boundElements).toEqual(arrow.boundElements);
        return current;
      };

      // sharp -> curved
      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "curvedArrow",
        });
      });
      expect(
        getLinearElementSubType(
          h.elements.find((el) => el.id === arrow.id) as ExcalidrawArrowElement,
        ),
      ).toBe("curvedArrow");
      assertBindingsIntact();

      // curved -> elbow
      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "elbowArrow",
        });
      });
      expect(
        getLinearElementSubType(
          h.elements.find((el) => el.id === arrow.id) as ExcalidrawArrowElement,
        ),
      ).toBe("elbowArrow");
      assertBindingsIntact();
    });

    it("cycling through types never converts a bound arrow to a line", () => {
      const { arrow } = createBoundArrow();
      API.setSelectedElements([arrow]);

      for (let i = 0; i < 6; i++) {
        act(() => {
          convertElementTypes(h.app, { conversionType: "linear" });
        });

        const current = h.elements.find((el) => el.id === arrow.id)!;
        expect(current.type).toBe("arrow");
      }
    });

    it("rejects explicit line conversion for bound arrows", () => {
      const { arrow } = createBoundArrow();
      API.setSelectedElements([arrow]);

      let result: boolean = true;
      act(() => {
        result = convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "line",
        });
      });

      expect(result).toBe(false);
      expect(h.elements.find((el) => el.id === arrow.id)?.type).toBe("arrow");
    });

    it("still offers all types (incl. line) to unbound arrows", () => {
      const unboundArrow = API.createElement({ type: "arrow" });
      API.setElements([unboundArrow]);
      API.setSelectedElements([unboundArrow]);

      act(() => {
        convertElementTypes(h.app, { conversionType: "linear" });
      });

      expect(
        getLinearElementSubType(
          h.elements.find(
            (el) => el.id === unboundArrow.id,
          ) as ExcalidrawArrowElement,
        ),
      ).toBe("curvedArrow");
    });

    it("labeled arrows are treated as bound", () => {
      const [labeledArrow] = API.createLabeledArrow();
      API.setElements([labeledArrow as ExcalidrawElement]);
      API.setSelectedElements([labeledArrow]);

      const result = convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });

      expect(result).toBe(false);
      expect(labeledArrow.type).toBe("arrow");
    });

    it("keeps the bound text attached across sub-type switches", () => {
      const [labeledArrow, labelText] = API.createLabeledArrow();
      API.setElements([
        labeledArrow as ExcalidrawElement,
        labelText as ExcalidrawElement,
      ]);
      API.setSelectedElements([labeledArrow]);

      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "curvedArrow",
        });
      });
      act(() => {
        convertElementTypes(h.app, {
          conversionType: "linear",
          nextType: "elbowArrow",
        });
      });

      const converted = h.elements.find(
        (el) => el.id === labeledArrow.id,
      ) as ExcalidrawArrowElement;
      expect(getLinearElementSubType(converted)).toBe("elbowArrow");

      // the label must survive as a bound, non-deleted child of the arrow
      const label = h.elements.find(
        (el) =>
          el.type === "text" &&
          (el as ExcalidrawTextElement).containerId === labeledArrow.id,
      ) as ExcalidrawTextElement | undefined;
      expect(label).toBeDefined();
      expect(label!.isDeleted).toBe(false);
      expect(converted.boundElements?.some((be) => be.id === label!.id)).toBe(
        true,
      );
    });
  });

  describe("shape switcher popup (#9656)", () => {
    const openShapeSwitchPanel = () => {
      act(() => {
        editorJotaiStore.set(convertElementTypePopupAtom, { type: "panel" });
        h.app.setState({});
      });
    };

    const getPopupButtonTypes = () => {
      const popup = document.querySelector(".ConvertElementTypePopup");
      expect(popup).not.toBeNull();
      const buttons = popup!.querySelectorAll<HTMLElement>(
        "[data-testid^='toolbar-']",
      );
      return Array.from(buttons).map((button) =>
        button.dataset.testid!.replace("toolbar-", ""),
      );
    };

    it("offers only arrow sub-types for a bound arrow (no line)", () => {
      const { arrow } = createBoundArrow();
      API.setSelectedElements([arrow]);

      openShapeSwitchPanel();

      expect(getPopupButtonTypes().sort()).toEqual([
        "curvedArrow",
        "elbowArrow",
        "sharpArrow",
      ]);
    });

    it("offers all types including line for an unbound line", () => {
      const line = API.createElement({ type: "line" });
      API.setElements([line]);
      API.setSelectedElements([line]);

      openShapeSwitchPanel();

      expect(getPopupButtonTypes().sort()).toEqual([
        "curvedArrow",
        "elbowArrow",
        "line",
        "sharpArrow",
      ]);
    });
  });
});

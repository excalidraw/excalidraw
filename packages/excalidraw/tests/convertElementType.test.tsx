import { KEYS, ROUNDNESS } from "@excalidraw/common";

import {
  convertElementTypePopupAtom,
  convertElementTypes,
} from "../components/ConvertElementTypePopup";
import { editorJotaiStore } from "../editor-jotai";
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

  it.each([KEYS.ESCAPE, KEYS.ENTER])(
    "%s only closes the popup, keeping the selection and not editing",
    (key) => {
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);

      act(() => {
        editorJotaiStore.set(convertElementTypePopupAtom, { type: "panel" });
      });

      Keyboard.keyPress(key);

      expect(editorJotaiStore.get(convertElementTypePopupAtom)).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [h.elements[0].id]: true });
      expect(h.state.editingTextElement).toBe(null);
      expect(h.elements.length).toBe(1);
    },
  );
});

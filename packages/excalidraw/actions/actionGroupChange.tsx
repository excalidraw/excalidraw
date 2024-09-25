import { cutIcon } from "../components/icons";
import { newElement } from "../element";
import { mutateElement } from "../element/mutateElement";
import { KEYS } from "../keys";
import { findShapeByKey } from "../shapes";
import { StoreAction } from "../store";
import { actionDeleteSelected } from "./actionDeleteSelected";
import { register } from "./register";

export const actionGroupChange = register({
  name: "groupChange",
  label: "labels.groupChange",
  icon: cutIcon,
  trackEvent: { category: "element", action: "groupChange" },
  perform: (
    elements,
    appState,
    event: React.KeyboardEvent | KeyboardEvent,
    app,
  ) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });
    const pickedShape = findShapeByKey("4");

    const next_Elements = elements.map((ele) => {
      if (
        selectedElements.some((e) => e.id === ele.id) &&
        ele.type !== pickedShape &&
        pickedShape &&
        (pickedShape === "diamond" ||
          pickedShape === "ellipse" ||
          pickedShape === "rectangle")
      ) {
        return newElement({ ...ele, type: pickedShape });
      }
      return ele;
    });
    return {
      elements: next_Elements,
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    (event.key === KEYS[2] || event.key === KEYS[3] || event.key === KEYS[4]),
});

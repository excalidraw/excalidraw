import { cutIcon } from "../components/icons";
import { newElement } from "../element";
import type { ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { randomInteger } from "../random";
import { StoreAction } from "../store";
import type { AppClassProperties, AppState } from "../types";
import { register } from "./register";

const changeShapeForAllSelected =
  (newType: "rectangle" | "diamond" | "ellipse") =>
  (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    value: null,
    app: AppClassProperties,
  ) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeElementsInFrames: true,
    });

    return {
      elements: [
        ...elements,
        ...selectedElements.map((el) =>
          newElement({
            ...el,
            type: newType,
            versionNonce: randomInteger(), // Force state update
          }),
        ),
      ],
      storeAction: StoreAction.CAPTURE,
    };
  };

export const actionChangeToRectangle = register({
  name: "changeToRectangle",
  label: "labels.changeToRectangle",
  icon: cutIcon,
  trackEvent: { category: "element", action: "changeToRectangle" },
  perform: changeShapeForAllSelected("rectangle"),
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[2],
});

export const actionChangeToDiamond = register({
  name: "changeToDiamond",
  label: "labels.changeToDiamond",
  icon: cutIcon,
  trackEvent: { category: "element", action: "changeToRectangle" },
  perform: changeShapeForAllSelected("diamond"),
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[3],
});

export const actionChangeToEllipse = register({
  name: "changeToEllipse",
  label: "labels.changeToEllipse",
  icon: cutIcon,
  trackEvent: { category: "element", action: "changeToEllipse" },
  perform: changeShapeForAllSelected("ellipse"),
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[4],
});

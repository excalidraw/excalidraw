import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  convertElementTypes,
  getConversionTypeFromElements,
} from "../components/ConvertElementTypePopup";

import { register } from "./register";

import type { ActionName } from "./types";

// ponytail: flat menu items + Alt+{num} keymap reuse existing convertElementTypes.
// Submenu in ContextMenu would be its own infra; skip until a second feature needs it.

const makeConvert = (
  name: ActionName,
  label: string,
  conversionType: "generic" | "linear",
  nextType: "rectangle" | "diamond" | "ellipse" | "sharpArrow" | "line",
) =>
  register({
    name,
    label,
    icon: () => null,
    trackEvent: { category: "element" },
    perform: (_elements, _appState, _formData, app) => {
      // ponytail: cast — convertElementTypes only touches scene/state/setState/updateEditorAtom,
      // all on AppClassProperties. Narrow the param type if a second caller hits this.
      convertElementTypes(app as any, { conversionType, nextType });
      return { captureUpdate: CaptureUpdateAction.IMMEDIATELY };
    },
    predicate: (elements, appState) => {
      const selected = (elements as ExcalidrawElement[]).filter(
        (el) => appState.selectedElementIds[el.id] && !el.isDeleted,
      );
      return getConversionTypeFromElements(selected) === conversionType;
    },
  });

export const actionConvertToRectangle = makeConvert(
  "convertToRectangle",
  "labels.convertToRectangle",
  "generic",
  "rectangle",
);

export const actionConvertToDiamond = makeConvert(
  "convertToDiamond",
  "labels.convertToDiamond",
  "generic",
  "diamond",
);

export const actionConvertToEllipse = makeConvert(
  "convertToEllipse",
  "labels.convertToEllipse",
  "generic",
  "ellipse",
);

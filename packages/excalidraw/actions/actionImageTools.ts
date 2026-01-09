import { isImageElement } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import { register } from "./register";

import type { Action } from "./types";

const createImageToolAction = (
  name: Action["name"],
  label: string,
  tool: "crop" | "edit" | "extend" | "upscale" | "layers",
) =>
  register({
    name,
    label,
    trackEvent: {
      category: "element",
    },
    predicate: (_elements, appState, appProps, app) => {
      if (!appProps.onImageToolAction) {
        return false;
      }
      const selected = app.scene.getSelectedElements(appState);
      return selected.some((element) => isImageElement(element));
    },
    perform: (_elements, appState, _value, app) => {
      const selected = app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: false,
      });
      const imageElement = selected.find((element) => isImageElement(element));

      if (!imageElement || !app.props.onImageToolAction) {
        return false;
      }

      app.props.onImageToolAction(tool, imageElement.id);
      return {
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    },
  });

export const actionImageCrop = createImageToolAction(
  "imageCrop",
  "Crop",
  "crop",
);
export const actionImageEdit = createImageToolAction(
  "imageEdit",
  "Edit",
  "edit",
);
export const actionImageExtend = createImageToolAction(
  "imageExtend",
  "Extend",
  "extend",
);
export const actionImageUpscale = createImageToolAction(
  "imageUpscale",
  "Upscale",
  "upscale",
);
export const actionImageLayers = createImageToolAction(
  "imageLayers",
  "Layers",
  "layers",
);

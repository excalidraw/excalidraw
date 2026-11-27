import { CaptureUpdateAction } from "@excalidraw/element";

import { getDefaultAppState } from "../appState";
import { paintIcon } from "../components/icons";

import { register } from "./register";

export const actionResetToolStyles = register({
  name: "resetToolStyles",
  label: "labels.resetToolStyles",
  icon: paintIcon,
  keywords: ["reset", "default", "style", "tools"],
  viewMode: false,
  trackEvent: { category: "toolbar" },
  perform: () => {
    const defaults = getDefaultAppState();
    return {
      // Reset creation defaults only, never the selected elements or canvas.
      appState: {
        currentItemBackgroundColor: defaults.currentItemBackgroundColor,
        currentItemEndArrowhead: defaults.currentItemEndArrowhead,
        currentItemFillStyle: defaults.currentItemFillStyle,
        currentItemFontFamily: defaults.currentItemFontFamily,
        currentItemFontSize: defaults.currentItemFontSize,
        currentItemOpacity: defaults.currentItemOpacity,
        currentItemRoughness: defaults.currentItemRoughness,
        currentItemStrokeVariability: defaults.currentItemStrokeVariability,
        currentItemStartArrowhead: defaults.currentItemStartArrowhead,
        currentItemStrokeColor: defaults.currentItemStrokeColor,
        currentItemStickynoteStrokeColor:
          defaults.currentItemStickynoteStrokeColor,
        currentItemStickynoteBackgroundColor:
          defaults.currentItemStickynoteBackgroundColor,
        currentItemRoundness: defaults.currentItemRoundness,
        currentItemArrowType: defaults.currentItemArrowType,
        currentItemStrokeStyle: defaults.currentItemStrokeStyle,
        currentItemStrokeWidthKey: defaults.currentItemStrokeWidthKey,
        currentItemTextAlign: defaults.currentItemTextAlign,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

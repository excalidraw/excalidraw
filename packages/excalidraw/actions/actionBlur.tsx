import { newElementWith } from "@excalidraw/element/mutateElement";

// TODO barnabasmolnar/editor-redesign
// TextAlignTopIcon, TextAlignBottomIcon,TextAlignMiddleIcon,
// ArrowHead icons
import { isBlurElement } from "@excalidraw/element/typeChecks";

import { CaptureUpdateAction } from "@excalidraw/element/store";

import { BlurRange } from "../components/Range";

import { register } from "./register";

import { changeProperty } from "./actionProperties";

export const actionChangeBlur = register({
  name: "changeBlur",
  label: "labels.blur",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (el) => {
          if (!isBlurElement(el)) {
            return el;
          }

          return newElementWith(el, {
            blur: value,
          });
        },
        true,
      ),
      appState: { ...appState, currentItemBlur: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <BlurRange
      updateData={updateData}
      elements={elements}
      appState={appState}
      testId="blur"
    />
  ),
});

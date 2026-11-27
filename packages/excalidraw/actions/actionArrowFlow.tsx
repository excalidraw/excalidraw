import {
  CaptureUpdateAction,
  DEFAULT_ARROW_FLOW,
  isArrowElement,
  newElementWith,
  normalizeArrowFlow,
} from "@excalidraw/element";

import type {
  ArrowFlow,
  ArrowFlowDirection,
  ArrowFlowSpeed,
} from "@excalidraw/element/types";

import { RadioSelection } from "../components/RadioSelection";
import {
  arrowFlowBackwardIcon,
  arrowFlowBothIcon,
  arrowFlowForwardIcon,
  arrowFlowNoneIcon,
  arrowFlowFastIcon,
  arrowFlowNormalIcon,
  arrowFlowSlowIcon,
} from "../components/icons";
import { t } from "../i18n";

import { changeProperty, getFormValue } from "./actionProperties";
import { register } from "./register";

type FlowChoice = ArrowFlowDirection | "none";

export type ArrowFlowUpdate =
  | { direction: FlowChoice }
  | { speed: ArrowFlowSpeed };

/**
 * Packets moving along the selected arrows — which way they go, and how fast.
 * Choosing a speed on a still arrow starts it moving forward.
 */
export const actionChangeArrowFlow = register<ArrowFlowUpdate>({
  name: "changeArrowFlow",
  label: "labels.arrowFlow",
  trackEvent: false,
  perform: (elements, appState, value) => {
    if (!value) {
      return false;
    }
    return {
      elements: changeProperty(elements, appState, (element) => {
        if (!isArrowElement(element)) {
          return element;
        }
        const current = normalizeArrowFlow(element.flow);
        let flow: ArrowFlow | null;
        if ("direction" in value) {
          flow =
            value.direction === "none"
              ? null
              : {
                  direction: value.direction,
                  speed: current?.speed ?? DEFAULT_ARROW_FLOW.speed,
                };
        } else {
          flow = {
            direction: current?.direction ?? DEFAULT_ARROW_FLOW.direction,
            speed: value.speed,
          };
        }
        return newElementWith(element, { flow });
      }),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, updateData, app }) => {
    const direction = getFormValue<FlowChoice | null>(
      elements,
      app,
      (element) =>
        isArrowElement(element)
          ? normalizeArrowFlow(element.flow)?.direction ?? "none"
          : null,
      (element) => isArrowElement(element),
      (hasSelection) => (hasSelection ? null : "none"),
    );
    const speed = getFormValue<ArrowFlowSpeed | null>(
      elements,
      app,
      (element) =>
        isArrowElement(element)
          ? normalizeArrowFlow(element.flow)?.speed ?? null
          : null,
      (element) => isArrowElement(element) && !!element.flow,
      null,
    );

    return (
      <>
        <fieldset>
          <legend>{t("labels.arrowFlow")}</legend>
          <div className="buttonList">
            <RadioSelection<FlowChoice>
              group="arrowflow"
              options={[
                {
                  value: "none",
                  text: t("labels.arrowFlow_none"),
                  icon: arrowFlowNoneIcon,
                  testId: "arrow-flow-none",
                },
                {
                  value: "forward",
                  text: t("labels.arrowFlow_forward"),
                  icon: arrowFlowForwardIcon,
                  testId: "arrow-flow-forward",
                },
                {
                  value: "backward",
                  text: t("labels.arrowFlow_backward"),
                  icon: arrowFlowBackwardIcon,
                  testId: "arrow-flow-backward",
                },
                {
                  value: "both",
                  text: t("labels.arrowFlow_both"),
                  icon: arrowFlowBothIcon,
                  testId: "arrow-flow-both",
                },
              ]}
              value={direction}
              onChange={(value) => updateData({ direction: value })}
            />
          </div>
        </fieldset>
        {direction && direction !== "none" && (
          <fieldset>
            <legend>{t("labels.arrowFlowSpeed")}</legend>
            <div className="buttonList">
              <RadioSelection<ArrowFlowSpeed>
                group="arrowflowspeed"
                options={[
                  {
                    value: "slow",
                    text: t("labels.arrowFlowSpeed_slow"),
                    icon: arrowFlowSlowIcon,
                    testId: "arrow-flow-slow",
                  },
                  {
                    value: "normal",
                    text: t("labels.arrowFlowSpeed_normal"),
                    icon: arrowFlowNormalIcon,
                    testId: "arrow-flow-normal",
                  },
                  {
                    value: "fast",
                    text: t("labels.arrowFlowSpeed_fast"),
                    icon: arrowFlowFastIcon,
                    testId: "arrow-flow-fast",
                  },
                ]}
                value={speed}
                onChange={(value) => updateData({ speed: value })}
              />
            </div>
          </fieldset>
        )}
      </>
    );
  },
});

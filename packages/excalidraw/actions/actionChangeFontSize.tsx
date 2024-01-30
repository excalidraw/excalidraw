import { ButtonIconSelect } from "../components/ButtonIconSelect";
import {
  FontSizeExtraLargeIcon,
  FontSizeLargeIcon,
  FontSizeMediumIcon,
  FontSizeSmallIcon,
} from "../components/icons";
import { DEFAULT_FONT_SIZE } from "../constants";
import { isTextElement } from "../element";
import { getBoundTextElement } from "../element/textElement";
import { t } from "../i18n";
import { changeFontSize } from "./utils";
import { getFormValue } from "./actionProperties";
import { register } from "./register";

export const actionChangeFontSize = register({
  name: "changeFontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, () => value, value);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonIconSelect
        group="font-size"
        options={[
          {
            value: 16,
            text: t("labels.small"),
            icon: FontSizeSmallIcon,
            testId: "fontSize-small",
          },
          {
            value: 20,
            text: t("labels.medium"),
            icon: FontSizeMediumIcon,
            testId: "fontSize-medium",
          },
          {
            value: 28,
            text: t("labels.large"),
            icon: FontSizeLargeIcon,
            testId: "fontSize-large",
          },
          {
            value: 36,
            text: t("labels.veryLarge"),
            icon: FontSizeExtraLargeIcon,
            testId: "fontSize-veryLarge",
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => {
            if (isTextElement(element)) {
              return element.fontSize;
            }
            const boundTextElement = getBoundTextElement(
              element,
              app.scene.getNonDeletedElementsMap(),
            );
            if (boundTextElement) {
              return boundTextElement.fontSize;
            }
            return null;
          },
          (element) =>
            isTextElement(element) ||
            getBoundTextElement(
              element,
              app.scene.getNonDeletedElementsMap(),
            ) !== null,
          (hasSelection) =>
            hasSelection
              ? null
              : appState.currentItemFontSize || DEFAULT_FONT_SIZE,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

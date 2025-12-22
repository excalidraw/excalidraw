import { KEYS, MOBILE_ACTION_BUTTON_BG } from "@excalidraw/common";

import { unbindAllFromElement } from "@excalidraw/element/binding";

import {
  isBindableElement,
  isBindingElementType,
} from "@excalidraw/element/typeChecks";

import { IsolateBlockIcon } from "../components/icons";
import { useStylesPanelMode } from "..";
import { t } from "../i18n";
import { ToolButton } from "../components/ToolButton";

import { getShortcutKey } from "../shortcut";

import { register } from "./register";

export const actionUnbindAll = register({
  name: "unbindAllFromSelectedElements",
  label: "labels.unsnapAll",
  icon: IsolateBlockIcon,
  trackEvent: { category: "element" },
  keywords: ["unbind", "unsnap", "unlink", "unchain", "arrow", "clean"],
  viewMode: false,
  keyTest: (event) => event.key === KEYS.U,
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    for (const element of selectedElements) {
      if (!isBindableElement(element)) {
        continue;
      }

      unbindAllFromElement(elements, element);
    }

    return {
      elements,
      appState,
      captureUpdate: "IMMEDIATELY",
    };
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const isMobile = useStylesPanelMode() === "mobile";

    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    const hasBinded = selectedElements.some((e) => {
      if (!isBindableElement(e)) {
        return false;
      }

      return e.boundElements?.some((be) => isBindingElementType(be.type));
    });

    return (
      <ToolButton
        type="button"
        hidden={!hasBinded}
        icon={IsolateBlockIcon}
        title={`${t("labels.unsnapAll")} - ${getShortcutKey("U")}`}
        aria-label={t("labels.unsnapAll")}
        onClick={() => updateData(null)}
        style={{
          ...(isMobile && appState.openPopup !== "compactOtherProperties"
            ? MOBILE_ACTION_BUTTON_BG
            : {}),
        }}
      />
    );
  },
});

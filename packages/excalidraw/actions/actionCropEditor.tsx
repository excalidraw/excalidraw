import { register } from "./register";
import { cropIcon } from "../components/icons";
import { StoreAction } from "../store";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { isImageElement } from "../element/typeChecks";
import type { ExcalidrawImageElement } from "../element/types";

export const actionToggleCropEditor = register({
  name: "cropEditor",
  label: "helpDialog.cropStart",
  icon: cropIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["image", "crop"],
  perform(elements, appState, _, app) {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    })[0] as ExcalidrawImageElement;

    return {
      appState: {
        ...appState,
        isCropping: false,
        croppingElementId: selectedElement.id,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (
      !appState.croppingElementId &&
      selectedElements.length === 1 &&
      isImageElement(selectedElements[0])
    ) {
      return true;
    }
    return false;
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const label = t("helpDialog.cropStart");

    return (
      <ToolButton
        type="button"
        icon={cropIcon}
        title={label}
        aria-label={label}
        onClick={() => updateData(null)}
      />
    );
  },
});

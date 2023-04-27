import { getSelectedElements, isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import { updateActiveTool } from "../utils";
import { CropIcon } from "../components/icons";

export const actionCropImage = register({
  name: "cropImage",
  trackEvent: { category: "element", action: "crop" },
  perform: (elements, appState) => {
    let croppingModeEnabled = appState.croppingModeEnabled;

    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    if (selectedElements.length === 1 && selectedElements[0].type === "image") {
      croppingModeEnabled = !croppingModeEnabled;
    } else {
      croppingModeEnabled = false;
    }

    const nextAppState = {
      ...appState,
      croppingModeEnabled,
    };

    return {
      elements,
      appState: {
        ...nextAppState,
        activeTool: updateActiveTool(appState, { type: "selection" }),
        multiElement: null,
      },
      commitToHistory: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      ),
    };
  },
  contextItemLabel: "labels.crop",

  keyTest: (event, appState, elements) => false,

  PanelComponent: ({ elements, appState, updateData }) => {
    let visible = false;

    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    if (selectedElements.length === 1 && selectedElements[0].type === "image") {
      visible = true;
    }

    return (
      <ToolButton
        type="button"
        icon={CropIcon}
        title={t("labels.crop")}
        aria-label={t("labels.crop")}
        onClick={() => updateData(null)}
        activated={appState.croppingModeEnabled}
        visible={visible}
      />
    );
  },
});

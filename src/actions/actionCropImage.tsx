import { isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";
import { getElementsInGroup } from "../groups";
import { LinearElementEditor } from "../element/linearElementEditor";
import { fixBindingsAfterDeletion } from "../element/binding";
import { isBoundToContainer } from "../element/typeChecks";
import { updateActiveTool } from "../utils";
import { CropIcon } from "../components/icons";

export const actionCropImage = register({
  name: "cropImage",
  trackEvent: { category: "element", action: "crop" },
  perform: (elements, appState) => {
    const nextAppState = {
      ...appState,
      croppingModeEnabled: ! appState.croppingModeEnabled
    }

    // i don't know how any of this works yet, just copied from
    // the delete button
    return {
      elements: elements,
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
    
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={CropIcon}
      title={t("labels.crop")}
      aria-label={t("labels.crop")}
      onClick={() => updateData(null)}
      activated={appState.croppingModeEnabled}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
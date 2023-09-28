import {register} from "./register";
import {getCommonAttributeOfSelectedElements, getSelectedElements, isSomeElementSelected} from "../scene";
import {AppClassProperties, AppState} from "../types";
import {t} from "../i18n";
import {ExcalidrawElement} from "../element/types";
import {getNonDeletedElements} from "../element";
import {ColorPicker} from "../components/ColorPicker/ColorPicker";
import {DEFAULT_ELEMENT_STROKE_COLOR_PALETTE, DEFAULT_ELEMENT_STROKE_PICKS} from "../colors";
const getFormValue = function <T>(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
  defaultValue: T,
): T {
  const editingElement = appState.editingElement;
  const nonDeletedElements = getNonDeletedElements(elements);
  return (
    (editingElement && getAttribute(editingElement)) ??
    (isSomeElementSelected(nonDeletedElements, appState)
      ? getCommonAttributeOfSelectedElements(
        nonDeletedElements,
        appState,
        getAttribute,
      )
      : defaultValue) ??
    defaultValue
  );
};
export const selectall = register({
    trackEvent: false,
    name: "aaction",
    perform(elements, appState, value){
      const selectedEl = getSelectedElements(elements,appState)
      for (const [id, element] of selectedEl.entries()) {
        if (element.type !== value) {
          appState.selectedElementIds[id] = false;
        }
      }
      return {
        elements,
        appState: { ...appState, currentShapeFilter: value },
        commitToHistory: true,
      };
    },
  PanelComponent: ({ elements, appState, updateData, appProps }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        topPicks={DEFAULT_ELEMENT_STROKE_PICKS}
        palette={DEFAULT_ELEMENT_STROKE_COLOR_PALETTE}
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          appState,
          (element) => element.strokeColor,
          appState.currentItemStrokeColor,
        )}
        onChange={(color) => updateData({ currentItemStrokeColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
      />
    </>
  ),
});
)});

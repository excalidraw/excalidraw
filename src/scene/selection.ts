import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getElementAbsoluteCoords, getElementBounds } from "../element";
import { AppState, ExcalidrawProps } from "../types";
import { isBoundToContainer } from "../element/typeChecks";
import { getCustomElementConfig } from "../utils";

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
  customElementConfig: ExcalidrawProps["customElementsConfig"],
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(selection);
  return elements.filter((element) => {
    const [elementX1, elementY1, elementX2, elementY2] =
      getElementBounds(element);
    const isCustom = element.type === "custom";
    const allowSelection = isCustom
      ? getCustomElementConfig(customElementConfig, element.customType)
          ?.transformHandles
      : true;
    return (
      allowSelection &&
      element.locked === false &&
      element.type !== "selection" &&
      !isBoundToContainer(element) &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
    );
  });
};

export const isSomeElementSelected = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
): boolean =>
  elements.some((element) => appState.selectedElementIds[element.id]);

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export const getCommonAttributeOfSelectedElements = <T>(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
): T | null => {
  const attributes = Array.from(
    new Set(
      getSelectedElements(elements, appState).map((element) =>
        getAttribute(element),
      ),
    ),
  );
  return attributes.length === 1 ? attributes[0] : null;
};

export const getSelectedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  includeBoundTextElement: boolean = false,
) =>
  elements.filter((element) => {
    if (appState.selectedElementIds[element.id]) {
      return element;
    }
    if (
      includeBoundTextElement &&
      isBoundToContainer(element) &&
      appState.selectedElementIds[element?.containerId]
    ) {
      return element;
    }
    return null;
  });

export const getTargetElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) =>
  appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState, true);

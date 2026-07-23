import { isTransparent } from "@excalidraw/common";

import {
  shouldAllowVerticalAlign,
  suppportsHorizontalAlign,
  hasBoundTextElement,
  isElbowArrow,
  isImageElement,
  isLinearElement,
  isTextElement,
  hasStrokeColor,
  toolIsArrow,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { alignActionsPredicate } from "../actions/actionAlign";
import {
  canChangeRoundness,
  canHaveArrowheads,
  getSelectedElements,
  hasBackground,
  hasFreedrawMode,
  hasStrokeStyle,
  hasStrokeWidth,
} from "../scene";

import type { ElementOrToolType } from "../types";

import type { AppClassProperties, UIAppState } from "../types";

export const canChangeStrokeColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) => {
  let commonSelectedType: ExcalidrawElementType | null =
    targetElements[0]?.type || null;

  for (const element of targetElements) {
    if (element.type !== commonSelectedType) {
      commonSelectedType = null;
      break;
    }
  }

  return (
    (hasStrokeColor(appState.activeTool.type) &&
      commonSelectedType !== "image" &&
      commonSelectedType !== "frame" &&
      commonSelectedType !== "magicframe") ||
    targetElements.some((element) => hasStrokeColor(element.type))
  );
};

export const canChangeBackgroundColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) => {
  return (
    hasBackground(appState.activeTool.type) ||
    targetElements.some((element) => hasBackground(element.type))
  );
};

/**
 * Single source of truth for "which shape-action controls are relevant right
 * now". Each flag answers whether a given control should be shown, given the
 * active tool and the current selection. All three styles-panel layouts
 * (full / compact / mobile) and the compact popovers consume these flags so
 * that visibility logic lives in one place and layout stays pure.
 */
export const getShapeActionPredicates = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap,
  app: AppClassProperties,
) => {
  const activeToolType = appState.activeTool.type;

  // A property is relevant when it applies to the active tool (so it can be
  // preconfigured before drawing) or to any currently selected element.
  const forToolOrSelection = (
    predicate: (type: ElementOrToolType) => boolean,
  ) =>
    predicate(activeToolType) ||
    targetElements.some((element) => predicate(element.type));

  const singleSelected = targetElements.length === 1;

  // a container + its bound text read as a single logical element (2 selected)
  const isSingleElementBoundContainer =
    targetElements.length === 2 &&
    (hasBoundTextElement(targetElements[0]) ||
      hasBoundTextElement(targetElements[1]));

  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );
  const hasSelection = targetElements.length > 0;

  return {
    /** some element(s) selected */
    hasSelection,
    /** actions on selected elements (delete/duplicate/...) */
    showExtraActions: hasSelection && !isEditingTextOrNewElement,

    // color
    strokeColor: canChangeStrokeColor(appState, targetElements),
    backgroundColor: canChangeBackgroundColor(appState, targetElements),
    fill:
      (hasBackground(activeToolType) &&
        !isTransparent(appState.currentItemBackgroundColor)) ||
      targetElements.some(
        (element) =>
          hasBackground(element.type) &&
          !isTransparent(element.backgroundColor),
      ),

    // stroke / shape properties
    strokeWidth: forToolOrSelection(hasStrokeWidth),
    freedrawMode: forToolOrSelection(hasFreedrawMode),
    strokeStyle: forToolOrSelection(hasStrokeStyle),
    sloppiness: forToolOrSelection(hasStrokeStyle),
    roundness: forToolOrSelection(canChangeRoundness),
    arrowType: forToolOrSelection(toolIsArrow),
    arrowheads: forToolOrSelection(canHaveArrowheads),

    // text
    text: activeToolType === "text" || targetElements.some(isTextElement),
    textAlign:
      activeToolType === "text" ||
      suppportsHorizontalAlign(targetElements, elementsMap),
    verticalAlign: shouldAllowVerticalAlign(targetElements, elementsMap),

    opacity: activeToolType !== "drawShape" || hasSelection,

    // arrangement
    // z-order controls are hidden while the freedraw or drawShape tool is
    // active without an actual selection
    layers:
      (activeToolType !== "freedraw" &&
        activeToolType !== "drawShape" &&
        !targetElements.some((element) => element.type === "freedraw")) ||
      getSelectedElements(elementsMap, appState).some(
        (element) => element.type === "freedraw",
      ),
    align:
      !isSingleElementBoundContainer && alignActionsPredicate(appState, app),
    distribute: targetElements.length > 2,

    // per-element actions
    // NOTE: the full panel treats a bound container as linkable; the compact /
    // mobile layouts only link a truly single selection. Both are preserved via
    // the two flags below.
    link: singleSelected || isSingleElementBoundContainer,
    linkSingleOnly: singleSelected,
    cropEditor:
      !appState.croppingElementId &&
      singleSelected &&
      isImageElement(targetElements[0]),
    lineEditor:
      !appState.selectedLinearElement?.isEditing &&
      singleSelected &&
      isLinearElement(targetElements[0]) &&
      !isElbowArrow(targetElements[0]),
  };
};

export type ShapeActionPredicates = ReturnType<typeof getShapeActionPredicates>;

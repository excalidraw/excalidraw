// Existing in-process selection dependencies are imported directly. This
// replaces one-callback-per-function dependency wrappers.
import { KEYS, isSelectionLikeTool, tupleToCoors } from "@excalidraw/common";
import {
  LinearElementEditor,
  editGroupForSelectedElement,
  getCommonBounds,
  getElementWithTransformHandleType,
  getElementsInGroup,
  getFrameChildren,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getTransformHandleTypeFromCoords,
  handleFocusPointPointerDown,
  isBindingElement,
  isElbowArrow,
  isElementInGroup,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  makeNextSelectedElementIds,
  selectGroupsForSelectedElements,
  type Store,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type React from "react";

import type { PointerDownState } from "../types";
import type App from "./App";

export class AppSelection {
  constructor(private readonly app: App) {}

  /**
   * @returns whether the pointer event has been completely handled and the
   * shared pointer move/up lifecycle should not be installed
   */
  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    return this.app.handleSelectionOnPointerDown(event, pointerDownState);
  };
}

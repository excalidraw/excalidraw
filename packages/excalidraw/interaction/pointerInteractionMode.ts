import { isLinearElement } from "@excalidraw/element";

import type { TransformHandleType } from "@excalidraw/element";

import type { AppState, PointerDownState } from "../types";

/**
 * The implicit "mode" a pointer interaction is in during a drag. In App.tsx
 * this is not stored anywhere — it is spread across which nullable AppState
 * fields happen to be populated (`resizingElement`, `newElement` + `multiElement`,
 * `selectedLinearElement`, `selectionElement`, `croppingElementId`) plus the
 * live `PointerDownState.resize` scratch. This discriminant names each of those
 * combinations so the eventual handler refactor has an explicit target.
 */
export type PointerInteractionMode =
  | { kind: "resize"; handleType: TransformHandleType }
  | { kind: "crop"; elementId: string }
  | { kind: "linearCreate" }
  // The transient where finishing multi-point linear creation feeds into
  // linear-edit mode — a genuine transition, not an accidental fall-through.
  | { kind: "linearCreateFinalizing" }
  | { kind: "linearPointDrag" }
  | { kind: "linearEdit" }
  | { kind: "boxSelect" }
  | { kind: "elementDrag" }
  | { kind: "genericCreate" }
  | { kind: "idle" };

type InteractionModeState = Pick<
  AppState,
  | "croppingElementId"
  | "newElement"
  | "multiElement"
  | "selectionElement"
  | "selectedLinearElement"
  | "selectedElementsAreBeingDragged"
>;

type InteractionModeResize = Pick<
  PointerDownState["resize"],
  "isResizing" | "handleType"
>;

/**
 * Derives the current {@link PointerInteractionMode} from existing fields. Pure
 * and read-only — it mirrors the branch precedence in App.tsx's pointer handlers
 * without changing any control flow.
 *
 * The branch order is significant and matches the handlers: crop and resize
 * share the `resize.isResizing` gate (crop wins, mirroring `maybeHandleCrop`
 * running before `maybeHandleResize`); the four-field linear-finalizing case is
 * the most specific and precedes plain linear creation.
 */
export const getPointerInteractionMode = (
  state: InteractionModeState,
  resize: InteractionModeResize,
): PointerInteractionMode => {
  if (resize.isResizing) {
    if (state.croppingElementId) {
      return { kind: "crop", elementId: state.croppingElementId };
    }
    if (resize.handleType) {
      return { kind: "resize", handleType: resize.handleType };
    }
  }

  if (
    state.newElement &&
    state.multiElement &&
    isLinearElement(state.newElement) &&
    state.selectedLinearElement
  ) {
    return { kind: "linearCreateFinalizing" };
  }

  if (state.multiElement) {
    return { kind: "linearCreate" };
  }

  if (state.selectedLinearElement) {
    return state.selectedLinearElement.isDragging
      ? { kind: "linearPointDrag" }
      : { kind: "linearEdit" };
  }

  if (state.selectionElement) {
    return { kind: "boxSelect" };
  }

  if (state.selectedElementsAreBeingDragged) {
    return { kind: "elementDrag" };
  }

  if (state.newElement) {
    return { kind: "genericCreate" };
  }

  return { kind: "idle" };
};

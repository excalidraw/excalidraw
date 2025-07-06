import React, { useEffect, useRef } from "react";

import { CURSOR_TYPE, isShallowEqual } from "@excalidraw/common";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { t } from "../../i18n";

import type {
  RenderableElementsMap,
  RenderInteractiveSceneCallback,
} from "../../scene/types";
import type { AppState, Device, InteractiveCanvasAppState } from "../../types";
import type { DOMAttributes } from "react";

type InteractiveCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvas: HTMLCanvasElement | null;
  elementsMap: RenderableElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  selectedElements: readonly NonDeletedExcalidrawElement[];
  allElementsMap: NonDeletedSceneElementsMap;
  sceneNonce: number | undefined;
  selectionNonce: number | undefined;
  scale: number;
  appState: InteractiveCanvasAppState;
  renderScrollbars: boolean;
  device: Device;
  renderInteractiveSceneCallback: (
    data: RenderInteractiveSceneCallback,
  ) => void;
  handleCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  onContextMenu: Exclude<
    DOMAttributes<HTMLCanvasElement | HTMLDivElement>["onContextMenu"],
    undefined
  >;
  onPointerMove: Exclude<
    DOMAttributes<HTMLCanvasElement>["onPointerMove"],
    undefined
  >;
  onPointerUp: Exclude<
    DOMAttributes<HTMLCanvasElement>["onPointerUp"],
    undefined
  >;
  onPointerCancel: Exclude<
    DOMAttributes<HTMLCanvasElement>["onPointerCancel"],
    undefined
  >;
  onTouchMove: Exclude<
    DOMAttributes<HTMLCanvasElement>["onTouchMove"],
    undefined
  >;
  onPointerDown: Exclude<
    DOMAttributes<HTMLCanvasElement>["onPointerDown"],
    undefined
  >;
  onDoubleClick: Exclude<
    DOMAttributes<HTMLCanvasElement>["onDoubleClick"],
    undefined
  >;
};

const InteractiveCanvas = (props: InteractiveCanvasProps) => {
  const isComponentMounted = useRef(false);

  useEffect(() => {
    if (!isComponentMounted.current) {
      isComponentMounted.current = true;
    }
  });

  return (
    <canvas
      className="excalidraw__canvas interactive"
      style={{
        width: props.appState.width,
        height: props.appState.height,
        cursor: props.appState.viewModeEnabled
          ? CURSOR_TYPE.GRAB
          : CURSOR_TYPE.AUTO,
      }}
      width={props.appState.width * props.scale}
      height={props.appState.height * props.scale}
      ref={props.handleCanvasRef}
      onContextMenu={props.onContextMenu}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onTouchMove={props.onTouchMove}
      onPointerDown={props.onPointerDown}
      onDoubleClick={
        props.appState.viewModeEnabled ? undefined : props.onDoubleClick
      }
    >
      {t("labels.drawingCanvas")}
    </canvas>
  );
};

const getRelevantAppStateProps = (
  appState: AppState,
): InteractiveCanvasAppState => ({
  zoom: appState.zoom,
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  width: appState.width,
  height: appState.height,
  viewModeEnabled: appState.viewModeEnabled,
  openDialog: appState.openDialog,
  editingGroupId: appState.editingGroupId,
  editingLinearElement: appState.editingLinearElement,
  selectedElementIds: appState.selectedElementIds,
  frameToHighlight: appState.frameToHighlight,
  theme: appState.theme,
  pendingImageElementId: appState.pendingImageElementId,
  selectionElement: appState.selectionElement,
  selectedGroupIds: appState.selectedGroupIds,
  selectedLinearElement: appState.selectedLinearElement,
  multiElement: appState.multiElement,
  isBindingEnabled: appState.isBindingEnabled,
  suggestedBindings: appState.suggestedBindings,
  isRotating: appState.isRotating,
  elementsToHighlight: appState.elementsToHighlight,
  snapLines: appState.snapLines,
  zenModeEnabled: appState.zenModeEnabled,
  editingTextElement: appState.editingTextElement,
  isCropping: appState.isCropping,
  croppingElementId: appState.croppingElementId,
  searchMatches: appState.searchMatches,
  activeLockedId: appState.activeLockedId,
});

const areEqual = (
  prevProps: InteractiveCanvasProps,
  nextProps: InteractiveCanvasProps,
) => {
  // This could be further optimised if needed, as we don't have to render interactive canvas on each scene mutation
  if (
    prevProps.selectionNonce !== nextProps.selectionNonce ||
    prevProps.sceneNonce !== nextProps.sceneNonce ||
    prevProps.scale !== nextProps.scale ||
    // we need to memoize on elementsMap because they may have renewed
    // even if sceneNonce didn't change (e.g. we filter elements out based
    // on appState)
    prevProps.elementsMap !== nextProps.elementsMap ||
    prevProps.visibleElements !== nextProps.visibleElements ||
    prevProps.selectedElements !== nextProps.selectedElements ||
    prevProps.renderScrollbars !== nextProps.renderScrollbars
  ) {
    return false;
  }

  // Comparing the interactive appState for changes in case of some edge cases
  return isShallowEqual(
    // asserting AppState because we're being passed the whole AppState
    // but resolve to only the InteractiveCanvas-relevant props
    getRelevantAppStateProps(prevProps.appState as AppState),
    getRelevantAppStateProps(nextProps.appState as AppState),
  );
};

export default React.memo(InteractiveCanvas, areEqual);

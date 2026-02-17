import React, { useEffect, useRef } from "react";

import {
  CURSOR_TYPE,
  isShallowEqual,
  sceneCoordsToViewportCoords,
  type EditorInterface,
} from "@excalidraw/common";
import { AnimationController } from "@excalidraw/excalidraw/renderer/animation";

import type {
  InteractiveCanvasRenderConfig,
  InteractiveSceneRenderAnimationState,
  InteractiveSceneRenderConfig,
  RenderableElementsMap,
  RenderInteractiveSceneCallback,
} from "@excalidraw/excalidraw/scene/types";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { t } from "../../i18n";
import { renderInteractiveScene } from "../../renderer/interactiveScene";

import type {
  AppClassProperties,
  AppState,
  InteractiveCanvasAppState,
} from "../../types";
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
  editorInterface: EditorInterface;
  app: AppClassProperties;
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

export const INTERACTIVE_SCENE_ANIMATION_KEY = "animateInteractiveScene";

const InteractiveCanvas = (props: InteractiveCanvasProps) => {
  const isComponentMounted = useRef(false);
  const rendererParams = useRef(null as InteractiveSceneRenderConfig | null);

  useEffect(() => {
    if (!isComponentMounted.current) {
      isComponentMounted.current = true;
      return;
    }

    const remotePointerButton: InteractiveCanvasRenderConfig["remotePointerButton"] =
      new Map();
    const remotePointerViewportCoords: InteractiveCanvasRenderConfig["remotePointerViewportCoords"] =
      new Map();
    const remoteSelectedElementIds: InteractiveCanvasRenderConfig["remoteSelectedElementIds"] =
      new Map();
    const remotePointerUsernames: InteractiveCanvasRenderConfig["remotePointerUsernames"] =
      new Map();
    const remotePointerUserStates: InteractiveCanvasRenderConfig["remotePointerUserStates"] =
      new Map();

    props.appState.collaborators.forEach((user, socketId) => {
      if (user.selectedElementIds) {
        for (const id of Object.keys(user.selectedElementIds)) {
          if (!remoteSelectedElementIds.has(id)) {
            remoteSelectedElementIds.set(id, []);
          }
          remoteSelectedElementIds.get(id)!.push(socketId);
        }
      }
      if (!user.pointer || user.pointer.renderCursor === false) {
        return;
      }
      if (user.username) {
        remotePointerUsernames.set(socketId, user.username);
      }
      if (user.userState) {
        remotePointerUserStates.set(socketId, user.userState);
      }
      remotePointerViewportCoords.set(
        socketId,
        sceneCoordsToViewportCoords(
          {
            sceneX: user.pointer.x,
            sceneY: user.pointer.y,
          },
          props.appState,
        ),
      );
      remotePointerButton.set(socketId, user.button);
    });

    const selectionColor =
      (props.containerRef?.current &&
        getComputedStyle(props.containerRef.current).getPropertyValue(
          "--color-selection",
        )) ||
      "#6965db";

    rendererParams.current = {
      app: props.app,
      canvas: props.canvas,
      elementsMap: props.elementsMap,
      visibleElements: props.visibleElements,
      selectedElements: props.selectedElements,
      allElementsMap: props.allElementsMap,
      scale: window.devicePixelRatio,
      appState: props.appState,
      renderConfig: {
        remotePointerViewportCoords,
        remotePointerButton,
        remoteSelectedElementIds,
        remotePointerUsernames,
        remotePointerUserStates,
        selectionColor,
        renderScrollbars: props.renderScrollbars,
        // NOTE not memoized on so we don't rerender on cursor move
        lastViewportPosition: props.app.lastViewportPosition,
      },
      editorInterface: props.editorInterface,
      callback: props.renderInteractiveSceneCallback,
      animationState: {
        bindingHighlight: undefined,
      },
      deltaTime: 0,
    };

    if (!AnimationController.running(INTERACTIVE_SCENE_ANIMATION_KEY)) {
      AnimationController.start<InteractiveSceneRenderAnimationState>(
        INTERACTIVE_SCENE_ANIMATION_KEY,
        ({ deltaTime, state }) => {
          const nextAnimationState = renderInteractiveScene({
            ...rendererParams.current!,
            deltaTime,
            animationState: state,
          }).animationState;

          if (nextAnimationState) {
            for (const key in nextAnimationState) {
              if (
                nextAnimationState[
                  key as keyof InteractiveSceneRenderAnimationState
                ] !== undefined
              ) {
                return nextAnimationState;
              }
            }
          }

          return undefined;
        },
      );
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
  selectedElementIds: appState.selectedElementIds,
  frameToHighlight: appState.frameToHighlight,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
  theme: appState.theme,
  selectionElement: appState.selectionElement,
  selectedGroupIds: appState.selectedGroupIds,
  selectedLinearElement: appState.selectedLinearElement,
  multiElement: appState.multiElement,
  newElement: appState.newElement,
  isBindingEnabled: appState.isBindingEnabled,
  suggestedBinding: appState.suggestedBinding,
  isRotating: appState.isRotating,
  elementsToHighlight: appState.elementsToHighlight,
  collaborators: appState.collaborators, // Necessary for collab. sessions
  activeEmbeddable: appState.activeEmbeddable,
  snapLines: appState.snapLines,
  zenModeEnabled: appState.zenModeEnabled,
  editingTextElement: appState.editingTextElement,
  isCropping: appState.isCropping,
  croppingElementId: appState.croppingElementId,
  searchMatches: appState.searchMatches,
  activeLockedId: appState.activeLockedId,
  hoveredElementIds: appState.hoveredElementIds,
  frameRendering: appState.frameRendering,
  shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
  exportScale: appState.exportScale,
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

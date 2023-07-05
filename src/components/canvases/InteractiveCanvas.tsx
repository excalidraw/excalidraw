import React, { useEffect, useRef } from "react";
import { renderInteractiveScene } from "../../renderer/renderScene";
import { isShallowEqual, sceneCoordsToViewportCoords } from "../../utils";
import { CURSOR_TYPE } from "../../constants";
import { t } from "../../i18n";
import type { DOMAttributes } from "react";
import type { AppState, InteractiveCanvasAppState } from "../../types";
import type {
  InteractiveCanvasRenderConfig,
  RenderInteractiveSceneCallback,
} from "../../scene/types";
import type { NonDeletedExcalidrawElement } from "../../element/types";

type InteractiveCanvasProps = {
  canvas: HTMLCanvasElement | null;
  elements: readonly NonDeletedExcalidrawElement[];
  versionNonce: number | undefined;
  selectionNonce: number | undefined;
  appState: InteractiveCanvasAppState;
  renderInteractiveSceneCallback: (
    data: RenderInteractiveSceneCallback,
  ) => void;
  handleCanvasRef: (canvas: HTMLCanvasElement) => void;
  onContextMenu: DOMAttributes<HTMLCanvasElement>["onContextMenu"];
  onPointerMove: DOMAttributes<HTMLCanvasElement>["onPointerMove"];
  onPointerUp: DOMAttributes<HTMLCanvasElement>["onPointerUp"];
  onPointerCancel: DOMAttributes<HTMLCanvasElement>["onPointerCancel"];
  onTouchMove: DOMAttributes<HTMLCanvasElement>["onTouchMove"];
  onPointerDown: DOMAttributes<HTMLCanvasElement>["onPointerDown"];
  onDoubleClick: DOMAttributes<HTMLCanvasElement>["onDoubleClick"];
};

const InteractiveCanvas = (props: InteractiveCanvasProps) => {
  const isComponentMounted = useRef(false);

  useEffect(() => {
    if (!isComponentMounted.current) {
      isComponentMounted.current = true;
      return;
    }

    const cursorButton: {
      [id: string]: string | undefined;
    } = {};
    const pointerViewportCoords: InteractiveCanvasRenderConfig["remotePointerViewportCoords"] =
      {};
    const remoteSelectedElementIds: InteractiveCanvasRenderConfig["remoteSelectedElementIds"] =
      {};
    const pointerUsernames: { [id: string]: string } = {};
    const pointerUserStates: { [id: string]: string } = {};

    props.appState.collaborators.forEach((user, socketId) => {
      if (user.selectedElementIds) {
        for (const id of Object.keys(user.selectedElementIds)) {
          if (!(id in remoteSelectedElementIds)) {
            remoteSelectedElementIds[id] = [];
          }
          remoteSelectedElementIds[id].push(socketId);
        }
      }
      if (!user.pointer) {
        return;
      }
      if (user.username) {
        pointerUsernames[socketId] = user.username;
      }
      if (user.userState) {
        pointerUserStates[socketId] = user.userState;
      }
      pointerViewportCoords[socketId] = sceneCoordsToViewportCoords(
        {
          sceneX: user.pointer.x,
          sceneY: user.pointer.y,
        },
        props.appState,
      );
      cursorButton[socketId] = user.button;
    });

    const selectionColor = getComputedStyle(
      document.querySelector(".excalidraw")!,
    ).getPropertyValue("--color-selection");

    renderInteractiveScene(
      {
        scale: window.devicePixelRatio,
        elements: props.elements,
        canvas: props.canvas,
        appState: props.appState,
        renderConfig: {
          remotePointerViewportCoords: pointerViewportCoords,
          remotePointerButton: cursorButton,
          remoteSelectedElementIds,
          remotePointerUsernames: pointerUsernames,
          remotePointerUserStates: pointerUserStates,
          selectionColor,
          renderScrollbars: false,
        },
        callback: props.renderInteractiveSceneCallback,
      },
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER &&
        window.EXCALIDRAW_THROTTLE_RENDER === true,
    );

    if (!window.EXCALIDRAW_THROTTLE_NEXT_RENDER) {
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER = true;
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
      width={props.appState.width * window.devicePixelRatio}
      height={props.appState.height * window.devicePixelRatio}
      ref={props.handleCanvasRef}
      onContextMenu={props.onContextMenu}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onTouchMove={props.onTouchMove}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
    >
      {t("labels.drawingCanvas")}
    </canvas>
  );
};

const stripIrrelevantAppStateProps = (
  appState: AppState,
): Omit<InteractiveCanvasAppState, "editingElement"> => ({
  zoom: appState.zoom,
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  width: appState.width,
  height: appState.height,
  viewModeEnabled: appState.viewModeEnabled,
  editingGroupId: appState.editingGroupId,
  editingLinearElement: appState.editingLinearElement,
  selectedElementIds: appState.selectedElementIds,
  frameToHighlight: appState.frameToHighlight,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
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
  openSidebar: appState.openSidebar,
  showHyperlinkPopup: appState.showHyperlinkPopup,
  collaborators: appState.collaborators, // Necessary for collab. sessions
});

const areEqual = (
  prevProps: InteractiveCanvasProps,
  nextProps: InteractiveCanvasProps,
) => {
  // This could be further optimised if needed, as we don't have to render interactive canvas on each mutation
  if (
    prevProps.selectionNonce !== nextProps.selectionNonce ||
    prevProps.versionNonce !== nextProps.versionNonce
  ) {
    return false;
  }

  // Comparing the interactive appState for changes in case of some edge cases
  return isShallowEqual(
    // asserting AppState because we're being passed the whole AppState
    // but resolve to only the InteractiveCanvas-relevant props
    stripIrrelevantAppStateProps(prevProps.appState as AppState),
    stripIrrelevantAppStateProps(nextProps.appState as AppState),
  );
};

export default React.memo(InteractiveCanvas, areEqual);

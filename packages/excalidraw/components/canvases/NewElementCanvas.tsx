import { useEffect, useRef } from "react";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { isRenderThrottlingEnabled } from "../../reactUtils";
import {
  cancelNewElementSceneThrottle,
  renderNewElementScene,
} from "../../renderer/renderNewElementScene";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../../scene/types";
import type { AppState } from "../../types";
import type { RoughCanvas } from "roughjs/bin/canvas";

interface NewElementCanvasProps {
  appState: AppState;
  newElement: NonNullable<AppState["newElement"]>;
  /** elements above a framed new element, drawn on top of it */
  coveringElements?: readonly NonDeletedExcalidrawElement[];
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  rc: RoughCanvas;
  renderConfig: StaticCanvasRenderConfig;
  /** CSS opacity of the whole canvas — a translucent preview of a finished element */
  opacity?: number;
}

const NewElementCanvas = (props: NewElementCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    renderNewElementScene(
      {
        canvas: canvasRef.current,
        scale: props.scale,
        newElement: props.newElement,
        coveringElements: props.coveringElements,
        elementsMap: props.elementsMap,
        allElementsMap: props.allElementsMap,
        rc: props.rc,
        renderConfig: props.renderConfig,
        appState: props.appState,
      },
      isRenderThrottlingEnabled(),
    );
  });

  // the canvas is unmounted on pointerup; drop its pending frame so it isn't
  // drawn after removal
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (canvas) {
        cancelNewElementSceneThrottle(canvas);
      }
    };
  }, []);

  return (
    <canvas
      className="excalidraw__canvas"
      style={{
        width: props.appState.width,
        height: props.appState.height,
        opacity: props.opacity,
      }}
      width={props.appState.width * props.scale}
      height={props.appState.height * props.scale}
      ref={canvasRef}
    />
  );
};

export default NewElementCanvas;

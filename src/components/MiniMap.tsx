import "./MiniMap.scss";

import React, { useEffect, useRef } from "react";
import { unmountComponentAtNode, render } from "react-dom";
import { canvasToBlob } from "../data/blob";
import { getCommonBounds } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { CanvasError } from "../errors";
import { exportToCanvas } from "../scene/export";
import { AppState } from "../types";
import { distance, viewportCoordsToSceneCoords } from "../utils";
import { ErrorCanvasPreview } from "./ExportDialog";
import { Island } from "./Island";

const RATIO = 1.2;
const MINIMAP_HEIGHT = 150;
const MINIMAP_WIDTH = MINIMAP_HEIGHT * RATIO;

const renderPreview = (
  content: HTMLCanvasElement | Error,
  previewNode: HTMLDivElement,
) => {
  unmountComponentAtNode(previewNode);
  previewNode.innerHTML = "";
  if (content instanceof HTMLCanvasElement) {
    previewNode.appendChild(content);
  } else {
    render(<ErrorCanvasPreview />, previewNode);
  }
};

const MinimapViewport = ({
  elements,
  appState,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
}) => {
  if (elements.length === 0) {
    return null;
  }

  const [minX, minY, canvasWidth, canvasHeight] = getCanvasSize(elements);
  const minimapScale = Math.min(
    MINIMAP_WIDTH / canvasWidth,
    MINIMAP_HEIGHT / canvasHeight,
  );

  const leftTop = viewportCoordsToSceneCoords(
    { clientX: 0, clientY: 0 },
    appState,
  );
  const rightBot = viewportCoordsToSceneCoords(
    { clientX: appState.width, clientY: appState.height },
    appState,
  );

  const top = (leftTop.y - minY) * minimapScale;
  const left = (leftTop.x - minX) * minimapScale;
  const width = (rightBot.x - leftTop.x) * minimapScale;
  const height = (rightBot.y - leftTop.y) * minimapScale;

  return (
    <div
      style={{
        border: "2px solid orange",
        boxSizing: "border-box",
        position: "absolute",
        pointerEvents: "none",
        top: Math.max(0, top),
        left: Math.max(0, left),
        width: Math.min(MINIMAP_WIDTH - Math.max(0, left), width),
        height: Math.min(MINIMAP_HEIGHT - Math.max(0, top), height),
      }}
    />
  );
};

const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
): [number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX);
  const height = distance(minY, maxY);

  return [minX, minY, width, height];
};

export function MiniMap({
  appState,
  elements,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const appStateRef = useRef<AppState>(appState);
  appStateRef.current = appState;

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    if (elements.length === 0) {
      unmountComponentAtNode(previewNode);
      previewNode.innerHTML = "";
    }
    const canvas = exportToCanvas(
      elements,
      appStateRef.current,
      {
        exportBackground: true,
        viewBackgroundColor: appStateRef.current.viewBackgroundColor,
        shouldAddWatermark: false,
      },
      (width, height) => {
        const tempCanvas = document.createElement("canvas");
        const scale = Math.min(MINIMAP_WIDTH / width, MINIMAP_HEIGHT / height);
        tempCanvas.width = width * scale;
        tempCanvas.height = height * scale;

        return {
          canvas: tempCanvas,
          scale,
        };
      },
    );

    canvasToBlob(canvas)
      .then(() => {
        renderPreview(canvas, previewNode);
      })
      .catch((error) => {
        console.error(error);
        renderPreview(new CanvasError(), previewNode);
      });
  }, [elements]);

  return (
    <Island padding={1} className="MiniMap">
      <div
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          position: "relative",
          backgroundColor: appState.viewBackgroundColor,
        }}
      >
        <div ref={previewRef} />
        <MinimapViewport elements={elements} appState={appState} />
      </div>
    </Island>
  );
}

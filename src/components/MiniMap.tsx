import "./MiniMap.scss";

import React, { useEffect, useRef, useMemo, useState } from "react";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { distance, viewportCoordsToSceneCoords } from "../utils";
import { Island } from "./Island";
// eslint-disable-next-line import/no-webpack-loader-syntax
import MinimapWorker from "worker-loader!../renderer/minimapWorker";

const RATIO = 1.2;
const MINIMAP_HEIGHT = 150;
const MINIMAP_WIDTH = MINIMAP_HEIGHT * RATIO;

const MinimapViewport = ({
  elements,
  appState,
}: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
}) => {
  const [minX, minY, maxX, maxY] = useMemo(
    () => getCommonBounds(getNonDeletedElements(elements)),
    [elements],
  );

  const minimapScale = Math.min(
    MINIMAP_WIDTH / distance(minX, maxX),
    MINIMAP_HEIGHT / distance(minY, maxY),
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

  // Set viewport boundaries
  const viewportTop = Math.min(Math.max(0, top), MINIMAP_HEIGHT);
  const viewportLeft = Math.min(Math.max(0, left), MINIMAP_WIDTH);
  const viewportWidth = Math.min(
    MINIMAP_WIDTH - viewportLeft,
    width,
    width + left,
  );
  const viewportHeight = Math.min(
    MINIMAP_HEIGHT - viewportTop,
    height,
    height + top,
  );

  if (
    Number.isNaN(viewportTop) ||
    Number.isNaN(viewportLeft) ||
    Number.isNaN(viewportWidth) ||
    Number.isNaN(viewportHeight)
  ) {
    return null;
  }

  return (
    <div
      style={{
        border: "2px solid orange",
        boxSizing: "border-box",
        position: "absolute",
        pointerEvents: "none",
        top: viewportTop,
        left: viewportLeft,
        width: viewportWidth,
        height: viewportHeight,
      }}
    />
  );
};

export function MiniMap({
  appState,
  elements,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
}) {
  const [minimapWorker] = useState(() => new MinimapWorker());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const offscreenCanvas = canvas.transferControlToOffscreen();

    minimapWorker.postMessage({ type: "INIT", canvas: offscreenCanvas }, [
      offscreenCanvas,
    ]);

    minimapWorker.postMessage({
      type: "DRAW",
      elements: elementsRef.current,
      appState: appStateRef.current,
      width: MINIMAP_WIDTH,
      height: MINIMAP_HEIGHT,
    });

    setInterval(() => {
      minimapWorker.postMessage({
        type: "DRAW",
        elements: elementsRef.current,
        appState: appStateRef.current,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
      });
    }, 1000);

    return () => {
      minimapWorker.terminate();
    };
  }, [minimapWorker]);

  return (
    <Island padding={1} className="MiniMap">
      <div
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          position: "relative",
          overflow: "hidden",
          backgroundColor: appState.viewBackgroundColor,
        }}
      >
        <canvas ref={canvasRef} />
        <MinimapViewport elements={elements} appState={appState} />
      </div>
    </Island>
  );
}

import React, { useState } from "react";
import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import type { AppState, Waypoint } from "../types";

interface WaypointCanvasOverlayProps {
  appState: AppState;
  onJump: (id: string) => void;
  onUpdate: (id: string, x: number, y: number) => void;
}

interface WaypointMarkerProps {
  waypoint: Waypoint;
  x: number;
  y: number;
  onJump: (id: string) => void;
  onUpdate: (id: string, x: number, y: number) => void;
  appState: AppState;
}

/**
 * Converts a waypoint's scene position to viewport screen coordinates.
 * 
 * The waypoint stores scene coordinates (like element x/y). We convert these
 * to viewport coordinates using the current camera state (scroll and zoom).
 */
function waypointToScreenPosition(
  waypoint: Waypoint,
  appState: AppState,
): { x: number; y: number } {
  // Convert scene coordinates to viewport coordinates
  const viewportCoords = sceneCoordsToViewportCoords(
    { sceneX: waypoint.x, sceneY: waypoint.y },
    appState,
  );

  return { x: viewportCoords.x, y: viewportCoords.y };
}

/**
 * Pin-shaped waypoint marker component
 */
const WaypointMarker: React.FC<WaypointMarkerProps> = ({
  waypoint,
  x,
  y,
  onJump,
  onUpdate,
  appState,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const PIN_PATH =
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    // Only left click
    if (e.button !== 0) {
      return;
    }

    setIsDragging(true);
    setHasDragged(false);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }
    e.stopPropagation();

    setHasDragged(true);

    const sceneCoords = viewportCoordsToSceneCoords(
      { clientX: e.clientX, clientY: e.clientY },
      appState,
    );

    onUpdate(waypoint.id, sceneCoords.x, sceneCoords.y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }
    e.stopPropagation();
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasDragged) {
      onJump(waypoint.id);
    }
  };

  return (
    <g
      className="waypoint-marker"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <g transform={`translate(${x}, ${y})`}>
        <g transform="scale(1.5) translate(-12, -9)">
          <path
            d={PIN_PATH}
            fill="#6965db"
            stroke="#4a47a3"
            strokeWidth="1"
            opacity={0.9}
          />
          <circle cx="12" cy="9" r="5.5" fill="white" />
        </g>

        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#6965db"
          fontSize={11}
          fontWeight="bold"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {waypoint.name.slice(0, 2).toUpperCase()}
        </text>
      </g>

      {/* Tooltip on hover */}
      <title>{waypoint.name} (click to jump, drag to move)</title>
    </g>
  );
};

/**
 * Canvas overlay that renders all waypoint markers.
 * Renders as an SVG overlay on top of the Excalidraw canvas.
 */
export const WaypointCanvasOverlay: React.FC<WaypointCanvasOverlayProps> = ({
  appState,
  onJump,
  onUpdate,
}) => {
  const { waypoints } = appState;

  if (!waypoints || waypoints.length === 0) {
    return null;
  }

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    overflow: "visible",
    zIndex: 10,
  };

  const markerGroupStyle: React.CSSProperties = {
    pointerEvents: "auto",
  };

  return (
    <svg className="waypoint-canvas-overlay" style={overlayStyle}>
      <g style={markerGroupStyle}>
        {waypoints.map((waypoint) => {
          const { x, y } = waypointToScreenPosition(
            waypoint,
            appState,
          );

          // Only renders if marker is within visible viewport
          const padding = 50;
          if (
            x < -padding ||
            x > appState.width + padding ||
            y < -padding ||
            y > appState.height + padding
          ) {
            return null;
          }

          return (
            <WaypointMarker
              key={waypoint.id}
              waypoint={waypoint}
              x={x}
              y={y}
              onJump={onJump}
              onUpdate={onUpdate}
              appState={appState}
            />
          );
        })}
      </g>
    </svg>
  );
};

export default WaypointCanvasOverlay;

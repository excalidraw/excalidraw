import React from "react";


import type { AppState, Waypoint } from "../types";

interface WaypointCanvasOverlayProps {
  appState: AppState;
  onJump: (id: string) => void;
}

interface WaypointMarkerProps {
  waypoint: Waypoint;
  x: number;
  y: number;
  onJump: (id: string) => void;
}

/**
 * Converts a waypoint's scroll position to canvas screen coordinates.
 * 
 * The waypoint stores the scrollX/scrollY when created. To show where that
 * viewport "center" would appear on the current view, we calculate the difference
 * between the saved scroll position and current scroll position.
 */
function waypointToScreenPosition(
  waypoint: Waypoint,
  appState: AppState,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // Calculates where the saved viewport center appears in current viewport
  // When scrollX values match, the marker should be at screen center
  
  // Difference in scroll positions
  const deltaX = waypoint.x - appState.scrollX;
  const deltaY = waypoint.y - appState.scrollY;
  
  // The marker appears at screen center offset by the scroll difference
  // scaled by the current zoom level
  const screenX = canvasWidth / 2 + deltaX * appState.zoom.value;
  const screenY = canvasHeight / 2 + deltaY * appState.zoom.value;

  return { x: screenX, y: screenY };
}

/**
 * Diamond-shaped waypoint marker component
 */
const WaypointMarker: React.FC<WaypointMarkerProps> = ({
  waypoint,
  x,
  y,
  onJump,
}) => {
  const size = 24;
  const halfSize = size / 2;

  // Diamond shape points (rotated square)
  const points = `${x},${y - halfSize} ${x + halfSize},${y} ${x},${y + halfSize} ${x - halfSize},${y}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onJump(waypoint.id);
  };

  return (
    <g className="waypoint-marker" onClick={handleClick} style={{ cursor: "pointer" }}>
      {/* Diamond shape */}
      <polygon
        points={points}
        fill="#6965db"
        stroke="#4a47a3"
        strokeWidth={2}
        opacity={0.9}
      />

      {/* Waypoint label in center */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={10}
        fontWeight="bold"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {waypoint.name.slice(0, 2).toUpperCase()}
      </text>

      {/* Tooltip on hover */}
      <title>{waypoint.name} (click to jump)</title>
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
}) => {
  const { waypoints } = appState;

  if (!waypoints || waypoints.length === 0) {
    return null;
  }

  // Gets viewport dimensions
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

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
            canvasWidth,
            canvasHeight,
          );

          // Only renders if marker is within visible viewport
          const padding = 50;
          if (
            x < -padding ||
            x > canvasWidth + padding ||
            y < -padding ||
            y > canvasHeight + padding
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
            />
          );
        })}
      </g>
    </svg>
  );
};

export default WaypointCanvasOverlay;

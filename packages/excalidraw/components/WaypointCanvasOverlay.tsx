import React from "react";


import type { AppState, Waypoint } from "../types";

interface WaypointCanvasOverlayProps {
  appState: AppState;
  onJump: (id: string) => void;
  onPlaceWaypoint: (canvasX: number, canvasY: number) => void;
  onCancelPlacement: () => void;
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
  // Converting canvas coordinates to screen position
  const screenX = canvasWidth / 2 + (waypoint.x + appState.scrollX) * appState.zoom.value;
  const screenY = canvasHeight / 2 + (waypoint.y + appState.scrollY) * appState.zoom.value;

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
  onPlaceWaypoint,
  onCancelPlacement,
}) => {
  const { waypoints, isPlacingWaypoint } = appState;

  // Gets viewport dimensions
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: isPlacingWaypoint ? "auto" : "none",
    overflow: "visible",
    zIndex: 10,
    cursor: isPlacingWaypoint ? "crosshair" : "default",
  };

  const markerGroupStyle: React.CSSProperties = {
    pointerEvents: "auto",
  };

  // Handles click on canvas during placement mode
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPlacingWaypoint) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Converts screen position to canvas coordinates
    const canvasX = (screenX - canvasWidth / 2) / appState.zoom.value - appState.scrollX;
    const canvasY = (screenY - canvasHeight / 2) / appState.zoom.value - appState.scrollY;

    onPlaceWaypoint(canvasX, canvasY);
  };

  // Handles right-click to cancel placement
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isPlacingWaypoint) {
      e.preventDefault();
      onCancelPlacement();
    }
  };

  // Ensuring we only render when there are waypoints or placement mode is active
  if ((!waypoints || waypoints.length === 0) && !isPlacingWaypoint) {
    return null;
  }

  return (
    <svg
      className="waypoint-canvas-overlay"
      style={overlayStyle}
      onClick={handleCanvasClick}
      onContextMenu={handleContextMenu}
    >
      {/* Placement mode indicator */}
      {isPlacingWaypoint && (
        <text
          x={canvasWidth / 2}
          y={125}
          textAnchor="middle"
          fill="#6965db"
          fontSize={14}
          fontWeight="bold"
          style={{ pointerEvents: "none" }}
        >
          Click on canvas to place waypoint (right-click to cancel)
        </text>
      )}

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

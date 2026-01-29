import type { AppState } from "@excalidraw/excalidraw/types";
import { viewportCoordsToSceneCoords } from "@excalidraw/common";

// Create a waypoint from current camera state
// Stores the scene coordinate at the center of the current viewport
export function addWaypointFromCurrentView(appState: AppState): AppState {
  const id = crypto.randomUUID?.() || `${Date.now()}`;
  const name = `Waypoint ${appState.waypoints.length + 1}`;

  // Get viewport center in scene coordinates
  const viewportCenterX = appState.width / 2;
  const viewportCenterY = appState.height / 2;
  const sceneCoords = viewportCoordsToSceneCoords(
    { clientX: viewportCenterX, clientY: viewportCenterY },
    appState,
  );

  const newWaypoint = {
    id,
    name,
    x: sceneCoords.x, // scene coordinate
    y: sceneCoords.y, // scene coordinate
    zoom: appState.zoom.value,
  };

  return {
    ...appState,
    waypoints: [...appState.waypoints, newWaypoint],
  };
}

// Rename waypoint
export function renameWaypoint(
  appState: AppState,
  id: string,
  name: string,
): AppState {
  return {
    ...appState,
    waypoints: appState.waypoints.map((wp) =>
      wp.id === id ? { ...wp, name } : wp,
    ),
  };
}

// Update waypoint position
export function updateWaypointPosition(
  appState: AppState,
  id: string,
  x: number,
  y: number,
): AppState {
  return {
    ...appState,
    waypoints: appState.waypoints.map((wp) =>
      // Update x, y AND zoom to match current view
      // This ensures that when we jump to this waypoint later,
      // we don't unexpectedly zoom in/out to an old zoom level.
      wp.id === id ? { ...wp, x, y, zoom: appState.zoom.value } : wp,
    ),
  };
}

// Delete waypoint
export function deleteWaypoint(
  appState: AppState,
  id: string,
): AppState {
  return {
    ...appState,
    waypoints: appState.waypoints.filter((wp) => wp.id !== id),
  };
}

// Jump to waypoint (camera)
// Centers the viewport on the waypoint's scene coordinates
export function jumpToWaypoint(
  appState: AppState,
  id: string,
): AppState {
  const wp = appState.waypoints.find((w) => w.id === id);
  if (!wp) return appState;

  // Calculate scroll position to center viewport on the waypoint's scene coordinates
  // The viewport shows scene coordinates from (scrollX, scrollY) to (scrollX + width/zoom, scrollY + height/zoom)
  // To center the viewport on the waypoint, we want the waypoint at (scrollX + width/(2*zoom), scrollY + height/(2*zoom))
  // Therefore: scrollX = width/(2*zoom) - waypoint.x
  const scrollX = appState.width / (2 * wp.zoom) - wp.x;
  const scrollY = appState.height / (2 * wp.zoom) - wp.y;

  return {
    ...appState,
    scrollX,
    scrollY,
    zoom: { value: wp.zoom as any },
  };
}
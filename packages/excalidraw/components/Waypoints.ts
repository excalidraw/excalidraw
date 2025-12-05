import type { AppState } from "@excalidraw/excalidraw/types";

// Create a waypoint from current camera state
export function addWaypointFromCurrentView(appState: AppState): AppState {
  const id = crypto.randomUUID?.() || `${Date.now()}`;
  const name = `Waypoint ${appState.waypoints.length + 1}`;

  const newWaypoint = {
    id,
    name,
    x: appState.scrollX,
    y: appState.scrollY,
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
export function jumpToWaypoint(
  appState: AppState,
  id: string,
): AppState {
  const wp = appState.waypoints.find((w) => w.id === id);
  if (!wp) return appState;

  return {
    ...appState,
    scrollX: wp.x,
    scrollY: wp.y,
    zoom: { value: wp.zoom as any },
  };
}

// Creating a waypoint at a specific canvas position
export function addWaypointAtPosition(
  appState: AppState,
  canvasX: number,
  canvasY: number,
): AppState {
  const id = crypto.randomUUID?.() || `${Date.now()}`;
  const name = `Waypoint ${appState.waypoints.length + 1}`;

  const newWaypoint = {
    id,
    name,
    x: canvasX,
    y: canvasY,
    zoom: appState.zoom.value,
  };

  return {
    ...appState,
    waypoints: [...appState.waypoints, newWaypoint],
    isPlacingWaypoint: false,
  };
}
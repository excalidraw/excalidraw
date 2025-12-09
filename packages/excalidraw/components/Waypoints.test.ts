import {
  addWaypointFromCurrentView,
  renameWaypoint,
  deleteWaypoint,
} from "./Waypoints";
import type { AppState, Waypoint } from "@excalidraw/excalidraw/types";

const makeBaseState = (overrides: Partial<AppState> = {}): AppState => {
  return {
    scrollX: 10,
    scrollY: 20,
    zoom: { value: 1 } as AppState["zoom"],
    waypoints: [],
    contextMenu: null,
    showWelcomeScreen: false,
    isLoading: false,
    errorMessage: null,
    activeEmbeddable: null,
    newElement: null,
    resizingElement: null,
    multiElement: null,
    selectionElement: null,
    isBindingEnabled: true,
    startBoundElement: null,
    suggestedBinding: null,
    frameToHighlight: null,
    frameRendering: {
      enabled: true,
      name: true,
      outline: true,
      clip: true,
    },
    editingFrame: null,
    elementsToHighlight: null,
    editingTextElement: null,
    activeTool: {
      type: "selection",
      customType: null,
      lastActiveTool: null,
      locked: false,
      fromSelection: false,
    },
    preferredSelectionTool: { type: "selection", initialized: false },
    penMode: false,
    penDetected: false,
    exportBackground: true,
    exportEmbedScene: false,
    exportWithDarkMode: false,
    exportScale: 1,
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "#ffffff",
    currentItemFillStyle: "solid",
    currentItemStrokeWidth: 1,
    currentItemStrokeStyle: "solid",
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontFamily: 1,
    currentItemFontSize: 20,
    currentItemTextAlign: "left",
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: "arrow",
    currentHoveredFontFamily: null,
    currentItemRoundness: "round",
    currentItemArrowType: "round",
    viewBackgroundColor: "#ffffff",
    cursorButton: "up",
    scrolledOutside: false,
    name: null,
    isResizing: false,
    isRotating: false,
    openMenu: null,
    openPopup: null,
    openSidebar: null,
    openDialog: null,
    defaultSidebarDockedPreference: false,
    lastPointerDownWith: "mouse",
    selectedElementIds: {},
    hoveredElementIds: {},
    previousSelectedElementIds: {},
    selectedElementsAreBeingDragged: false,
    shouldCacheIgnoreZoom: false,
    toast: null,
    zenModeEnabled: false,
    theme: "light",
    gridSize: 0,
    gridStep: 10,
    gridModeEnabled: false,
    viewModeEnabled: false,
    selectedGroupIds: {},
    editingGroupId: null,
    width: 1000,
    height: 800,
    offsetTop: 0,
    offsetLeft: 0,
    fileHandle: null,
    collaborators: new Map(),
    stats: { open: false, panels: 0 },
    currentChartType: "bar",
    pasteDialog: { shown: false, data: null },
    showHyperlinkPopup: false,
    selectedLinearElement: null,
    snapLines: [],
    originSnapOffset: { x: 0, y: 0 },
    objectsSnapModeEnabled: false,
    userToFollow: null,
    followedBy: new Set(),
    isCropping: false,
    croppingElementId: null,
    searchMatches: null,
    activeLockedId: null,
    lockedMultiSelections: {},
    bindMode: "orbit",
    ...overrides,
  };
};

describe("Waypoints appState helpers", () => {
  test("addWaypointFromCurrentView appends a waypoint using current camera", () => {
    const state = makeBaseState({
      scrollX: 100,
      scrollY: 200,
      zoom: { value: 1.5 } as any,
      waypoints: [],
    });

    const next = addWaypointFromCurrentView(state);

    expect(next.waypoints).toHaveLength(1);
    const wp = next.waypoints[0];
    expect(wp.x).toBe(233.33333333333331);
    expect(wp.y).toBe(66.66666666666669);
    expect(wp.zoom).toBe(1.5);
    expect(wp.name).toBe("Waypoint 1");
  });

  test("renameWaypoint changes only the matching waypoint name", () => {
    const state = makeBaseState({
      waypoints: [
        { id: "1", name: "Intro", x: 0, y: 0, zoom: 1 },
        { id: "2", name: "Details", x: 10, y: 10, zoom: 1 },
      ],
    });

    const next = renameWaypoint(state, "2", "New name");

    expect(next.waypoints[0].name).toBe("Intro");
    expect(next.waypoints[1].name).toBe("New name");
  });

  test("deleteWaypoint removes the matching waypoint", () => {
    const state = makeBaseState({
      waypoints: [
        { id: "1", name: "Intro", x: 0, y: 0, zoom: 1 },
        { id: "2", name: "Details", x: 10, y: 10, zoom: 2 },
      ],
    });

    const next = deleteWaypoint(state, "1");

    expect(next.waypoints).toHaveLength(1);
    expect(next.waypoints[0].id).toBe("2");
  });
});

import { zoomToFit } from "../src/actions/actionCanvas";
import { clearElementsForLocalStorage } from "../src/element";
import { ExcalidrawImperativeAPI } from "../src/types";
import { moveAllLeft } from "../src/zindex";
import { CollabAPI } from "./collab/Collab";

export function loadFixedCanvasSize(
  localDataState: any,
  opts: {
    collabAPI: CollabAPI | null;
    excalidrawAPI: ExcalidrawImperativeAPI;
  },
): void {
  const { excalidrawAPI } = opts;
  const appState = excalidrawAPI.getAppState();

  if (
    localDataState.elements?.length > 0 ||
    appState.canvasSize.mode !== "fixed"
  ) {
    return;
  }

  const canvasWidth = appState.canvasSize.width;
  const canvasHeight = appState.canvasSize.height;

  const initialElements = clearElementsForLocalStorage([
    {
      type: "frame",
      version: 110,
      versionNonce: 548469602,
      isDeleted: false,
      id: "CtfrFGQ6SOW14GOkSqQFq",
      fillStyle: "solid",
      strokeWidth: 0,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 0,
      y: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      width: canvasWidth,
      height: canvasHeight,
      seed: 137481726,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: 1696936932260,
      link: null,
      locked: true,
      name: null,
    },
    {
      id: "moDgKT4MmX_QRzzgTlcVC",
      type: "image",
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 0,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: "CtfrFGQ6SOW14GOkSqQFq",
      roundness: null,
      seed: 902013247,
      version: 92,
      versionNonce: 512116985,
      isDeleted: false,
      boundElements: [],
      updated: 1696937670028,
      link: null,
      locked: true,
      status: "saved",
      fileId: null,
      scale: [1, 1],
    },
  ]);

  localDataState.elements = moveAllLeft(initialElements, appState);

  localDataState.appState = zoomToFit({
    targetElements: localDataState.elements,
    appState,
    fitToViewport: true,
    viewportZoomFactor: 1,
  }).appState;
}

import { zoomToFit } from "../src/actions/actionCanvas";
import { moveAllLeft } from "../src/zindex";
import {
  convertToExcalidrawElements,
  ExcalidrawElementSkeleton,
} from "../src/data/transform";

export function loadFixedCanvasSize(localDataState: any): void {
  if (
    localDataState.elements?.length > 0 ||
    localDataState.appState?.canvasSize.mode !== "fixed"
  ) {
    return;
  }

  const canvasWidth = localDataState.appState.canvasSize.width;
  const canvasHeight = localDataState.appState.canvasSize.height;
  const initialElements = [
    {
      type: "frame",
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
      locked: true,
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
      frameId: "CtfrFGQ6SOW14GOkSqQFq",
      roundness: null,
      locked: true,
      scale: [1, 1],
    },
  ];

  localDataState.elements = moveAllLeft(
    convertToExcalidrawElements(initialElements as ExcalidrawElementSkeleton[]),
    localDataState.appState,
  );

  localDataState.appState = zoomToFit({
    targetElements: localDataState.elements,
    appState: localDataState.appState,
    fitToViewport: true,
    viewportZoomFactor: 1,
  }).appState;
}

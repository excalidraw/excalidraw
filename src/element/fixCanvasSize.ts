import { moveAllLeft } from "../zindex";
import {
  convertToExcalidrawElements,
  ExcalidrawElementSkeleton,
} from "../data/transform";
import { ExcalidrawImperativeAPI } from "../types";

export const fixCanvasSize = (
  localDataState: any,
  excalidrawAPI: ExcalidrawImperativeAPI,
) => {
  const appState = excalidrawAPI.getAppState();

  if (
    localDataState.elements?.length > 0 ||
    appState.canvasSize.mode !== "fixed"
  ) {
    return localDataState;
  }

  const canvasWidth = appState.canvasSize.width;
  const canvasHeight = appState.canvasSize.height;
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
    appState,
  );

  localDataState.appState = appState;

  return localDataState;
};

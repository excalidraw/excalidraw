import { CanvasState } from "./types";

export const initialCanvasState: CanvasState = {
  layers: [
    {
      id: "default-layer",
      name: "Default Layer",
      visible: true,
      elements: [],
    },
  ],
  activeLayerId: "default-layer",
};

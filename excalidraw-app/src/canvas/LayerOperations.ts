import { CanvasState, ExcalidrawElement } from "./types";

export function addElementToActiveLayer(canvasState: CanvasState, element: ExcalidrawElement): CanvasState {
  const updatedLayers = canvasState.layers.map((layer) =>
    layer.id === canvasState.activeLayerId
      ? { ...layer, elements: [...layer.elements, element] }
      : layer
  );

  return { ...canvasState, layers: updatedLayers };
}

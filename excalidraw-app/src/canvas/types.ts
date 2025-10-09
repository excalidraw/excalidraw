export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // ...other props
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  elements: ExcalidrawElement[];
}

export interface CanvasState {
  layers: Layer[];
  activeLayerId: string;
}

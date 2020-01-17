import { ExcalidrawElement } from "./element/types";

export type AppState = {
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  elementType: string;
  exportBackground: boolean;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFont: string;
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  cursorX: number;
  cursorY: number;
  name: string;
};

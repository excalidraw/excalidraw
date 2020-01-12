import { ExcalidrawElement } from "./element/types";
import { Point } from "roughjs/bin/geometry";

export type AppState = {
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  pathSegmentCircle: {
    x: number;
    y: number;
    arrow: ExcalidrawElement;
    segment: number;
    point: Point;
    overlappingPoint: number;
  } | null;
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

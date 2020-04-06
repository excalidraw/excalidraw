import {
  ExcalidrawElement,
  PointerType,
  ExcalidrawLinearElement,
} from "./element/types";
import { SHAPES } from "./shapes";
import { Point as RoughPoint } from "roughjs/bin/geometry";

export type FlooredNumber = number & { _brand: "FlooredNumber" };
export type Point = Readonly<RoughPoint>;

export type AppState = {
  isLoading: boolean;
  errorMessage: string | null;
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  multiElement: ExcalidrawLinearElement | null;
  selectionElement: ExcalidrawElement | null;
  // element being edited, but not necessarily added to elements array yet
  //  (e.g. text element when typing into the input)
  editingElement: ExcalidrawElement | null;
  elementType: typeof SHAPES[number]["value"];
  elementLocked: boolean;
  exportBackground: boolean;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: string;
  currentItemStrokeWidth: number;
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFont: string;
  viewBackgroundColor: string;
  scrollX: FlooredNumber;
  scrollY: FlooredNumber;
  cursorX: number;
  cursorY: number;
  cursorButton: "up" | "down";
  scrolledOutside: boolean;
  name: string;
  isCollaborating: boolean;
  isResizing: boolean;
  isRotating: boolean;
  zoom: number;
  openMenu: "canvas" | "shape" | null;
  lastPointerDownWith: PointerType;
  selectedElementIds: { [id: string]: boolean };
  collaborators: Map<
    string,
    {
      pointer?: {
        x: number;
        y: number;
      };
      button?: "up" | "down";
      selectedElementIds?: AppState["selectedElementIds"];
    }
  >;
  shouldCacheIgnoreZoom: boolean;
  showShortcutsDialog: boolean;
};

export type PointerCoords = Readonly<{
  x: number;
  y: number;
}>;

export type Gesture = {
  pointers: Map<number, PointerCoords>;
  lastCenter: { x: number; y: number } | null;
  initialDistance: number | null;
  initialScale: number | null;
};

export declare class GestureEvent extends UIEvent {
  readonly rotation: number;
  readonly scale: number;
}

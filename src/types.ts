import { ExcalidrawElement, PointerType } from "./element/types";
import { SHAPES } from "./shapes";

export type FlooredNumber = number & { _brand: "FlooredNumber" };

export type AppState = {
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  multiElement: ExcalidrawElement | null;
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
  scrolledOutside: boolean;
  name: string;
  selectedId?: string;
  isResizing: boolean;
  zoom: number;
  openedMenu: "canvas" | "shape" | null;
  lastPointerDownWith: PointerType;
};

export type Pointer = Readonly<{
  id: number;
  x: number;
  y: number;
}>;

export type Gesture = {
  pointers: Array<Pointer>;
  lastCenter: { x: number; y: number } | null;
  initialDistance: number | null;
  initialScale: number | null;
};

import { ExcalidrawElement } from "./element/types";

export type AppState = {
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  multiElement: ExcalidrawElement | null;
  selectionElement: ExcalidrawElement | null;
  // element being edited, but not necessarily added to elements array yet
  //  (e.g. text element when typing into the input)
  editingElement: ExcalidrawElement | null;
  elementType: string;
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
  scrollX: number;
  scrollY: number;
  cursorX: number;
  cursorY: number;
  scrolledOutside: boolean;
  name: string;
  selectedId?: string;
  isResizing: boolean;
  lng: string;
};

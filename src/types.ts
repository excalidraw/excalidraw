import {
  PointerType,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  TextAlign,
  ExcalidrawElement,
  FontFamily,
  GroupId,
} from "./element/types";
import { SHAPES } from "./shapes";
import { Point as RoughPoint } from "roughjs/bin/geometry";
import { SocketUpdateDataSource } from "./data";
import { LinearElementEditor } from "./element/linearElementEditor";

export type FlooredNumber = number & { _brand: "FlooredNumber" };
export type Point = Readonly<RoughPoint>;

export type AppState = {
  isLoading: boolean;
  errorMessage: string | null;
  draggingElement: NonDeletedExcalidrawElement | null;
  resizingElement: NonDeletedExcalidrawElement | null;
  multiElement: NonDeleted<ExcalidrawLinearElement> | null;
  selectionElement: NonDeletedExcalidrawElement | null;
  // element being edited, but not necessarily added to elements array yet
  //  (e.g. text element when typing into the input)
  editingElement: NonDeletedExcalidrawElement | null;
  editingLinearElement: LinearElementEditor | null;
  elementType: typeof SHAPES[number]["value"];
  elementLocked: boolean;
  exportBackground: boolean;
  shouldAddWatermark: boolean;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: string;
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: FontFamily;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  viewBackgroundColor: string;
  scrollX: FlooredNumber;
  scrollY: FlooredNumber;
  cursorX: number;
  cursorY: number;
  cursorButton: "up" | "down";
  scrolledOutside: boolean;
  name: string;
  username: string;
  isCollaborating: boolean;
  isResizing: boolean;
  isRotating: boolean;
  zoom: number;
  openMenu: "canvas" | "shape" | null;
  lastPointerDownWith: PointerType;
  selectedElementIds: { [id: string]: boolean };
  previousSelectedElementIds: { [id: string]: boolean };
  collaborators: Map<
    string,
    {
      pointer?: {
        x: number;
        y: number;
      };
      button?: "up" | "down";
      selectedElementIds?: AppState["selectedElementIds"];
      username?: string | null;
    }
  >;
  shouldCacheIgnoreZoom: boolean;
  showShortcutsDialog: boolean;
  zenModeEnabled: boolean;

  /** top-most selected groups (i.e. does not include nested groups) */
  selectedGroupIds: { [groupId: string]: boolean };
  /** group being edited when you drill down to its constituent element
    (e.g. when you double-click on a group's element) */
  editingGroupId: GroupId | null;
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

export type SocketUpdateData = SocketUpdateDataSource[keyof SocketUpdateDataSource] & {
  _brand: "socketUpdateData";
};

import {
  PointerType,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  TextAlign,
  ExcalidrawElement,
  FontFamily,
  GroupId,
  ExcalidrawBindableElement,
  Arrowhead,
  ChartType,
} from "./element/types";
import { SHAPES } from "./shapes";
import { Point as RoughPoint } from "roughjs/bin/geometry";
import { LinearElementEditor } from "./element/linearElementEditor";
import { SuggestedBinding } from "./element/binding";
import { ImportedDataState } from "./data/types";
import { ExcalidrawImperativeAPI } from "./components/App";
import type { ResolvablePromise } from "./utils";
import { Spreadsheet } from "./charts";
import { Language } from "./i18n";
import { UserIdleState } from "./excalidraw-app/collab/types";

export type Point = Readonly<RoughPoint>;

export type Collaborator = {
  pointer?: {
    x: number;
    y: number;
  };
  button?: "up" | "down";
  selectedElementIds?: AppState["selectedElementIds"];
  username?: string | null;
  userState?: UserIdleState;
  color?: {
    background: string;
    stroke: string;
  };
};

export type AppState = {
  isLoading: boolean;
  errorMessage: string | null;
  draggingElement: NonDeletedExcalidrawElement | null;
  resizingElement: NonDeletedExcalidrawElement | null;
  multiElement: NonDeleted<ExcalidrawLinearElement> | null;
  selectionElement: NonDeletedExcalidrawElement | null;
  isBindingEnabled: boolean;
  startBoundElement: NonDeleted<ExcalidrawBindableElement> | null;
  suggestedBindings: SuggestedBinding[];
  // element being edited, but not necessarily added to elements array yet
  // (e.g. text element when typing into the input)
  editingElement: NonDeletedExcalidrawElement | null;
  editingLinearElement: LinearElementEditor | null;
  elementType: typeof SHAPES[number]["value"];
  elementLocked: boolean;
  exportBackground: boolean;
  exportEmbedScene: boolean;
  exportWithDarkMode: boolean;
  shouldAddWatermark: boolean;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: ExcalidrawElement["fillStyle"];
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: FontFamily;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  currentItemStrokeSharpness: ExcalidrawElement["strokeSharpness"];
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  currentItemLinearStrokeSharpness: ExcalidrawElement["strokeSharpness"];
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  cursorButton: "up" | "down";
  scrolledOutside: boolean;
  name: string;
  isResizing: boolean;
  isRotating: boolean;
  zoom: Zoom;
  openMenu: "canvas" | "shape" | null;
  lastPointerDownWith: PointerType;
  selectedElementIds: { [id: string]: boolean };
  previousSelectedElementIds: { [id: string]: boolean };
  shouldCacheIgnoreZoom: boolean;
  showHelpDialog: boolean;
  toastMessage: string | null;
  zenModeEnabled: boolean;
  theme: "light" | "dark";
  gridSize: number | null;
  viewModeEnabled: boolean;

  /** top-most selected groups (i.e. does not include nested groups) */
  selectedGroupIds: { [groupId: string]: boolean };
  /** group being edited when you drill down to its constituent element
    (e.g. when you double-click on a group's element) */
  editingGroupId: GroupId | null;
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;

  isLibraryOpen: boolean;
  fileHandle: import("browser-fs-access").FileSystemHandle | null;
  collaborators: Map<string, Collaborator>;
  showStats: boolean;
  currentChartType: ChartType;
  pasteDialog:
    | {
        shown: false;
        data: null;
      }
    | {
        shown: true;
        data: Spreadsheet;
      };
};

export type NormalizedZoomValue = number & { _brand: "normalizedZoom" };

export type Zoom = Readonly<{
  value: NormalizedZoomValue;
  translation: Readonly<{
    x: number;
    y: number;
  }>;
}>;

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

export type LibraryItem = readonly NonDeleted<ExcalidrawElement>[];
export type LibraryItems = readonly LibraryItem[];

// NOTE ready/readyPromise props are optional for host apps' sake (our own
// implem guarantees existence)
export type ExcalidrawAPIRefValue =
  | ExcalidrawImperativeAPI
  | {
      readyPromise?: ResolvablePromise<ExcalidrawImperativeAPI>;
      ready?: false;
    };

export interface ExcalidrawProps {
  width?: number;
  height?: number;
  /** if not supplied, calculated by Excalidraw */
  offsetLeft?: number;
  /** if not supplied, calculated by Excalidraw */
  offsetTop?: number;
  onChange?: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => void;
  initialData?: ImportedDataState | null | Promise<ImportedDataState | null>;
  excalidrawRef?: ForwardRef<ExcalidrawAPIRefValue>;
  onCollabButtonClick?: () => void;
  isCollaborating?: boolean;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  }) => void;
  onExportToBackend?: (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    canvas: HTMLCanvasElement | null,
  ) => void;
  renderFooter?: (isMobile: boolean) => JSX.Element;
  langCode?: Language["code"];
  viewModeEnabled?: boolean;
  zenModeEnabled?: boolean;
  gridModeEnabled?: boolean;
  libraryReturnUrl?: string;
  theme?: "dark" | "light";
}

export type SceneData = {
  elements?: ImportedDataState["elements"];
  appState?: ImportedDataState["appState"];
  collaborators?: Map<string, Collaborator>;
  commitToHistory?: boolean;
};

import cssVariables from "./css/variables.module.scss";
import { AppProps } from "./types";
import { ExcalidrawElement, FontFamilyValues } from "./element/types";
import { COLOR_PALETTE } from "./colors";

export const isDarwin = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
export const isWindows = /^Win/.test(navigator.platform);
export const isAndroid = /\b(android)\b/i.test(navigator.userAgent);
export const isFirefox =
  "netscape" in window &&
  navigator.userAgent.indexOf("rv:") > 1 &&
  navigator.userAgent.indexOf("Gecko") > 1;
export const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
export const isSafari =
  !isChrome && navigator.userAgent.indexOf("Safari") !== -1;
// keeping function so it can be mocked in test
export const isBrave = () =>
  (navigator as any).brave?.isBrave?.name === "isBrave";

export const APP_NAME = "Excalidraw";

export const DRAGGING_THRESHOLD = 10; // px
export const LINE_CONFIRM_THRESHOLD = 8; // px
export const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
export const ELEMENT_TRANSLATE_AMOUNT = 1;
export const TEXT_TO_CENTER_SNAP_THRESHOLD = 30;
export const SHIFT_LOCKING_ANGLE = Math.PI / 12;
export const CURSOR_TYPE = {
  TEXT: "text",
  CROSSHAIR: "crosshair",
  GRABBING: "grabbing",
  GRAB: "grab",
  POINTER: "pointer",
  MOVE: "move",
  AUTO: "",
};
export const POINTER_BUTTON = {
  MAIN: 0,
  WHEEL: 1,
  SECONDARY: 2,
  TOUCH: -1,
} as const;

export enum EVENT {
  COPY = "copy",
  PASTE = "paste",
  CUT = "cut",
  KEYDOWN = "keydown",
  KEYUP = "keyup",
  MOUSE_MOVE = "mousemove",
  RESIZE = "resize",
  UNLOAD = "unload",
  FOCUS = "focus",
  BLUR = "blur",
  DRAG_OVER = "dragover",
  DROP = "drop",
  GESTURE_END = "gestureend",
  BEFORE_UNLOAD = "beforeunload",
  GESTURE_START = "gesturestart",
  GESTURE_CHANGE = "gesturechange",
  POINTER_MOVE = "pointermove",
  POINTER_DOWN = "pointerdown",
  POINTER_UP = "pointerup",
  STATE_CHANGE = "statechange",
  WHEEL = "wheel",
  TOUCH_START = "touchstart",
  TOUCH_END = "touchend",
  HASHCHANGE = "hashchange",
  VISIBILITY_CHANGE = "visibilitychange",
  SCROLL = "scroll",
  // custom events
  EXCALIDRAW_LINK = "excalidraw-link",
  MENU_ITEM_SELECT = "menu.itemSelect",
}

export const ENV = {
  TEST: "test",
  DEVELOPMENT: "development",
};

export const CLASSES = {
  SHAPE_ACTIONS_MENU: "App-menu__left",
};

// 1-based in case we ever do `if(element.fontFamily)`
export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
};

export const THEME = {
  LIGHT: "light",
  DARK: "dark",
};

export const WINDOWS_EMOJI_FALLBACK_FONT = "Segoe UI Emoji";

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY: FontFamilyValues = FONT_FAMILY.Virgil;
export const DEFAULT_TEXT_ALIGN = "left";
export const DEFAULT_VERTICAL_ALIGN = "top";
export const DEFAULT_VERSION = "{version}";

export const CANVAS_ONLY_ACTIONS = ["selectAll"];

export const GRID_SIZE = 20; // TODO make it configurable?

export const IMAGE_MIME_TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  jfif: "image/jfif",
} as const;

export const MIME_TYPES = {
  json: "application/json",
  // excalidraw data
  excalidraw: "application/vnd.excalidraw+json",
  excalidrawlib: "application/vnd.excalidrawlib+json",
  // image-encoded excalidraw data
  "excalidraw.svg": "image/svg+xml",
  "excalidraw.png": "image/png",
  // binary
  binary: "application/octet-stream",
  // image
  ...IMAGE_MIME_TYPES,
} as const;

export const EXPORT_IMAGE_TYPES = {
  png: "png",
  svg: "svg",
  clipboard: "clipboard",
} as const;

export const EXPORT_DATA_TYPES = {
  excalidraw: "excalidraw",
  excalidrawClipboard: "excalidraw/clipboard",
  excalidrawLibrary: "excalidrawlib",
} as const;

export const EXPORT_SOURCE =
  window.EXCALIDRAW_EXPORT_SOURCE || window.location.origin;

// time in milliseconds
export const IMAGE_RENDER_TIMEOUT = 500;
export const TAP_TWICE_TIMEOUT = 300;
export const TOUCH_CTX_MENU_TIMEOUT = 500;
export const TITLE_TIMEOUT = 10000;
export const VERSION_TIMEOUT = 30000;
export const SCROLL_TIMEOUT = 100;
export const ZOOM_STEP = 0.1;
export const MIN_ZOOM = 0.1;
export const HYPERLINK_TOOLTIP_DELAY = 300;

// Report a user inactive after IDLE_THRESHOLD milliseconds
export const IDLE_THRESHOLD = 60_000;
// Report a user active each ACTIVE_THRESHOLD milliseconds
export const ACTIVE_THRESHOLD = 3_000;

export const THEME_FILTER = cssVariables.themeFilter;

export const URL_QUERY_KEYS = {
  addLibrary: "addLibrary",
} as const;

export const URL_HASH_KEYS = {
  addLibrary: "addLibrary",
} as const;

export const DEFAULT_UI_OPTIONS: AppProps["UIOptions"] = {
  canvasActions: {
    changeViewBackgroundColor: true,
    clearCanvas: true,
    export: { saveFileToDisk: true },
    loadScene: true,
    saveToActiveFile: true,
    toggleTheme: null,
    saveAsImage: true,
  },
};

// breakpoints
// -----------------------------------------------------------------------------
// sm screen
export const MQ_SM_MAX_WIDTH = 640;
// md screen
export const MQ_MAX_WIDTH_PORTRAIT = 730;
export const MQ_MAX_WIDTH_LANDSCAPE = 1000;
export const MQ_MAX_HEIGHT_LANDSCAPE = 500;
// sidebar
export const MQ_RIGHT_SIDEBAR_MIN_WIDTH = 1229;
// -----------------------------------------------------------------------------

export const LIBRARY_SIDEBAR_WIDTH = parseInt(cssVariables.rightSidebarWidth);

export const MAX_DECIMALS_FOR_SVG_EXPORT = 2;

export const EXPORT_SCALES = [1, 2, 3];
export const DEFAULT_EXPORT_PADDING = 10; // px

export const DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT = 1440;

export const MAX_ALLOWED_FILE_BYTES = 2 * 1024 * 1024;

export const SVG_NS = "http://www.w3.org/2000/svg";

export const ENCRYPTION_KEY_BITS = 128;

export const VERSIONS = {
  excalidraw: 2,
  excalidrawLibrary: 2,
} as const;

export const BOUND_TEXT_PADDING = 5;

export const VERTICAL_ALIGN = {
  TOP: "top",
  MIDDLE: "middle",
  BOTTOM: "bottom",
};

export const TEXT_ALIGN = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
};

export const ELEMENT_READY_TO_ERASE_OPACITY = 20;

// Radius represented as 25% of element's largest side (width/height).
// Used for LEGACY and PROPORTIONAL_RADIUS algorithms, or when the element is
// below the cutoff size.
export const DEFAULT_PROPORTIONAL_RADIUS = 0.25;
// Fixed radius for the ADAPTIVE_RADIUS algorithm. In pixels.
export const DEFAULT_ADAPTIVE_RADIUS = 32;
// roundness type (algorithm)
export const ROUNDNESS = {
  // Used for legacy rounding (rectangles), which currently works the same
  // as PROPORTIONAL_RADIUS, but we need to differentiate for UI purposes and
  // forwards-compat.
  LEGACY: 1,

  // Used for linear elements & diamonds
  PROPORTIONAL_RADIUS: 2,

  // Current default algorithm for rectangles, using fixed pixel radius.
  // It's working similarly to a regular border-radius, but attemps to make
  // radius visually similar across differnt element sizes, especially
  // very large and very small elements.
  //
  // NOTE right now we don't allow configuration and use a constant radius
  // (see DEFAULT_ADAPTIVE_RADIUS constant)
  ADAPTIVE_RADIUS: 3,
} as const;

/** key containt id of precedeing elemnt id we use in reconciliation during
 * collaboration */
export const PRECEDING_ELEMENT_KEY = "__precedingElement__";

export const DEFAULT_ELEMENT_PROPS: {
  strokeColor: ExcalidrawElement["strokeColor"];
  backgroundColor: ExcalidrawElement["backgroundColor"];
  fillStyle: ExcalidrawElement["fillStyle"];
  strokeWidth: ExcalidrawElement["strokeWidth"];
  strokeStyle: ExcalidrawElement["strokeStyle"];
  roughness: ExcalidrawElement["roughness"];
  opacity: ExcalidrawElement["opacity"];
  locked: ExcalidrawElement["locked"];
} = {
  strokeColor: COLOR_PALETTE.black,
  backgroundColor: COLOR_PALETTE.transparent,
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  locked: false,
};

export const LIBRARY_SIDEBAR_TAB = "library";

export const DEFAULT_SIDEBAR = {
  name: "default",
  defaultTab: LIBRARY_SIDEBAR_TAB,
} as const;

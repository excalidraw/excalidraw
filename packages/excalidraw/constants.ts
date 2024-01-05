import cssVariables from "./css/variables.module.scss";
import { AppProps } from "./types";

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
export const isIOS =
  /iPad|iPhone/.test(navigator.platform) ||
  // iPadOS 13+
  (navigator.userAgent.includes("Mac") && "ontouchend" in document);
// keeping function so it can be mocked in test
export const isBrave = () =>
  (navigator as any).brave?.isBrave?.name === "isBrave";

export const APP_NAME = "Excalidraw";

export const DRAGGING_THRESHOLD = 10; // px
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
  ERASER: 5,
} as const;

export const POINTER_EVENTS = {
  enabled: "all",
  disabled: "none",
  // asserted as any so it can be freely assigned to React Element
  // "pointerEnvets" CSS prop
  inheritFromUI: "var(--ui-pointerEvents)" as any,
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
  MESSAGE = "message",
  FULLSCREENCHANGE = "fullscreenchange",
}

export const YOUTUBE_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export const ENV = {
  TEST: "test",
  DEVELOPMENT: "development",
};

export const CLASSES = {
  SHAPE_ACTIONS_MENU: "App-menu__left",
};

export const FRAME_STYLE = {
  strokeColor: "#bbb" as ExcalidrawElement["strokeColor"],
  strokeWidth: 2 as ExcalidrawElement["strokeWidth"],
  strokeStyle: "solid" as ExcalidrawElement["strokeStyle"],
  fillStyle: "solid" as ExcalidrawElement["fillStyle"],
  roughness: 0 as ExcalidrawElement["roughness"],
  roundness: null as ExcalidrawElement["roundness"],
  backgroundColor: "transparent" as ExcalidrawElement["backgroundColor"],
  radius: 8,
  nameOffsetY: 3,
  nameColorLightTheme: "#999999",
  nameColorDarkTheme: "#7a7a7a",
  nameFontSize: 14,
  nameLineHeight: 1.25,
};

export const WINDOWS_EMOJI_FALLBACK_FONT = "Segoe UI Emoji";

export const MIN_FONT_SIZE = 1;
export const DEFAULT_VERTICAL_ALIGN = "top";
export const DEFAULT_VERSION = "{version}";

export const CANVAS_ONLY_ACTIONS = ["selectAll"];

export const GRID_SIZE = 20; // TODO make it configurable?

export const ALLOWED_PASTE_MIME_TYPES = ["text/plain", "text/html"] as const;

export const EXPORT_IMAGE_TYPES = {
  png: "png",
  svg: "svg",
  clipboard: "clipboard",
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
  tools: {
    image: true,
  },
};

// breakpoints
// -----------------------------------------------------------------------------
// md screen
export const MQ_MAX_WIDTH_PORTRAIT = 730;
export const MQ_MAX_WIDTH_LANDSCAPE = 1000;
export const MQ_MAX_HEIGHT_LANDSCAPE = 500;
// sidebar
export const MQ_RIGHT_SIDEBAR_MIN_WIDTH = 1229;
// -----------------------------------------------------------------------------

export const LIBRARY_SIDEBAR_WIDTH = parseInt(cssVariables.rightSidebarWidth);

export const MAX_DECIMALS_FOR_SVG_EXPORT = 2;

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
export const ARROW_LABEL_WIDTH_FRACTION = 0.7;
export const ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO = 11;

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

/** key containt id of precedeing elemnt id we use in reconciliation during
 * collaboration */
export const PRECEDING_ELEMENT_KEY = "__precedingElement__";

export const STROKE_WIDTH = {
  thin: 1,
  bold: 2,
  extraBold: 4,
} as const;

export const LIBRARY_SIDEBAR_TAB = "library";

export const DEFAULT_SIDEBAR = {
  name: "default",
  defaultTab: LIBRARY_SIDEBAR_TAB,
} as const;

export const LIBRARY_DISABLED_TYPES = new Set([
  "iframe",
  "embeddable",
  "image",
] as const);

// use these constants to easily identify reference sites
export const TOOL_TYPE = {
  selection: "selection",
  rectangle: "rectangle",
  diamond: "diamond",
  ellipse: "ellipse",
  arrow: "arrow",
  line: "line",
  freedraw: "freedraw",
  text: "text",
  image: "image",
  eraser: "eraser",
  hand: "hand",
  frame: "frame",
  magicframe: "magicframe",
  embeddable: "embeddable",
  laser: "laser",
} as const;

export const EDITOR_LS_KEYS = {
  OAI_API_KEY: "excalidraw-oai-api-key",
  // legacy naming (non)scheme
  MERMAID_TO_EXCALIDRAW: "mermaid-to-excalidraw",
  PUBLISH_LIBRARY: "publish-library-data",
} as const;

export * from "../shared/constants";

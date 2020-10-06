import { FontFamily } from "./element/types";

export const DRAGGING_THRESHOLD = 10; // 10px
export const LINE_CONFIRM_THRESHOLD = 10; // 10px
export const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
export const ELEMENT_TRANSLATE_AMOUNT = 1;
export const TEXT_TO_CENTER_SNAP_THRESHOLD = 30;
export const SHIFT_LOCKING_ANGLE = Math.PI / 12;
export const CURSOR_TYPE = {
  TEXT: "text",
  CROSSHAIR: "crosshair",
  GRABBING: "grabbing",
  POINTER: "pointer",
  MOVE: "move",
  AUTO: "",
};
export const POINTER_BUTTON = {
  MAIN: 0,
  WHEEL: 1,
  SECONDARY: 2,
  TOUCH: -1,
};

export enum SCENE {
  INIT = "SCENE_INIT",
  UPDATE = "SCENE_UPDATE",
}

export enum EVENT {
  COPY = "copy",
  PASTE = "paste",
  CUT = "cut",
  KEYDOWN = "keydown",
  KEYUP = "keyup",
  MOUSE_MOVE = "mousemove",
  RESIZE = "resize",
  UNLOAD = "unload",
  BLUR = "blur",
  DRAG_OVER = "dragover",
  DROP = "drop",
  GESTURE_END = "gestureend",
  BEFORE_UNLOAD = "beforeunload",
  GESTURE_START = "gesturestart",
  GESTURE_CHANGE = "gesturechange",
  POINTER_MOVE = "pointermove",
  POINTER_UP = "pointerup",
  STATE_CHANGE = "statechange",
  WHEEL = "wheel",
  TOUCH_START = "touchstart",
  TOUCH_END = "touchend",
  HASHCHANGE = "hashchange",
}

export const ENV = {
  TEST: "test",
  DEVELOPMENT: "development",
};

export const BROADCAST = {
  SERVER_VOLATILE: "server-volatile-broadcast",
  SERVER: "server-broadcast",
};

export const CLASSES = {
  SHAPE_ACTIONS_MENU: "App-menu__left",
};

// 1-based in case we ever do `if(element.fontFamily)`
export const FONT_FAMILY = {
  1: "Virgil",
  2: "Helvetica",
  3: "Cascadia",
} as const;

export const WINDOWS_EMOJI_FALLBACK_FONT = "Segoe UI Emoji";

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY: FontFamily = 1;
export const DEFAULT_TEXT_ALIGN = "left";
export const DEFAULT_VERTICAL_ALIGN = "top";

export const CANVAS_ONLY_ACTIONS = ["selectAll"];

export const GRID_SIZE = 20; // TODO make it configurable?

export const LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG = "collabLinkForceLoadFlag";

/**
 * Max area of a <canvas> element that we can support for PNG export, (in px*px)
 *
 * The maximum size of a <canvas> element is very large, but the exact size
 * depends on the browser. Unfortunately, browsers do not provide a way to
 * determine what their limitations are, nor do they provide any kind of
 * feedback after an unusable canvas has been created.
 *
 * The constant defined here is just a heuristic that should be good enough for
 * most browsers. A more robust approach could use of the canvas-size library
 * and detect the canvas limitations at the application startup (or when the
 * components that render into a canvas context mount in the DOM).
 *
 * Note: even when the canvas is too big, the drawing might still be exported
 * succesfully as SVG, since it has nothing to do with the canvas.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas
 * @see https://github.com/jhildenbiddle/canvas-size
 * @see https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
 */
export const MAX_CANVAS_AREA = 200_000_000;

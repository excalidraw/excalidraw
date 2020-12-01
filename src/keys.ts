export const isDarwin = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

export const CODES = {
  EQUAL: "Equal",
  MINUS: "Minus",
  NUM_ADD: "NumpadAdd",
  NUM_SUBTRACT: "NumpadSubtract",
  NUM_ZERO: "Numpad0",
  ONE: "Digit1",
  ZERO: "Digit0",
  G: "KeyG",
  H: "KeyV",
  V: "KeyV",
} as const;

export const KEYS = {
  CTRL_OR_CMD: isDarwin ? "metaKey" : "ctrlKey",

  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",

  BACKSPACE: "Backspace",
  ESCAPE: "Escape",
  DELETE: "Delete",
  ENTER: "Enter",
  TAB: "Tab",

  SPACE: " ",
  QUESTION_MARK_KEY: "?",
  QUOTE_KEY: "'",

  A: "a",
  C: "c",
  D: "d",
  F: "f",
  H: "h",
  Q: "q",
  S: "s",
  Z: "z",
} as const;

export type Key = keyof typeof KEYS;

export const isArrowKey = (key: string) =>
  key === KEYS.ARROW_LEFT ||
  key === KEYS.ARROW_RIGHT ||
  key === KEYS.ARROW_DOWN ||
  key === KEYS.ARROW_UP;

export const getResizeCenterPointKey = (event: MouseEvent | KeyboardEvent) =>
  event.altKey;

export const getResizeWithSidesSameLengthKey = (event: MouseEvent) =>
  event.shiftKey;

export const getRotateWithDiscreteAngleKey = (event: MouseEvent) =>
  event.shiftKey;

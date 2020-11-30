export const isDarwin = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

export const KEYS = {
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
  BACKSPACE: "Backspace",
  CTRL_OR_CMD: isDarwin ? "metaKey" : "ctrlKey",
  DELETE: "Delete",
  ENTER: "Enter",
  EQUAL: "Equal",
  ESCAPE: "Escape",
  MINUS: "Minus",
  QUESTION_MARK_KEY: "?",
  QUOTE_KEY: "'",
  SPACE: "Space",
  TAB: "Tab",

  A_KEY: "a",
  C_KEY: "c",
  D_KEY: "d",
  F_KEY: "f",
  G_KEY: "g",
  H_KEY: "h",
  Q_KEY: "q",
  S_KEY: "s",
  V_KEY: "v",
  Z_KEY: "z",
} as const;

export type Key = keyof typeof KEYS;

export const isArrowCode = (code: string) =>
  code === KEYS.ARROW_LEFT ||
  code === KEYS.ARROW_RIGHT ||
  code === KEYS.ARROW_DOWN ||
  code === KEYS.ARROW_UP;

export const getResizeCenterPointKey = (event: MouseEvent | KeyboardEvent) =>
  event.altKey;

export const getResizeWithSidesSameLengthKey = (event: MouseEvent) =>
  event.shiftKey;

export const getRotateWithDiscreteAngleKey = (event: MouseEvent) =>
  event.shiftKey;

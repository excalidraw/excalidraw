export const isDarwin = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

export const KEYS = {
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_DOWN: "ArrowDown",
  ARROW_UP: "ArrowUp",
  ENTER: "Enter",
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
  CTRL_OR_CMD: isDarwin ? "metaKey" : "ctrlKey",
  TAB: "Tab",
  SPACE: " ",
  QUESTION_MARK: "?",
  F_KEY_CODE: 70,
  ALT_KEY_CODE: 18,
  Z_KEY_CODE: 90,
} as const;

export type Key = keyof typeof KEYS;

export function isArrowKey(keyCode: string) {
  return (
    keyCode === KEYS.ARROW_LEFT ||
    keyCode === KEYS.ARROW_RIGHT ||
    keyCode === KEYS.ARROW_DOWN ||
    keyCode === KEYS.ARROW_UP
  );
}

export const getResizeCenterPointKey = (event: MouseEvent | KeyboardEvent) =>
  event.altKey || event.which === KEYS.ALT_KEY_CODE;
export const getResizeWithSidesSameLengthKey = (event: MouseEvent) =>
  event.shiftKey;

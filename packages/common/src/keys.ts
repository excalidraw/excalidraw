import { isDarwin } from "./constants";

import type { ValueOf } from "./utility-types";

export const CODES = {
  EQUAL: "Equal",
  MINUS: "Minus",
  NUM_ADD: "NumpadAdd",
  NUM_SUBTRACT: "NumpadSubtract",
  NUM_ZERO: "Numpad0",
  BRACKET_RIGHT: "BracketRight",
  BRACKET_LEFT: "BracketLeft",
  ONE: "Digit1",
  TWO: "Digit2",
  THREE: "Digit3",
  NINE: "Digit9",
  QUOTE: "Quote",
  ZERO: "Digit0",
  SLASH: "Slash",
  C: "KeyC",
  D: "KeyD",
  H: "KeyH",
  V: "KeyV",
  Z: "KeyZ",
  Y: "KeyY",
  R: "KeyR",
  S: "KeyS",
} as const;

export const KEYS = {
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  BACKSPACE: "Backspace",
  ALT: "Alt",
  CTRL_OR_CMD: isDarwin ? "metaKey" : "ctrlKey",
  DELETE: "Delete",
  ENTER: "Enter",
  ESCAPE: "Escape",
  QUESTION_MARK: "?",
  SPACE: " ",
  TAB: "Tab",
  CHEVRON_LEFT: "<",
  CHEVRON_RIGHT: ">",
  PERIOD: ".",
  COMMA: ",",
  SUBTRACT: "-",
  SLASH: "/",

  A: "a",
  C: "c",
  D: "d",
  E: "e",
  F: "f",
  G: "g",
  H: "h",
  I: "i",
  L: "l",
  O: "o",
  P: "p",
  Q: "q",
  R: "r",
  S: "s",
  T: "t",
  V: "v",
  X: "x",
  Y: "y",
  Z: "z",
  K: "k",
  W: "w",

  0: "0",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
} as const;

export type Key = keyof typeof KEYS;

// defines key code mapping for matching codes as fallback to respective keys on non-latin keyboard layouts
export const KeyCodeMap = new Map<ValueOf<typeof KEYS>, ValueOf<typeof CODES>>([
  [KEYS.Z, CODES.Z],
  [KEYS.Y, CODES.Y],
]);

export const isLatinChar = (key: string) => /^[a-z]$/.test(key.toLowerCase());

/**
 * Used to match key events for any keyboard layout, especially on Windows and Linux,
 * where non-latin character with modified (CMD) is not substituted with latin-based alternative.
 *
 * Uses `event.key` when it's latin, otherwise fallbacks to `event.code` (if mapping exists).
 *
 * Example of pressing "z" on different layouts, with the chosen key or code highlighted in []:
 *
 * Layout                | Code  | Key | Comment
 * --------------------- | ----- | --- | -------
 * U.S.                  |  KeyZ  | [z] |
 * Czech                 |  KeyY  | [z] |
 * Turkish               |  KeyN  | [z] |
 * French                |  KeyW  | [z] |
 * Macedonian            | [KeyZ] |  з  | z with cmd; з is Cyrillic equivalent of z
 * Russian               | [KeyZ] |  я  | z with cmd
 * Serbian               | [KeyZ] |  ѕ  | z with cmd
 * Greek                 | [KeyZ] |  ζ  | z with cmd; also ζ is Greek equivalent of z
 * Hebrew                | [KeyZ] |  ז  | z with cmd; also ז is Hebrew equivalent of z
 * Pinyin - Simplified   |  KeyZ  | [z] | due to IME
 * Cangije - Traditional | [KeyZ] |  重 | z with cmd
 * Japanese              | [KeyZ] |  つ | z with cmd
 * 2-Set Korean          | [KeyZ] |  ㅋ | z with cmd
 *
 * More details in https://github.com/excalidraw/excalidraw/pull/5944
 */
export const matchKey = (
  event: KeyboardEvent | React.KeyboardEvent<Element>,
  key: ValueOf<typeof KEYS>,
): boolean => {
  // for latin layouts use key
  if (key === event.key.toLowerCase()) {
    return true;
  }

  // non-latin layouts fallback to code
  const code = KeyCodeMap.get(key);
  return Boolean(code && !isLatinChar(event.key) && event.code === code);
};

export const isArrowKey = (key: string) =>
  key === KEYS.ARROW_LEFT ||
  key === KEYS.ARROW_RIGHT ||
  key === KEYS.ARROW_DOWN ||
  key === KEYS.ARROW_UP;

export const shouldResizeFromCenter = (event: MouseEvent | KeyboardEvent) =>
  event.altKey;

export const shouldMaintainAspectRatio = (event: MouseEvent | KeyboardEvent) =>
  event.shiftKey;

export const shouldRotateWithDiscreteAngle = (
  event: MouseEvent | KeyboardEvent | React.PointerEvent<HTMLCanvasElement>,
) => event.shiftKey;

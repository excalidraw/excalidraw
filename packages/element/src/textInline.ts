import type { ExcalidrawTextElement } from "./types";

/**
 * sdamex: host hooks for inline fragments inside text elements (board
 * formulas, SdamEx #5072). The fork knows nothing about formulas: the host
 * splits a line into wrap tokens, marks the ones that must never be broken,
 * and may draw a line itself. Without registered hooks every path behaves as
 * upstream.
 *
 * Contract:
 * - `tokenize(line)` returns tokens whose concatenation is exactly `line`
 *   (no normalization: `wrapLine` tracks source offsets by token length), or
 *   `null` to use the default tokenizer for this line;
 * - `isAtom(token)` marks a token as indivisible: it is never split by
 *   characters and never treated as trailing whitespace. An atom wider than
 *   the wrap width stays whole on its own line;
 * - `renderLine` draws one line of a text element. The context already has the
 *   element font, fill style and text align; `x` and `y` are the point the fork
 *   would pass to `fillText`. Return `false` to let the fork draw the line;
 * - `renderLineSvg` returns the SVG node for one line, or `null` to let the
 *   fork emit its `<text>`. `attrs` are the values of that `<text>`.
 */
export type TextInlineSvgLineAttrs = {
  x: number;
  y: number;
  fill: string;
  fontFamily: string;
  fontSize: number;
  textAnchor: "start" | "middle" | "end";
  direction: "ltr" | "rtl";
};

export interface TextInlineHooks {
  tokenize?: (line: string) => string[] | null;
  isAtom?: (token: string) => boolean;
  renderLine?: (
    context: CanvasRenderingContext2D,
    element: ExcalidrawTextElement,
    line: string,
    x: number,
    y: number,
  ) => boolean;
  renderLineSvg?: (
    document: Document,
    element: ExcalidrawTextElement,
    line: string,
    attrs: TextInlineSvgLineAttrs,
  ) => SVGElement | null;
}

let textInlineHooks: TextInlineHooks | null = null;

/** Registers the host hooks. Pass `null` to restore the upstream behavior. */
export const setTextInlineHooks = (hooks: TextInlineHooks | null) => {
  textInlineHooks = hooks;
};

export const getTextInlineHooks = (): TextInlineHooks | null => textInlineHooks;

export const isTextInlineAtom = (token: string): boolean =>
  textInlineHooks?.isAtom?.(token) ?? false;

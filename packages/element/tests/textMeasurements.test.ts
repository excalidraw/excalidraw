import { describe, it, expect } from "vitest";

import { getRenderEnvironment } from "../src/renderEnvironment";
import {
  charWidth,
  getLineWidth,
  getMaxCharWidth,
  getTextWidth,
  measureText,
} from "../src/textMeasurements";
import { wrapText } from "../src/textWrapping";

import type { RenderEnvironment } from "../src/renderEnvironment";
import type { ExcalidrawTextElement, FontString } from "../src/types";

const LINE_HEIGHT = 1.25 as ExcalidrawTextElement["lineHeight"];

// in the test env the canvas provider multiplies the mocked advance width
// (character count) by 10, so a custom env with different fake widths is
// observable
const makeEnv = (perChar: number): RenderEnvironment => ({
  createCanvas: () =>
    ({
      getContext: () => ({
        font: "",
        measureText: (text: string) => ({ width: text.length * perChar }),
      }),
    } as unknown as HTMLCanvasElement),
  createImage: () => ({} as HTMLImageElement),
});

const FONT = "20px Excalifont" as FontString;

describe("text measurement env threading", () => {
  it("getLineWidth measures on the supplied env's canvas", () => {
    const env = makeEnv(3);
    const defaultWidth = getLineWidth("abc", FONT);
    expect(defaultWidth).toBe(30); // 3 chars * 10 (test env factor)
    expect(getLineWidth("abc", FONT, env)).toBe(90); // 3 * 3 * 10
    expect(getLineWidth("abc", FONT, getRenderEnvironment())).toBe(
      defaultWidth,
    );
  });

  it("measureText and getTextWidth thread env", () => {
    const env = makeEnv(3);
    const defaultMetrics = measureText("abc", FONT, LINE_HEIGHT);
    const envMetrics = measureText("abc", FONT, LINE_HEIGHT, env);
    expect(envMetrics.width).toBe(defaultMetrics.width * 3);
    expect(envMetrics.height).toBe(defaultMetrics.height);
    expect(getTextWidth("abc", FONT, env)).toBe(getTextWidth("abc", FONT) * 3);
  });

  it("wrapText wraps using the supplied env's widths", () => {
    const env = makeEnv(3);
    const text = "word word word word";
    // default env: 10px/char -> "word word word" (140px) fits in 150px
    // custom env: 30px/char -> only "word" (120px) fits in 150px
    expect(wrapText(text, FONT, 150).split("\n")).toEqual([
      "word word word",
      "word",
    ]);
    expect(wrapText(text, FONT, 150, env).split("\n")).toEqual([
      "word",
      "word",
      "word",
      "word",
    ]);
  });

  it("charWidth cache never serves one env's widths to another", () => {
    const env = makeEnv(3);
    expect(charWidth.calculate("A", FONT, env)).toBe(30);
    // switching env drops the cache rather than reusing the other env's width
    expect(charWidth.calculate("A", FONT)).toBe(10);
    expect(charWidth.getCache(FONT, env)).toBeUndefined();
    expect(charWidth.calculate("A", FONT, env)).toBe(30);
    // cached while the env stays put
    expect(charWidth.getCache(FONT, env)?.["A".charCodeAt(0)]).toBe(30);

    // clearing a font drops it rather than emptying it, so the approximation
    // helpers fall back to measuring
    charWidth.clearCache(FONT);
    expect(charWidth.getCache(FONT, env)).toBeUndefined();
    expect(charWidth.getCache(FONT)).toBeUndefined();
    expect(charWidth.calculate("A", FONT, env)).toBe(30);
    expect(charWidth.calculate("A", FONT)).toBe(10);
  });

  it("getMaxCharWidth reads the cache of the env it is asked about", () => {
    const env = makeEnv(3);
    charWidth.calculate("A", FONT, env);
    charWidth.calculate("A", FONT);
    expect(getMaxCharWidth(FONT)).toBe(10);
    // no entry for `env` any more -- 0 means "unmeasured", so callers measure
    expect(getMaxCharWidth(FONT, env)).toBe(0);
    charWidth.calculate("A", FONT, env);
    expect(getMaxCharWidth(FONT, env)).toBe(30);
  });
});

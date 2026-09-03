import { describe, it, expect, afterEach } from "vitest";

import {
  getRenderEnvironment,
  setRenderEnvironment,
  resetRenderEnvironment,
} from "../src/renderEnvironment";
import {
  charWidth,
  getMaxCharWidth,
  getTextWidth,
} from "../src/textMeasurements";

import type { RenderEnvironment } from "../src/renderEnvironment";
import type { FontString } from "../src/types";

const FONT = "20px Excalifont" as FontString;

// in the test env the canvas provider multiplies the mocked advance width
// (character count) by 10, so an env measuring different widths is observable
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

/**
 * Everything the renderer memoizes per host realm (text metrics providers,
 * element bitmaps, link icons) is keyed on the render environment's identity,
 * so a swap must invalidate rather than serve one realm's pixels to another.
 */
describe("render environment cache invalidation", () => {
  afterEach(() => resetRenderEnvironment());

  it("installs a fresh identity per swap, dropping identity-keyed caches", () => {
    const before = getRenderEnvironment();
    expect(getRenderEnvironment()).toBe(before);

    const cache = new WeakMap<RenderEnvironment, number>();
    cache.set(before, 1);

    setRenderEnvironment(makeEnv(3));
    const swapped = getRenderEnvironment();
    expect(swapped).not.toBe(before);
    expect(cache.get(swapped)).toBeUndefined();

    // even an identical override is a new realm as far as the caches go
    setRenderEnvironment(makeEnv(3));
    expect(getRenderEnvironment()).not.toBe(swapped);

    resetRenderEnvironment();
    expect(getRenderEnvironment()).not.toBe(swapped);
  });

  it("rebuilds the default text metrics provider for a new environment", () => {
    const firstEnvCanvases: HTMLCanvasElement[] = [];
    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        firstEnvCanvases.push(canvas);
        return canvas;
      },
    });
    // builds + caches the default provider's canvas
    getTextWidth("measure me", FONT);
    expect(firstEnvCanvases).toHaveLength(1);

    const secondEnvCanvases: HTMLCanvasElement[] = [];
    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        secondEnvCanvases.push(canvas);
        return canvas;
      },
    });
    getTextWidth("measure me again", FONT);

    // measured on a canvas of its own rather than the first env's
    expect(secondEnvCanvases).toHaveLength(1);
    expect(firstEnvCanvases).toHaveLength(1);
  });

  it("never serves one environment's char widths to another", () => {
    const env = makeEnv(3);

    expect(charWidth.calculate("A", FONT, env)).toBe(30);
    // switching env drops the cache rather than reusing the other env's width
    expect(charWidth.calculate("A", FONT)).toBe(10);
    expect(charWidth.getCache(FONT, env)).toBeUndefined();
    // cached while the env stays put
    expect(charWidth.calculate("A", FONT, env)).toBe(30);
    expect(charWidth.getCache(FONT, env)?.["A".charCodeAt(0)]).toBe(30);

    // clearing a font drops the entry rather than emptying it, so the
    // approximation helpers fall back to measuring
    charWidth.clearCache(FONT);
    expect(charWidth.getCache(FONT, env)).toBeUndefined();
    expect(getMaxCharWidth(FONT, env)).toBe(0);

    charWidth.calculate("A", FONT, env);
    expect(getMaxCharWidth(FONT, env)).toBe(30);
    // ...and asking about a different env reports "unmeasured", not 30
    expect(getMaxCharWidth(FONT)).toBe(0);
  });
});

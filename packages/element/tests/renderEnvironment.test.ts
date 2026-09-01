import { describe, it, expect, afterEach } from "vitest";

import {
  getRenderEnvironment,
  setRenderEnvironment,
  resetRenderEnvironment,
} from "../src/renderEnvironment";

import type { RenderEnvironment } from "../src/renderEnvironment";

describe("setRenderEnvironment()", () => {
  afterEach(() => resetRenderEnvironment());

  const noopEnv: RenderEnvironment = {
    createCanvas: () => ({} as HTMLCanvasElement),
    createImage: () => ({} as HTMLImageElement),
  };

  it("keeps a stable identity across calls without a swap", () => {
    expect(getRenderEnvironment()).toBe(getRenderEnvironment());
  });

  it("installs a fresh environment object per swap", () => {
    const before = getRenderEnvironment();
    setRenderEnvironment(noopEnv);
    const swapped = getRenderEnvironment();
    expect(swapped).not.toBe(before);
    expect(swapped.createCanvas()).toEqual({});
    setRenderEnvironment(noopEnv);
    expect(getRenderEnvironment()).not.toBe(swapped);
  });

  it("partial overrides fall back to browser defaults", () => {
    setRenderEnvironment({ createCanvas: noopEnv.createCanvas });
    const env = getRenderEnvironment();
    expect(env.createCanvas()).toEqual({});
    expect(env.createImage()).toBeInstanceOf(HTMLImageElement);
  });

  it("reset installs a fresh browser-default environment", () => {
    const before = getRenderEnvironment();
    resetRenderEnvironment();
    const after = getRenderEnvironment();
    expect(after).not.toBe(before);
    expect(after.createImage()).toBeInstanceOf(HTMLImageElement);
  });

  it("invalidates identity-keyed caches on swap", () => {
    const cache = new WeakMap<RenderEnvironment, number>();
    cache.set(getRenderEnvironment(), 1);
    setRenderEnvironment(noopEnv);
    const env = getRenderEnvironment();
    expect(cache.get(env)).toBeUndefined();
    cache.set(env, 2);
    setRenderEnvironment(noopEnv);
    expect(cache.get(getRenderEnvironment())).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

/**
 * Guards the module-scope contract: nothing on the export path may touch
 * `document` / `window` / `navigator` at import time, or the packages become
 * unusable under Node (headless export, SSR thumbnailing).
 *
 * Runs under `vitest.config.node.mts` — see the note there on why the default
 * jsdom suite cannot catch this.
 */
describe("headless import", () => {
  it("runs without browser globals", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  it("imports @excalidraw/common without a DOM", async () => {
    const common = await import("@excalidraw/common");
    // evaluated at module scope, so they must resolve rather than throw.
    // NOTE: not asserting exact values -- Node exposes a partial `navigator`
    // (e.g. platform "MacIntel" on darwin), so these are host-dependent
    expect(typeof common.isDarwin).toBe("boolean");
    expect(typeof common.isSafari).toBe("boolean");
    expect(typeof common.isIOS).toBe("boolean");
    // `document` is absent entirely, so this one is stable
    expect(common.isBrave()).toBe(false);
  });

  it("imports @excalidraw/element without a DOM", async () => {
    const element = await import("@excalidraw/element");
    expect(typeof element.updateImageCache).toBe("function");
    // the default environment resolves lazily, so reading it is safe
    expect(typeof element.getRenderEnvironment().createCanvas).toBe("function");
  });

  it("imports the export pipeline without a DOM", async () => {
    const { exportToCanvas, exportToSvg } = await import("../../scene/export");
    expect(typeof exportToCanvas).toBe("function");
    expect(typeof exportToSvg).toBe("function");
  });

  it("imports the public @excalidraw/utils export entry without a DOM", async () => {
    const utils = await import("@excalidraw/utils/export");
    expect(typeof utils.exportToCanvas).toBe("function");
  });

  it("exposes the environment setters from the public @excalidraw/utils entry", async () => {
    // the escape hatch has to be reachable from the package a Node consumer
    // actually installs, not just from @excalidraw/element
    const utils = await import("@excalidraw/utils");
    expect(typeof utils.setRenderEnvironment).toBe("function");
    expect(typeof utils.resetRenderEnvironment).toBe("function");
  });

  it("builds a default appState without a DOM", async () => {
    const { getDefaultAppState } = await import("../../appState");
    expect(getDefaultAppState().exportScale).toBe(1);
  });
});

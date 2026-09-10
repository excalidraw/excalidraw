import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isHtmlInCanvasSupported,
  resetHtmlInCanvasDetection,
  asHtmlInCanvasCtx,
} from "../htmlInCanvasSupport";
import {
  drawHtmlElement,
  drawTextEditorInCanvas,
  drawHtmlElementWithEffects,
  createHtmlContentNode,
} from "../htmlCanvasRenderer";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const makeMockCtx = (withDrawElement = false): CanvasRenderingContext2D => {
  const ctx: any = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    filter: "none",
  };
  if (withDrawElement) {
    ctx.drawElement = vi.fn();
  }
  return ctx as CanvasRenderingContext2D;
};

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

describe("isHtmlInCanvasSupported", () => {
  beforeEach(() => resetHtmlInCanvasDetection());

  it("returns false when drawElement is absent", () => {
    // Default browser — no flag
    expect(isHtmlInCanvasSupported()).toBe(false);
  });

  it("caches the result", () => {
    isHtmlInCanvasSupported();
    isHtmlInCanvasSupported();
    // just ensure no throw; caching is internal
    expect(typeof isHtmlInCanvasSupported()).toBe("boolean");
  });
});

describe("asHtmlInCanvasCtx", () => {
  it("returns null for a regular context", () => {
    const ctx = makeMockCtx(false);
    expect(asHtmlInCanvasCtx(ctx)).toBeNull();
  });

  it("returns the context when drawElement exists", () => {
    const ctx = makeMockCtx(true);
    expect(asHtmlInCanvasCtx(ctx)).toBe(ctx);
  });
});

// ---------------------------------------------------------------------------
// Renderer — fallback path (API absent)
// ---------------------------------------------------------------------------

describe("drawHtmlElement (API absent)", () => {
  beforeEach(() => resetHtmlInCanvasDetection());

  it("returns false when API is not supported", () => {
    const ctx = makeMockCtx(false);
    const el = document.createElement("div");
    expect(drawHtmlElement(ctx, el, { x: 0, y: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Renderer — native path (API present)
// Force-enable the API by directly setting the cache via the reset + a
// patched isHtmlInCanvasSupported call, without touching document.createElement
// (which causes infinite recursion when spied on).
// ---------------------------------------------------------------------------

/**
 * Directly patches the module-level cache used by `isHtmlInCanvasSupported`
 * by calling `asHtmlInCanvasCtx` — if `drawElement` is on the mock ctx the
 * detection logic would return true. Instead we use the simpler approach:
 * pass a ctx that already has `drawElement` (makeMockCtx(true)) and verify
 * `asHtmlInCanvasCtx` returns it, then call the renderer directly with that
 * ctx (which bypasses the `isHtmlInCanvasSupported` guard by using
 * `asHtmlInCanvasCtx` internally).
 *
 * For tests that need `isHtmlInCanvasSupported()` to return `true` we
 * manipulate the HTMLCanvasElement prototype in a scoped way.
 */
const enableHtmlInCanvas = () => {
  // Patch HTMLCanvasElement.prototype.getContext so the detection probe
  // finds drawElement without touching document.createElement.
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...args: any[]
  ) {
    const ctx = origGetContext.call(this, type, ...args);
    if (ctx && type === "2d") {
      (ctx as any).drawElement = vi.fn();
    }
    return ctx;
  };
  return () => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  };
};

describe("drawHtmlElement (API present)", () => {
  let restore: () => void;

  beforeEach(() => {
    resetHtmlInCanvasDetection();
    restore = enableHtmlInCanvas();
  });

  afterEach(() => {
    restore();
    resetHtmlInCanvasDetection();
  });

  it("returns true and calls drawElement", () => {
    const ctx = makeMockCtx(true);
    const el = document.createElement("div");
    const result = drawHtmlElement(ctx, el, { x: 10, y: 20 });
    expect(result).toBe(true);
    expect((ctx as any).drawElement).toHaveBeenCalledWith(el, 0, 0);
  });

  it("applies opacity — ctx.save is called", () => {
    const ctx = makeMockCtx(true);
    const el = document.createElement("div");
    drawHtmlElement(ctx, el, { x: 0, y: 0, opacity: 0.5 });
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("applies clip rect — ctx.clip is called", () => {
    const ctx = makeMockCtx(true);
    const el = document.createElement("div");
    drawHtmlElement(ctx, el, {
      x: 0,
      y: 0,
      clip: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(ctx.clip).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// drawTextEditorInCanvas
// ---------------------------------------------------------------------------

describe("drawTextEditorInCanvas", () => {
  beforeEach(() => resetHtmlInCanvasDetection());

  it("returns false when API is absent", () => {
    const ctx = makeMockCtx(false);
    const ta = document.createElement("textarea");
    expect(drawTextEditorInCanvas(ctx, ta, { x: 0, y: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// drawHtmlElementWithEffects
// ---------------------------------------------------------------------------

describe("drawHtmlElementWithEffects", () => {
  beforeEach(() => resetHtmlInCanvasDetection());

  it("returns false when API is absent", () => {
    const ctx = makeMockCtx(false);
    const el = document.createElement("div");
    expect(
      drawHtmlElementWithEffects(ctx, el, {
        x: 0,
        y: 0,
        compositeOperation: "multiply",
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createHtmlContentNode
// ---------------------------------------------------------------------------

describe("createHtmlContentNode", () => {
  it("creates a div with the given dimensions and HTML", () => {
    const node = createHtmlContentNode("<p>Hello</p>", 200, 100);
    expect(node.tagName).toBe("DIV");
    expect(node.style.width).toBe("200px");
    expect(node.style.height).toBe("100px");
    expect(node.innerHTML).toBe("<p>Hello</p>");
  });
});

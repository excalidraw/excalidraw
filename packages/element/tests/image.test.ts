import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeSVG } from "../src/image";

const parse = (svgString: string) => {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  return doc.querySelector("svg")!;
};

const SVG_NS = `xmlns="http://www.w3.org/2000/svg"`;

describe("normalizeSVG", () => {
  // jsdom doesn't implement layout, so `getBBox` doesn't exist there. We stub
  // it on the prototype to emulate what a real browser would report.
  const proto = window.SVGElement.prototype as any;
  let originalGetBBox: unknown;

  beforeEach(() => {
    originalGetBBox = proto.getBBox;
  });

  afterEach(() => {
    if (originalGetBBox === undefined) {
      delete proto.getBBox;
    } else {
      proto.getBBox = originalGetBBox;
    }
  });

  const mockBBox = (box: Partial<DOMRect>) => {
    const getBBox = vi.fn(() => ({ x: 0, y: 0, width: 0, height: 0, ...box }));
    proto.getBBox = getBBox;
    return getBBox;
  };

  it("keeps explicit width/height/viewBox untouched", () => {
    const getBBox = mockBBox({ width: 999, height: 999 });

    const svg = parse(
      normalizeSVG(
        `<svg ${SVG_NS} width="120" height="80" viewBox="0 0 12 8"><rect width="12" height="8"/></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("120");
    expect(svg.getAttribute("height")).toBe("80");
    expect(svg.getAttribute("viewBox")).toBe("0 0 12 8");
    expect(getBBox).not.toHaveBeenCalled();
  });

  it("derives size from the viewBox when width/height are missing", () => {
    const getBBox = mockBBox({ width: 999, height: 999 });

    const svg = parse(
      normalizeSVG(
        `<svg ${SVG_NS} viewBox="0 0 300 200"><rect width="10" height="10"/></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("300");
    expect(svg.getAttribute("height")).toBe("200");
    expect(getBBox).not.toHaveBeenCalled();
  });

  // https://github.com/excalidraw/excalidraw/issues/6232
  it("measures the content when there is no width/height/viewBox", () => {
    mockBBox({ x: 0, y: 0, width: 1122.5, height: 793.7 });

    const svg = parse(
      normalizeSVG(
        `<svg ${SVG_NS} version="1.1"><rect x="0" y="0" width="297mm" height="210mm"/></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("1122.5");
    expect(svg.getAttribute("height")).toBe("793.7");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1122.5 793.7");
  });

  it("keeps the content origin when the content doesn't start at 0,0", () => {
    mockBBox({ x: 40, y: 20, width: 100, height: 50 });

    const svg = parse(
      normalizeSVG(
        `<svg ${SVG_NS}><rect x="40" y="20" width="100" height="50"/></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("100");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("40 20 100 50");
  });

  it("falls back to 50x50 when the content can't be measured", () => {
    // empty content => zero-sized bbox
    mockBBox({ width: 0, height: 0 });

    const svg = parse(normalizeSVG(`<svg ${SVG_NS}></svg>`));

    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("falls back to 50x50 when getBBox is unavailable or throws", () => {
    delete proto.getBBox;
    let svg = parse(
      normalizeSVG(`<svg ${SVG_NS}><rect width="9" height="9"/></svg>`),
    );
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 50");

    proto.getBBox = () => {
      throw new Error("not rendered");
    };
    svg = parse(
      normalizeSVG(`<svg ${SVG_NS}><rect width="9" height="9"/></svg>`),
    );
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("doesn't leave anything behind in the document after measuring", () => {
    mockBBox({ width: 10, height: 10 });
    const before = document.body.innerHTML;

    normalizeSVG(`<svg ${SVG_NS}><rect width="10" height="10"/></svg>`);

    expect(document.body.innerHTML).toBe(before);
  });

  it("never attaches scripts or event handlers from the SVG to the page while measuring", () => {
    let seenWhileMeasuring: string | null = null;
    proto.getBBox = function (this: SVGElement) {
      seenWhileMeasuring = this.ownerSVGElement
        ? this.ownerSVGElement.outerHTML
        : (this as SVGElement).outerHTML;
      return { x: 0, y: 0, width: 10, height: 10 };
    };

    normalizeSVG(
      `<svg ${SVG_NS} onload="window.__pwned = true">` +
        `<script>window.__pwned = true</script>` +
        `<foreignObject><div onclick="window.__pwned = true"/></foreignObject>` +
        `<image href="https://example.com/tracker.png" width="5" height="5"/>` +
        `<rect width="10" height="10" onmouseover="window.__pwned = true"/>` +
        `</svg>`,
    );

    expect(seenWhileMeasuring).not.toBeNull();
    expect(seenWhileMeasuring).not.toMatch(/onload|onclick|onmouseover/i);
    expect(seenWhileMeasuring).not.toMatch(/<script/i);
    expect(seenWhileMeasuring).not.toMatch(/foreignObject/i);
    expect(seenWhileMeasuring).not.toMatch(/example\.com/);
    expect((window as any).__pwned).toBeUndefined();
  });

  it("doesn't modify the SVG content that is returned", () => {
    mockBBox({ width: 10, height: 10 });

    const out = normalizeSVG(
      `<svg ${SVG_NS}><rect width="10" height="10" onclick="x()"/></svg>`,
    );

    // sanitizing is only done on the throwaway copy used for measuring
    expect(out).toContain(`onclick="x()"`);
  });
});

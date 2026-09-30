import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FontLibrary } from "./fontLibrary";
import { parseFamilies, replaceTextWithOutlines } from "./svgPrep";

import type { OutlineDeps } from "./svgPrep";

const fontsDir = path.resolve(__dirname, "../../../packages/excalidraw/fonts");
const lib = new FontLibrary(
  new Map([
    [
      9,
      [
        {
          unicodeRange: "U+0-10FFFF",
          load: () =>
            Promise.resolve(
              new Uint8Array(
                readFileSync(
                  path.join(
                    fontsDir,
                    "Liberation/LiberationSans-Regular.woff2",
                  ),
                ),
              ),
            ),
        },
      ],
    ],
  ]),
  (n) => (n === "Liberation Sans" ? 9 : undefined),
);
const deps: OutlineDeps = {
  library: lib,
  measureChar: () => 12,
  rasterizeChar: (char) => ({
    dataUrl: `data:image/png;base64,AAAA#${char}`,
    width: 12,
    height: 14,
    ascent: 11,
  }),
};

const svgOf = (inner: string) => {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">${inner}</svg>`,
    "image/svg+xml",
  );
  return doc.documentElement as unknown as SVGSVGElement;
};

describe("parseFamilies", () => {
  it("maps css families to bundled ones, drops the emoji font, and always ends with Liberation Sans", () => {
    expect(
      parseFamilies("Excalifont, Xiaolai, sans-serif, Segoe UI Emoji"),
    ).toEqual(["Excalifont", "Xiaolai", "Liberation Sans"]);
    expect(parseFamilies('"Comic Shanns", Helvetica')).toEqual([
      "Comic Shanns",
      "Liberation Sans",
    ]);
    expect(parseFamilies(null)).toEqual(["Liberation Sans"]);
  });
});

describe("replaceTextWithOutlines", () => {
  it("replaces text by a positioned outline path and keeps an invisible text layer", async () => {
    const svg = svgOf(
      `<g transform="rotate(10)"><text x="50" y="30" font-family="Helvetica" font-size="20px" fill="#ff0000" text-anchor="start" style="white-space: pre;">Hello</text></g>`,
    );
    await replaceTextWithOutlines(svg, deps);
    const g = svg.querySelector("g")!;
    const path = g.querySelector("path")!;
    expect(path.getAttribute("d")!.length).toBeGreaterThan(100);
    expect(path.getAttribute("fill")).toBe("#ff0000");
    expect(path.getAttribute("transform")).toBe("translate(50 30)");
    const text = g.querySelector("text")!;
    expect(text.getAttribute("fill-opacity")).toBe("0");
    expect(text.textContent).toBe("Hello");
    expect(g.getAttribute("transform")).toBe("rotate(10)"); // parent transforms are untouched
  });

  it("honours text-anchor middle/end by shifting the outline by its measured width", async () => {
    const at = async (anchor: string) => {
      const svg = svgOf(
        `<text x="100" y="20" font-size="20px" text-anchor="${anchor}">Hello</text>`,
      );
      await replaceTextWithOutlines(svg, deps);
      return parseFloat(
        /translate\(([-\d.]+)/.exec(
          svg.querySelector("path")!.getAttribute("transform")!,
        )![1]!,
      );
    };
    const start = await at("start");
    const middle = await at("middle");
    const end = await at("end");
    expect(start).toBe(100);
    const w = 100 - end;
    expect(w).toBeGreaterThan(30);
    expect(100 - middle).toBeCloseTo(w / 2, 2);
  });

  it("draws characters no font covers as images and drops the invisible layer for non-Latin text", async () => {
    const svg = svgOf(
      `<text x="0" y="20" font-size="20px" fill="#000">hi 😀</text>`,
    );
    await replaceTextWithOutlines(svg, deps);
    const img = svg.querySelector("image")!;
    expect(img.getAttribute("href")).toContain("#😀");
    expect(parseFloat(img.getAttribute("y")!)).toBe(20 - 11);
    expect(svg.querySelector("text")).toBeNull(); // emoji is outside Latin-1 -> no unsafe text layer
  });

  it("removes empty text nodes and handles multiple lines independently", async () => {
    const svg = svgOf(
      `<text x="0" y="20" font-size="20px"> </text><text x="0" y="20" font-size="20px">one</text><text x="0" y="45" font-size="20px">two</text>`,
    );
    const n = await replaceTextWithOutlines(svg, deps);
    expect(n).toBe(2);
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });
});

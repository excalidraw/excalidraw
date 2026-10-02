import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FontLibrary } from "./fontLibrary";
import { outlineLine } from "./textOutlines";

import type { FaceRegistry } from "./fontLibrary";

const fontsDir = path.resolve(__dirname, "../../../packages/excalidraw/fonts");
const file = (rel: string) => () =>
  Promise.resolve(new Uint8Array(readFileSync(path.join(fontsDir, rel))));

// id 9 = Liberation Sans (full Latin), 5 = Excalifont (Latin subset)
const registry: FaceRegistry = new Map([
  [
    9,
    [
      {
        unicodeRange: "U+0-10FFFF",
        load: file("Liberation/LiberationSans-Regular.woff2"),
      },
    ],
  ],
  [
    5,
    [
      {
        unicodeRange: "U+0-10FFFF",
        load: file(
          "Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2",
        ),
      },
      {
        unicodeRange: "U+0-10FFFF",
        load: file(
          "Excalifont/Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2",
        ),
      },
    ],
  ],
]);
const ids: Record<string, number> = { "Liberation Sans": 9, Excalifont: 5 };
const lib = () => new FontLibrary(registry, (n) => ids[n]);

describe("outlineLine", () => {
  it("turns text into vector outlines with realistic advance widths", async () => {
    const r = await outlineLine(
      lib(),
      "Hello",
      ["Liberation Sans"],
      20,
      () => 10,
    );
    expect(r.d.startsWith("M")).toBe(true);
    expect(r.d.length).toBeGreaterThan(200);
    // 'Hello' at 20px in Arial metrics ≈ 44.5px
    expect(r.width).toBeGreaterThan(40);
    expect(r.width).toBeLessThan(50);
    expect(r.missing).toEqual([]);
  });

  it("scales linearly with font size", async () => {
    const a = await outlineLine(
      lib(),
      "Wide text",
      ["Liberation Sans"],
      10,
      () => 5,
    );
    const b = await outlineLine(
      lib(),
      "Wide text",
      ["Liberation Sans"],
      40,
      () => 5,
    );
    expect(b.width / a.width).toBeCloseTo(4, 1);
  });

  it("uses the first family that has the glyph and reports characters no font covers", async () => {
    const r = await outlineLine(
      lib(),
      "a😀b",
      ["Excalifont", "Liberation Sans"],
      20,
      () => 20,
    );
    expect(r.missing).toEqual([{ char: "😀", x: expect.any(Number) }]);
    expect(r.missing[0]!.x).toBeGreaterThan(0);
    // the missing glyph still advances the pen so the following text stays aligned
    const withoutEmoji = await outlineLine(
      lib(),
      "ab",
      ["Excalifont", "Liberation Sans"],
      20,
      () => 20,
    );
    expect(r.width).toBeGreaterThan(withoutEmoji.width + 15);
  });

  it("does not draw whitespace but advances over it", async () => {
    const spaced = await outlineLine(
      lib(),
      "a b",
      ["Liberation Sans"],
      20,
      () => 0,
    );
    const tight = await outlineLine(
      lib(),
      "ab",
      ["Liberation Sans"],
      20,
      () => 0,
    );
    expect(spaced.width).toBeGreaterThan(tight.width + 4);
    expect(spaced.missing).toEqual([]);
  });

  it("returns an empty outline for empty text", async () => {
    expect(
      await outlineLine(lib(), "", ["Liberation Sans"], 20, () => 1),
    ).toEqual({ d: "", width: 0, missing: [] });
  });

  it("falls back to later families when the first does not know the family name", async () => {
    const r = await outlineLine(
      lib(),
      "A",
      ["Unknown Family", "Liberation Sans"],
      20,
      () => 1,
    );
    expect(r.d.length).toBeGreaterThan(20);
  });
});

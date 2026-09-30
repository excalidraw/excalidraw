import type { Font, FontLibrary } from "./fontLibrary";

export interface OutlinedLine {
  /** SVG path data with the baseline at y=0, pen starting at x=0 */
  d: string;
  width: number;
  /** characters no bundled font could draw (emoji, exotic scripts), with their x offsets */
  missing: { char: string; x: number }[];
}

/**
 * Lays a single line of text out with real glyph outlines (kerning and ligatures included).
 * Characters without a glyph are reported so the caller can draw them another way.
 */
export const outlineLine = async (
  lib: FontLibrary,
  text: string,
  families: readonly string[],
  fontSize: number,
  measureMissing: (char: string) => number,
  direction: "ltr" | "rtl" = "ltr",
): Promise<OutlinedLine> => {
  const chars = Array.from(text);
  // 1. choose a font per character
  const picks: Array<Font | null> = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    // no-glyph control chars and variation selectors take no space
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) {
      picks.push(null);
      continue;
    }
    picks.push(await lib.fontFor(families, cp));
  }

  // 2. group runs of the same font
  type Run = { font: Font | null; text: string };
  const runs: Run[] = [];
  chars.forEach((ch, i) => {
    const last = runs[runs.length - 1];
    if (last && last.font === picks[i]) {
      last.text += ch;
    } else {
      runs.push({ font: picks[i]!, text: ch });
    }
  });

  let pen = 0;
  let d = "";
  const missing: OutlinedLine["missing"] = [];
  for (const run of runs) {
    if (!run.font) {
      for (const ch of Array.from(run.text)) {
        const cp = ch.codePointAt(0)!;
        if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) {
          continue;
        }
        const w = measureMissing(ch);
        // whitespace needs no drawing
        if (!/^\s$/u.test(ch)) {
          missing.push({ char: ch, x: pen });
        }
        pen += w;
      }
      continue;
    }
    const scale = fontSize / run.font.unitsPerEm;
    const laid = run.font.layout(
      run.text,
      undefined,
      undefined,
      undefined,
      direction,
    );
    for (let i = 0; i < laid.glyphs.length; i++) {
      const glyph = laid.glyphs[i]!;
      const pos = laid.positions[i]!;
      const path = glyph.path;
      if (path && path.commands.length) {
        const svg = path
          .transform(
            scale,
            0,
            0,
            -scale,
            pen + pos.xOffset * scale,
            -pos.yOffset * scale,
          )
          .toSVG();
        d += svg;
      }
      pen += pos.xAdvance * scale;
    }
  }
  return { d, width: pen, missing };
};

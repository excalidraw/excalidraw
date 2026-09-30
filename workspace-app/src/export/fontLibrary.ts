import * as fontkit from "fontkit";

/**
 * Resolves characters to real font outlines using the same font files the editor
 * ships (registered in `Fonts.registered`), fetched lazily per unicode-range subset.
 */
export interface FaceSource {
  /** CSS unicode-range of the subset, e.g. "U+0000-00FF, U+0131" */
  unicodeRange: string;
  load: () => Promise<Uint8Array>;
}

export type FaceRegistry = Map<number, FaceSource[]>;

export type Font = fontkit.Font;

export interface ResolvedGlyphFont {
  font: Font;
}

const parseRanges = (range: string): Array<[number, number]> =>
  range
    .split(/,\s*/)
    .map((r) => r.trim().replace(/^U\+/i, ""))
    .filter(Boolean)
    .map((r) => {
      if (r.includes("?")) {
        return [
          parseInt(r.replace(/\?/g, "0"), 16),
          parseInt(r.replace(/\?/g, "F"), 16),
        ] as [number, number];
      }
      const [a, b] = r.split("-");
      const start = parseInt(a!, 16);
      return [start, b ? parseInt(b, 16) : start] as [number, number];
    });

const inRanges = (ranges: Array<[number, number]>, cp: number) =>
  ranges.some(([a, b]) => cp >= a && cp <= b);

export class FontLibrary {
  private fonts = new Map<FaceSource, Promise<Font | null>>();
  private ranges = new Map<FaceSource, Array<[number, number]>>();

  constructor(
    private registry: FaceRegistry,
    /** css family name -> registry id; generic/alias names are resolved by the caller */
    private idOf: (family: string) => number | undefined,
  ) {}

  private faceFont(face: FaceSource) {
    let p = this.fonts.get(face);
    if (!p) {
      p = face
        .load()
        .then((bytes) => {
          const f = fontkit.create(bytes as any);
          return "fonts" in f ? (f as any).fonts[0] : (f as Font);
        })
        .catch(() => null);
      this.fonts.set(face, p);
    }
    return p;
  }

  /** First font (in `families` priority order) that really has a glyph for the code point. */
  async fontFor(
    families: readonly string[],
    codePoint: number,
  ): Promise<Font | null> {
    for (const name of families) {
      const id = this.idOf(name);
      const faces = id === undefined ? undefined : this.registry.get(id);
      if (!faces) {
        continue;
      }
      for (const face of faces) {
        let r = this.ranges.get(face);
        if (!r) {
          r = parseRanges(face.unicodeRange || "U+0-10FFFF");
          this.ranges.set(face, r);
        }
        if (!inRanges(r, codePoint)) {
          continue;
        }
        const font = await this.faceFont(face);
        if (font && font.hasGlyphForCodePoint(codePoint)) {
          return font;
        }
      }
    }
    return null;
  }
}

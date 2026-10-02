import { Fonts, FONT_FAMILY } from "@excalidraw/excalidraw";
import { FONT_FAMILY_FALLBACKS } from "@excalidraw/common";

import { FontLibrary } from "./fontLibrary";

import type { FaceRegistry } from "./fontLibrary";

const idOf = (family: string): number | undefined =>
  (FONT_FAMILY as Record<string, number>)[family] ??
  (FONT_FAMILY_FALLBACKS as Record<string, number>)[family];

/** tries each url (own origin first, editor fallbacks after) like the editor itself does */
const fetchFirst = async (
  urls: ReadonlyArray<URL | string>,
): Promise<Uint8Array> => {
  let last: unknown = new Error("font has no url");
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (res.ok) {
        return new Uint8Array(await res.arrayBuffer());
      }
      last = new Error(`${res.status} ${res.statusText}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
};

let shared: FontLibrary | null = null;

/** One library per page load: font subsets are fetched once and reused across exports. */
export const getBrowserFontLibrary = () => {
  if (!shared) {
    const registry: FaceRegistry = new Map();
    for (const [id, { fontFaces }] of Fonts.registered.entries()) {
      registry.set(
        id,
        fontFaces
          .filter((f) => f.urls.length > 0)
          .map((f) => ({
            unicodeRange: f.fontFace.unicodeRange,
            load: () => fetchFirst(f.urls as Array<URL | string>),
          })),
      );
    }
    shared = new FontLibrary(registry, idOf);
  }
  return shared;
};

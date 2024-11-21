/**
 * DON'T depend on anything from the outside like `promiseTry`, as this module is part of a separate lazy-loaded chunk.
 *
 * Including anything from the main chunk would include the whole chunk by default.
 * Even it it would be tree-shaken during build, it won't be tree-shaken in dev.
 *
 * In the future consider separating common utils into a separate shared chunk.
 */

import loadWoff2 from "./woff2/woff2-loader";
import loadHbSubset from "./harfbuzz/harfbuzz-loader";

/**
 * Shared commands between the main thread and worker threads.
 */
export const Commands = {
  Subset: "SUBSET",
} as const;

/**
 * Used by browser (main thread), node and jsdom, to subset the font based on the passed codepoints.
 *
 * @returns woff2 font as a base64 encoded string
 */
export const subsetToBase64 = async (
  arrayBuffer: ArrayBuffer,
  codePoints: Array<number>,
): Promise<string> => {
  try {
    const buffer = await subsetToBinary(arrayBuffer, codePoints);
    return toBase64(buffer);
  } catch (e) {
    console.error("Skipped glyph subsetting", e);
    // Fallback to encoding whole font in case of errors
    return toBase64(arrayBuffer);
  }
};

/**
 * Used by browser (worker thread) and as part of `subsetToBase64`, to subset the font based on the passed codepoints.
 *
 * @eturns woff2 font as an ArrayBuffer, to avoid copying large strings between worker threads and the main thread.
 */
export const subsetToBinary = async (
  arrayBuffer: ArrayBuffer,
  codePoints: Array<number>,
): Promise<ArrayBuffer> => {
  // lazy loaded wasm modules to avoid multiple initializations in case of concurrent triggers
  // IMPORTANT: could be expensive, as each new worker instance lazy loads these to their own memory ~ keep the # of workes small!
  const { compress, decompress } = await loadWoff2();
  const { subset } = await loadHbSubset();

  const decompressedBinary = decompress(arrayBuffer).buffer;
  const snftSubset = subset(decompressedBinary, new Set(codePoints));
  const compressedBinary = compress(snftSubset.buffer);

  return compressedBinary.buffer;
};

/**
 * Util for isomoprhic browser (main thread), node and jsdom usage.
 *
 * Isn't used inside the worker to avoid copying large binary strings (as dataurl) between worker threads and the main thread.
 */
export const toBase64 = async (arrayBuffer: ArrayBuffer) => {
  let base64: string;

  if (typeof Buffer !== "undefined") {
    // node, jsdom
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else {
    // browser (main thread)
    // it's perfectly fine to treat each byte independently,
    // as we care only about turning individual bytes into codepoints,
    // not about multi-byte unicode characters
    const byteString = String.fromCharCode(...new Uint8Array(arrayBuffer));
    base64 = btoa(byteString);
  }

  return `data:font/woff2;base64,${base64}`;
};

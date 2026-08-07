import { readBlobBytes, sniffAnimatedImageType } from "../animated-image";

import { decodeApng } from "./apng";
import { decodeGif } from "./gif";
import { decodeAnimatedWebp } from "./webp";

import type { DecodedAnimatedImage } from "./types";

export * from "./types";
export * from "./player";
export { ANIMATION_FRAME_POOL_PIXELS } from "./frame-pool";

/**
 * One-shot decode of an animated image (GIF, APNG, animated WebP) into fully
 * composited RGBA frames. Every frame held in memory at native size. For
 * playback prefer `createAnimatedImagePlayer`, which decodes just-in-time.
 * Returns null when the image is not animated, the format can't be decoded
 * in this environment, or the frame count exceeds the decode limit.
 */
export const decodeAnimatedImage = async (
  file: Blob,
): Promise<DecodedAnimatedImage | null> => {
  try {
    const bytes = await readBlobBytes(file);
    const type = sniffAnimatedImageType(bytes);
    if (!type) {
      return null;
    }

    const decoded =
      type === "gif"
        ? decodeGif(bytes)
        : type === "apng"
        ? await decodeApng(bytes)
        : await decodeAnimatedWebp(bytes);

    if (decoded.frames.length < 2) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

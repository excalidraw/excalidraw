/**
 * Reads a slice of a Blob into a Uint8Array.
 */
const readBlobSlice = (
  blob: Blob,
  start: number,
  length: number,
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob.slice(start, start + length));
  });
};

/**
 * Checks if a blob is an animated image (GIF, APNG, or animated WebP).
 *
 * Only reads the first HEADER_SIZE bytes of the blob instead of loading the
 * entire file into memory.
 */
export async function isAnim(blob: Blob): Promise<boolean> {

  // Fast path
  if (
    blob.type === "image/jpeg" ||
    blob.type === "image/bmp" ||
    blob.type === "image/x-icon" ||
    blob.type === "image/avif" ||
    blob.type === "image/jfif"
  ) {
    return false;
  }

  // Read only the header portion of the blob — this is enough to check for
  // APNG's acTL chunk or animated WebP's ANIM chunk.
  const HEADER_SIZE = 16384;
  const sliceSize = Math.min(blob.size, HEADER_SIZE);
  if (sliceSize === 0) {
    return false;
  }
  const view = await readBlobSlice(blob, 0, sliceSize);

  return isGifAnim(view) || isApng(view) || isWebpAnim(view);
}

/**
 * Detect animated GIF by checking for GIF89a header and at least two
 * Image Descriptor blocks (0x2C).
 */
function isGifAnim(view: Uint8Array): boolean {
  if (view.length < 10) {
    return false;
  }

  // Must be GIF89a (animation requires 89a format)
  if (
    view[0] !== 0x47 || // G
    view[1] !== 0x49 || // I
    view[2] !== 0x46 || // F
    view[3] !== 0x38 ||
    view[4] !== 0x39 || // 9
    view[5] !== 0x61 // a
  ) {
    return false;
  }

  // Only scan the data we have for Image Descriptor markers (0x2C)
  let frameCount = 0;
  for (let i = 6; i < view.length - 1; i++) {
    if (view[i] === 0x2c) {
      frameCount++;
      if (frameCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect animated PNG (APNG) by checking for the `acTL` chunk after the PNG
 * signature but before the image data.
 */
function isApng(view: Uint8Array): boolean {
  if (view.length < 16) {
    return false;
  }

  // PNG signature
  if (
    view[0] !== 0x89 ||
    view[1] !== 0x50 || // P
    view[2] !== 0x4e || // N
    view[3] !== 0x47 || // G
    view[4] !== 0x0d ||
    view[5] !== 0x0a ||
    view[6] !== 0x1a ||
    view[7] !== 0x0a
  ) {
    return false;
  }

  // Look for the acTL chunk (animation control chunk)
  // Chunk type bytes: 0x61 ('a') 0x63 ('c') 0x54 ('T') 0x4C ('L')
  for (let i = 8; i <= view.length - 4; i++) {
    if (
      view[i] === 0x61 &&
      view[i + 1] === 0x63 &&
      view[i + 2] === 0x54 &&
      view[i + 3] === 0x4c
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Detect animated WebP by checking for the `ANIM` chunk inside the RIFF WebP
 * container.
 */
function isWebpAnim(view: Uint8Array): boolean {
  if (view.length < 12) {
    return false;
  }

  // RIFF header
  if (
    view[0] !== 0x52 || // R
    view[1] !== 0x49 || // I
    view[2] !== 0x46 || // F
    view[3] !== 0x46 // F
  ) {
    return false;
  }

  // WEBP identifier
  if (
    view[8] !== 0x57 || // W
    view[9] !== 0x45 || // E
    view[10] !== 0x42 || // B
    view[11] !== 0x50 // P
  ) {
    return false;
  }

  // Look for ANIM chunk (0x41 0x4E 0x49 0x4D)
  for (let i = 12; i <= view.length - 4; i++) {
    if (
      view[i] === 0x41 &&
      view[i + 1] === 0x4e &&
      view[i + 2] === 0x49 &&
      view[i + 3] === 0x4d
    ) {
      return true;
    }
  }

  return false;
}

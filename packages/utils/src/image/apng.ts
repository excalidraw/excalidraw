import { MAX_ANIMATION_FRAMES } from "./types";

import type { DecodedAnimatedImage, DecodedAnimatedImageFrame } from "./types";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const COLOR_TYPE_CHANNELS = [1, 0, 3, 1, 2, 0, 4] as const;

type PngChunk = { type: string; data: Uint8Array };

type FrameControl = {
  width: number;
  height: number;
  left: number;
  top: number;
  delay: number;
  disposeOp: number;
  blendOp: number;
};

const readChunks = (bytes: Uint8Array): PngChunk[] => {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Not a PNG");
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (offset + 12 + length > bytes.length) {
      throw new Error("Truncated PNG chunk");
    }
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    chunks.push({
      type,
      data: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset += 12 + length;
    if (type === "IEND") {
      break;
    }
  }
  return chunks;
};

const inflate = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
  const stream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const paethPredictor = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const unfilterScanlines = (
  raw: Uint8Array,
  height: number,
  bytesPerRow: number,
  bytesPerPixel: number,
): Uint8Array => {
  const pixels = new Uint8Array(height * bytesPerRow);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (bytesPerRow + 1)];
    const rowStart = y * bytesPerRow;
    const rawStart = y * (bytesPerRow + 1) + 1;
    const priorStart = (y - 1) * bytesPerRow;

    for (let x = 0; x < bytesPerRow; x++) {
      const value = raw[rawStart + x];
      const left =
        x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[priorStart + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? pixels[priorStart + x - bytesPerPixel]
          : 0;

      switch (filter) {
        case 0:
          pixels[rowStart + x] = value;
          break;
        case 1:
          pixels[rowStart + x] = value + left;
          break;
        case 2:
          pixels[rowStart + x] = value + up;
          break;
        case 3:
          pixels[rowStart + x] = value + ((left + up) >> 1);
          break;
        case 4:
          pixels[rowStart + x] = value + paethPredictor(left, up, upLeft);
          break;
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }
    }
  }
  return pixels;
};

const toRgba = (
  pixels: Uint8Array,
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): Uint8ClampedArray => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const pixelCount = width * height;

  if (colorType === 3) {
    if (!palette) {
      throw new Error("Palette PNG is missing PLTE");
    }
    const mask = (1 << bitDepth) - 1;
    const indexesPerByte = 8 / bitDepth;
    for (let i = 0; i < pixelCount; i++) {
      const byte = pixels[Math.floor(i / indexesPerByte)];
      const shift = 8 - bitDepth * ((i % indexesPerByte) + 1);
      const colorIndex = (byte >> shift) & mask;
      rgba[i * 4] = palette[colorIndex * 3];
      rgba[i * 4 + 1] = palette[colorIndex * 3 + 1];
      rgba[i * 4 + 2] = palette[colorIndex * 3 + 2];
      rgba[i * 4 + 3] = transparency?.[colorIndex] ?? 255;
    }
    return rgba;
  }

  const channels = COLOR_TYPE_CHANNELS[colorType];
  if (!channels) {
    throw new Error(`Unsupported PNG color type ${colorType}`);
  }
  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  }

  const stride = channels * (bitDepth / 8);
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * stride;
    const read = (channel: number) =>
      bitDepth === 8 ? pixels[offset + channel] : pixels[offset + channel * 2];

    if (colorType === 0) {
      const gray = read(0);
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] =
        bitDepth === 8 && transparency && gray === transparency[1] ? 0 : 255;
    } else if (colorType === 2) {
      const red = read(0);
      const green = read(1);
      const blue = read(2);
      rgba[i * 4] = red;
      rgba[i * 4 + 1] = green;
      rgba[i * 4 + 2] = blue;
      rgba[i * 4 + 3] =
        bitDepth === 8 &&
        transparency &&
        red === transparency[1] &&
        green === transparency[3] &&
        blue === transparency[5]
          ? 0
          : 255;
    } else if (colorType === 4) {
      const gray = read(0);
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = read(1);
    } else {
      rgba[i * 4] = read(0);
      rgba[i * 4 + 1] = read(1);
      rgba[i * 4 + 2] = read(2);
      rgba[i * 4 + 3] = read(3);
    }
  }
  return rgba;
};

const parseFrameControl = (data: Uint8Array): FrameControl => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const delayNumerator = view.getUint16(20);
  const delayDenominator = view.getUint16(22) || 100;
  const delay = (delayNumerator / delayDenominator) * 1000;

  return {
    width: view.getUint32(4),
    height: view.getUint32(8),
    left: view.getUint32(12),
    top: view.getUint32(16),
    delay: delay > 0 ? delay : 100,
    disposeOp: data[24],
    blendOp: data[25],
  };
};

const blendOver = (
  canvas: Uint8ClampedArray,
  index: number,
  r: number,
  g: number,
  b: number,
  a: number,
) => {
  const sourceAlpha = a / 255;
  const targetAlpha = canvas[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outAlpha === 0) {
    canvas.fill(0, index, index + 4);
    return;
  }

  canvas[index] =
    (r * sourceAlpha + canvas[index] * targetAlpha * (1 - sourceAlpha)) /
    outAlpha;
  canvas[index + 1] =
    (g * sourceAlpha + canvas[index + 1] * targetAlpha * (1 - sourceAlpha)) /
    outAlpha;
  canvas[index + 2] =
    (b * sourceAlpha + canvas[index + 2] * targetAlpha * (1 - sourceAlpha)) /
    outAlpha;
  canvas[index + 3] = outAlpha * 255;
};

/**
 * Sequential just-in-time APNG decoder. Chunk structure and frame delays are
 * parsed up front; pixel inflation happens one frame at a time in
 * `decodeNext()`, which wraps around after the last frame.
 */
export class ApngDecoder {
  readonly width: number;
  readonly height: number;
  readonly loopCount: number;
  /** per-frame display delay in ms */
  readonly delays: number[];
  /** the running composite — valid for the last index decodeNext() returned */
  readonly composite: Uint8ClampedArray<ArrayBuffer>;
  /** index decodeNext() will produce next */
  nextFrameIndex = 0;

  private frameParts: { control: FrameControl; dataParts: Uint8Array[] }[];
  private palette: Uint8Array | null;
  private transparency: Uint8Array | null;
  private bitDepth: number;
  private colorType: number;
  private pendingDisposal:
    | null
    | { type: "background"; control: FrameControl }
    | { type: "restore"; snapshot: Uint8ClampedArray } = null;

  constructor(bytes: Uint8Array) {
    const chunks = readChunks(bytes);

    const ihdr = chunks[0];
    if (ihdr?.type !== "IHDR") {
      throw new Error("PNG is missing IHDR");
    }
    const ihdrView = new DataView(
      ihdr.data.buffer,
      ihdr.data.byteOffset,
      ihdr.data.byteLength,
    );
    this.width = ihdrView.getUint32(0);
    this.height = ihdrView.getUint32(4);
    this.bitDepth = ihdr.data[8];
    this.colorType = ihdr.data[9];
    if (ihdr.data[12] !== 0) {
      throw new Error("Interlaced APNG is not supported");
    }

    const animationControl = chunks.find((chunk) => chunk.type === "acTL");
    if (!animationControl) {
      throw new Error("Not an APNG");
    }
    const animationView = new DataView(
      animationControl.data.buffer,
      animationControl.data.byteOffset,
      animationControl.data.byteLength,
    );
    this.loopCount = animationView.getUint32(4);

    this.palette = chunks.find((chunk) => chunk.type === "PLTE")?.data ?? null;
    this.transparency =
      chunks.find((chunk) => chunk.type === "tRNS")?.data ?? null;

    // the default image (IDAT chunks) is an animation frame only when the
    // first fcTL chunk precedes it
    const frameParts: { control: FrameControl; dataParts: Uint8Array[] }[] = [];
    let seenImageData = false;
    for (const chunk of chunks) {
      if (chunk.type === "fcTL") {
        frameParts.push({
          control: parseFrameControl(chunk.data),
          dataParts: [],
        });
      } else if (chunk.type === "IDAT") {
        seenImageData = true;
        if (frameParts.length === 1) {
          frameParts[0].dataParts.push(chunk.data);
        }
      } else if (chunk.type === "fdAT") {
        frameParts[frameParts.length - 1]?.dataParts.push(
          chunk.data.subarray(4),
        );
      }
    }
    if (!seenImageData || frameParts.length === 0) {
      throw new Error("APNG has no frames");
    }
    if (frameParts.length > MAX_ANIMATION_FRAMES) {
      throw new Error(
        `Animated image exceeds the ${MAX_ANIMATION_FRAMES} frame limit`,
      );
    }

    this.frameParts = frameParts;
    this.delays = frameParts.map(({ control }) => control.delay);
    this.composite = new Uint8ClampedArray(this.width * this.height * 4);
  }

  /** the previous frame's disposal only takes effect once the next frame is
   * about to be drawn */
  private applyPendingDisposal() {
    const pending = this.pendingDisposal;
    this.pendingDisposal = null;
    if (!pending) {
      return;
    }
    if (pending.type === "restore") {
      this.composite.set(pending.snapshot);
      return;
    }
    const { control } = pending;
    for (let y = 0; y < control.height && control.top + y < this.height; y++) {
      const rowStart = ((control.top + y) * this.width + control.left) * 4;
      this.composite.fill(
        0,
        rowStart,
        rowStart + Math.min(control.width, this.width - control.left) * 4,
      );
    }
  }

  /** decodes the next frame into `composite`; wraps around after the last
   * frame. Returns the decoded frame's index and delay. */
  async decodeNext(): Promise<{ index: number; delay: number }> {
    if (this.nextFrameIndex >= this.frameParts.length) {
      this.composite.fill(0);
      this.pendingDisposal = null;
      this.nextFrameIndex = 0;
    }

    this.applyPendingDisposal();

    const { width, height, composite } = this;
    const { control, dataParts } = this.frameParts[this.nextFrameIndex];

    const zippedLength = dataParts.reduce((sum, part) => sum + part.length, 0);
    const zipped = new Uint8Array(zippedLength);
    let offset = 0;
    for (const part of dataParts) {
      zipped.set(part, offset);
      offset += part.length;
    }

    const channels = COLOR_TYPE_CHANNELS[this.colorType];
    const bytesPerPixel = Math.max(
      1,
      Math.ceil((channels * this.bitDepth) / 8),
    );
    const bytesPerRow = Math.ceil(
      (control.width * channels * this.bitDepth) / 8,
    );
    const raw = await inflate(zipped);
    if (raw.length < control.height * (bytesPerRow + 1)) {
      throw new Error("Truncated APNG frame data");
    }
    const scanlines = unfilterScanlines(
      raw,
      control.height,
      bytesPerRow,
      bytesPerPixel,
    );
    const frameRgba = toRgba(
      scanlines,
      control.width,
      control.height,
      this.bitDepth,
      this.colorType,
      this.palette,
      this.transparency,
    );

    // dispose op 2 restores the composite to its state before this frame
    const restorePoint = control.disposeOp === 2 ? composite.slice() : null;

    for (let y = 0; y < control.height && control.top + y < height; y++) {
      for (let x = 0; x < control.width && control.left + x < width; x++) {
        const frameIndex = (y * control.width + x) * 4;
        const canvasIndex = ((control.top + y) * width + control.left + x) * 4;
        if (control.blendOp === 0) {
          composite[canvasIndex] = frameRgba[frameIndex];
          composite[canvasIndex + 1] = frameRgba[frameIndex + 1];
          composite[canvasIndex + 2] = frameRgba[frameIndex + 2];
          composite[canvasIndex + 3] = frameRgba[frameIndex + 3];
        } else {
          blendOver(
            composite,
            canvasIndex,
            frameRgba[frameIndex],
            frameRgba[frameIndex + 1],
            frameRgba[frameIndex + 2],
            frameRgba[frameIndex + 3],
          );
        }
      }
    }

    if (restorePoint) {
      this.pendingDisposal = { type: "restore", snapshot: restorePoint };
    } else if (control.disposeOp === 1) {
      this.pendingDisposal = { type: "background", control };
    }

    return { index: this.nextFrameIndex++, delay: control.delay };
  }
}

/** one-shot decode of every frame. Used by tests and consumers that want
 * the full animation in memory; playback uses ApngDecoder incrementally */
export const decodeApng = async (
  bytes: Uint8Array,
): Promise<DecodedAnimatedImage> => {
  const decoder = new ApngDecoder(bytes);

  const frames: DecodedAnimatedImageFrame[] = [];
  for (let i = 0; i < decoder.delays.length; i++) {
    const { delay } = await decoder.decodeNext();
    frames.push({ data: decoder.composite.slice(), delay });
  }

  return {
    width: decoder.width,
    height: decoder.height,
    frames,
    loopCount: decoder.loopCount,
  };
};

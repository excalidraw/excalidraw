import { MAX_ANIMATION_FRAMES } from "./types";

import type { DecodedAnimatedImage, DecodedAnimatedImageFrame } from "./types";

const BLOCK_TYPE = {
  extension: 0x21,
  imageDescriptor: 0x2c,
  trailer: 0x3b,
} as const;

const EXTENSION_LABEL = {
  graphicControl: 0xf9,
  application: 0xff,
} as const;

class ByteReader {
  private view: DataView;
  offset = 0;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining() {
    return this.view.byteLength - this.offset;
  }

  byte(): number {
    if (this.remaining < 1) {
      throw new Error("Unexpected end of data");
    }
    return this.view.getUint8(this.offset++);
  }

  unsignedShort(): number {
    if (this.remaining < 2) {
      throw new Error("Unexpected end of data");
    }
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  bytes(length: number): Uint8Array {
    if (this.remaining < length) {
      throw new Error("Unexpected end of data");
    }
    const value = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.offset,
      length,
    );
    this.offset += length;
    return value;
  }

  ascii(length: number): string {
    let value = "";
    for (const byte of this.bytes(length)) {
      value += String.fromCharCode(byte);
    }
    return value;
  }

  colorTable(size: number): Uint8Array {
    return this.bytes(size * 3);
  }

  subBlocks(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let length = this.byte();
    while (length !== 0) {
      chunks.push(this.bytes(length));
      size += length;
      length = this.byte();
    }
    const value = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      value.set(chunk, offset);
      offset += chunk.length;
    }
    return value;
  }

  skipSubBlocks(): void {
    let length = this.byte();
    while (length !== 0) {
      this.bytes(length);
      length = this.byte();
    }
  }
}

const MAX_LZW_TABLE_SIZE = 4096;

export const lzwDecode = (
  minCodeSize: number,
  data: Uint8Array,
  pixelCount: number,
): Uint8Array => {
  const pixels = new Uint8Array(pixelCount);
  const prefix = new Uint16Array(MAX_LZW_TABLE_SIZE);
  const suffix = new Uint8Array(MAX_LZW_TABLE_SIZE);
  const pixelStack = new Uint8Array(MAX_LZW_TABLE_SIZE + 1);

  const clearCode = 1 << minCodeSize;
  const endOfInformationCode = clearCode + 1;
  let available = clearCode + 2;
  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let previousCode = -1;

  for (let code = 0; code < clearCode; code++) {
    suffix[code] = code;
  }

  let datum = 0;
  let bits = 0;
  let first = 0;
  let stackTop = 0;
  let dataOffset = 0;
  let pixelIndex = 0;

  while (pixelIndex < pixelCount) {
    if (stackTop === 0) {
      if (bits < codeSize) {
        if (dataOffset >= data.length) {
          break;
        }
        datum += data[dataOffset++] << bits;
        bits += 8;
        continue;
      }

      let code = datum & codeMask;
      datum >>= codeSize;
      bits -= codeSize;

      if (code > available || code === endOfInformationCode) {
        break;
      }
      if (code === clearCode) {
        codeSize = minCodeSize + 1;
        codeMask = (1 << codeSize) - 1;
        available = clearCode + 2;
        previousCode = -1;
        continue;
      }
      if (previousCode === -1) {
        pixelStack[stackTop++] = suffix[code];
        previousCode = code;
        first = code;
        continue;
      }

      const inCode = code;
      if (code === available) {
        pixelStack[stackTop++] = first;
        code = previousCode;
      }
      while (code > clearCode) {
        pixelStack[stackTop++] = suffix[code];
        code = prefix[code];
      }
      first = suffix[code];
      pixelStack[stackTop++] = first;

      // deferred clear: once the table is full, keep decoding with it until
      // the encoder emits a clear code
      if (available < MAX_LZW_TABLE_SIZE) {
        prefix[available] = previousCode;
        suffix[available] = first;
        available++;
        if ((available & codeMask) === 0 && available < MAX_LZW_TABLE_SIZE) {
          codeSize++;
          codeMask += available;
        }
      }
      previousCode = inCode;
    }

    pixels[pixelIndex++] = pixelStack[--stackTop];
  }

  return pixels;
};

/** interlaced GIFs store rows in 4 passes of the logical screen */
const deinterlace = (
  colorIndexes: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const result = new Uint8Array(colorIndexes.length);
  const passOffsets = [0, 4, 2, 1];
  const passSteps = [8, 8, 4, 2];

  let sourceRow = 0;
  for (let pass = 0; pass < 4; pass++) {
    for (let row = passOffsets[pass]; row < height; row += passSteps[pass]) {
      result.set(
        colorIndexes.subarray(sourceRow * width, (sourceRow + 1) * width),
        row * width,
      );
      sourceRow++;
    }
  }
  return result;
};

export type GifMetadata = {
  width: number;
  height: number;
  loopCount: number;
  // per-frame display delay in ms
  delays: number[];
};

/**
 * Structural pass over the GIF block stream without LZW decompression —
 * collects dimensions, frame delays and the loop count before any pixel work
 * happens
 */
export const parseGifMetadata = (bytes: Uint8Array): GifMetadata => {
  const reader = new ByteReader(bytes);

  if (reader.ascii(3) !== "GIF") {
    throw new Error("Not a GIF");
  }
  const version = reader.ascii(3);
  if (version !== "89a" && version !== "87a") {
    throw new Error(`Unsupported GIF version ${version}`);
  }

  const width = reader.unsignedShort();
  const height = reader.unsignedShort();
  const screenPacked = reader.byte();
  reader.byte(); // background color index
  reader.byte(); // pixel aspect ratio
  if (screenPacked & 0x80) {
    reader.colorTable(2 ** ((screenPacked & 0x07) + 1));
  }

  let loopCount = 0;
  let delay = 100;
  const delays: number[] = [];

  while (reader.remaining > 0) {
    const blockType = reader.byte();
    if (blockType === BLOCK_TYPE.trailer) {
      break;
    }
    if (blockType === BLOCK_TYPE.extension) {
      const label = reader.byte();
      const data = reader.subBlocks();
      if (label === EXTENSION_LABEL.graphicControl && data.length >= 4) {
        const delayCentiseconds = data[1] | (data[2] << 8);
        // browsers fall back to 100ms when the delay is 0 or 1 centiseconds
        delay = delayCentiseconds <= 1 ? 100 : delayCentiseconds * 10;
      } else if (label === EXTENSION_LABEL.application && data.length >= 14) {
        // sub-blocks concatenate the 11-byte application id with its payload
        const applicationId = String.fromCharCode(...data.subarray(0, 11));
        if (
          (applicationId === "NETSCAPE2.0" ||
            applicationId === "ANIMEXTS1.0") &&
          data[11] === 1
        ) {
          loopCount = data[12] | (data[13] << 8);
        }
      }
      continue;
    }
    if (blockType !== BLOCK_TYPE.imageDescriptor) {
      throw new Error(`Unknown GIF block 0x${blockType.toString(16)}`);
    }
    reader.bytes(8); // left, top, width, height
    const framePacked = reader.byte();
    if (framePacked & 0x80) {
      reader.colorTable(2 ** ((framePacked & 0x07) + 1));
    }
    reader.byte(); // LZW minimum code size
    reader.skipSubBlocks();
    delays.push(delay);
    delay = 100;
    if (delays.length > MAX_ANIMATION_FRAMES) {
      throw new Error(
        `Animated image exceeds the ${MAX_ANIMATION_FRAMES} frame limit`,
      );
    }
  }

  return { width, height, loopCount, delays };
};

type PendingDisposal =
  | null
  | {
      type: "background";
      left: number;
      top: number;
      width: number;
      height: number;
    }
  | { type: "restore"; snapshot: Uint8ClampedArray };

/**
 * Sequential just-in-time GIF decoder. Holds the compressed bytes and a
 * single running composite; `decodeNext()` advances one frame and wraps
 * around at the end of the stream, so playback never needs every frame
 * decoded at once.
 */
export class GifDecoder {
  readonly width: number;
  readonly height: number;
  // the running composite — valid for the last index decodeNext() returned
  readonly composite: Uint8ClampedArray<ArrayBuffer>;
  // index decodeNext() will produce next
  nextFrameIndex = 0;

  private reader: ByteReader;
  private contentOffset: number;
  private globalColorTable: Uint8Array | null;
  private pendingDisposal: PendingDisposal = null;
  private delay = 100;
  private disposal = 0;
  private transparentIndex = -1;

  constructor(bytes: Uint8Array) {
    const reader = new ByteReader(bytes);

    if (reader.ascii(3) !== "GIF") {
      throw new Error("Not a GIF");
    }
    const version = reader.ascii(3);
    if (version !== "89a" && version !== "87a") {
      throw new Error(`Unsupported GIF version ${version}`);
    }

    this.width = reader.unsignedShort();
    this.height = reader.unsignedShort();
    const screenPacked = reader.byte();
    reader.byte(); // background color index, we composite over transparency
    reader.byte(); // pixel aspect ratio
    this.globalColorTable =
      screenPacked & 0x80
        ? reader.colorTable(2 ** ((screenPacked & 0x07) + 1))
        : null;

    this.reader = reader;
    this.contentOffset = reader.offset;
    this.composite = new Uint8ClampedArray(this.width * this.height * 4);
  }

  private rewind() {
    this.reader.offset = this.contentOffset;
    this.composite.fill(0);
    this.pendingDisposal = null;
    this.nextFrameIndex = 0;
    this.resetGraphicControl();
  }

  private resetGraphicControl() {
    this.delay = 100;
    this.disposal = 0;
    this.transparentIndex = -1;
  }

  /**
   * The previous frame's disposal only takes effect once the next frame is
   * about to be drawn, so the composite keeps showing the frame in between
   */
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
    for (let y = 0; y < pending.height && pending.top + y < this.height; y++) {
      const rowStart = ((pending.top + y) * this.width + pending.left) * 4;
      this.composite.fill(
        0,
        rowStart,
        rowStart + Math.min(pending.width, this.width - pending.left) * 4,
      );
    }
  }

  /**
   * Decodes the next frame into `composite`; wraps around after the last
   * frame. Returns the decoded frame's index and delay.
   * */
  decodeNext(): { index: number; delay: number } {
    this.applyPendingDisposal();

    while (true) {
      if (this.reader.remaining <= 0) {
        // Malformed stream without a trailer.
        if (this.nextFrameIndex === 0) {
          throw new Error("GIF has no frames");
        }
        this.rewind();
        continue;
      }

      const blockType = this.reader.byte();

      if (blockType === BLOCK_TYPE.trailer) {
        if (this.nextFrameIndex === 0) {
          throw new Error("GIF has no frames");
        }
        this.rewind();
        continue;
      }

      if (blockType === BLOCK_TYPE.extension) {
        const label = this.reader.byte();
        if (label === EXTENSION_LABEL.graphicControl) {
          const data = this.reader.subBlocks();
          if (data.length >= 4) {
            const packed = data[0];
            const delayCentiseconds = data[1] | (data[2] << 8);
            this.disposal = (packed >> 2) & 0x07;
            this.transparentIndex = packed & 0x01 ? data[3] : -1;
            // browsers fall back to 100ms for delays of 0 or 1 centiseconds
            this.delay = delayCentiseconds <= 1 ? 100 : delayCentiseconds * 10;
          }
        } else {
          this.reader.skipSubBlocks();
        }
        continue;
      }

      if (blockType !== BLOCK_TYPE.imageDescriptor) {
        throw new Error(`Unknown GIF block 0x${blockType.toString(16)}`);
      }

      return this.decodeFrame();
    }
  }

  private decodeFrame(): { index: number; delay: number } {
    const reader = this.reader;
    const { width, height, composite } = this;

    const frameLeft = reader.unsignedShort();
    const frameTop = reader.unsignedShort();
    const frameWidth = reader.unsignedShort();
    const frameHeight = reader.unsignedShort();
    const framePacked = reader.byte();
    const interlaced = (framePacked & 0x40) !== 0;
    const colorTable =
      framePacked & 0x80
        ? reader.colorTable(2 ** ((framePacked & 0x07) + 1))
        : this.globalColorTable;
    if (!colorTable) {
      throw new Error("GIF frame has no color table");
    }

    const lzwMinCodeSize = reader.byte();
    const compressed = reader.subBlocks();
    let colorIndexes = lzwDecode(
      lzwMinCodeSize,
      compressed,
      frameWidth * frameHeight,
    );
    if (interlaced) {
      colorIndexes = deinterlace(colorIndexes, frameWidth, frameHeight);
    }

    const frameDelay = this.delay;
    const frameDisposal = this.disposal;
    const frameTransparentIndex = this.transparentIndex;
    this.resetGraphicControl();

    // disposal 3 restores the composite to its state before this frame
    const restorePoint = frameDisposal === 3 ? composite.slice() : null;

    for (let y = 0; y < frameHeight && frameTop + y < height; y++) {
      const canvasRow = ((frameTop + y) * width + frameLeft) * 4;
      const frameRow = y * frameWidth;
      for (let x = 0; x < frameWidth && frameLeft + x < width; x++) {
        const colorIndex = colorIndexes[frameRow + x];
        if (colorIndex === frameTransparentIndex) {
          continue;
        }
        const index = canvasRow + x * 4;
        composite[index] = colorTable[colorIndex * 3];
        composite[index + 1] = colorTable[colorIndex * 3 + 1];
        composite[index + 2] = colorTable[colorIndex * 3 + 2];
        composite[index + 3] = 255;
      }
    }

    if (restorePoint) {
      this.pendingDisposal = { type: "restore", snapshot: restorePoint };
    } else if (frameDisposal === 2) {
      this.pendingDisposal = {
        type: "background",
        left: frameLeft,
        top: frameTop,
        width: frameWidth,
        height: frameHeight,
      };
    }

    return { index: this.nextFrameIndex++, delay: frameDelay };
  }
}

/** one-shot decode of every frame — used by tests and consumers that want
 * the full animation in memory; playback uses GifDecoder incrementally */
export const decodeGif = (bytes: Uint8Array): DecodedAnimatedImage => {
  const metadata = parseGifMetadata(bytes);
  const decoder = new GifDecoder(bytes);

  const frames: DecodedAnimatedImageFrame[] = metadata.delays.map(() => {
    const { delay } = decoder.decodeNext();
    return { data: decoder.composite.slice(), delay };
  });

  return {
    width: decoder.width,
    height: decoder.height,
    frames,
    loopCount: metadata.loopCount,
  };
};

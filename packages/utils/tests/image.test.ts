import fs from "fs";
import path from "path";
import { crc32, deflateSync } from "zlib";

import { isAnimatedImage } from "@excalidraw/utils";

import { FramePool } from "../src/image/frame-pool";
import { decodeAnimatedImage, MAX_ANIMATION_FRAMES } from "../src/image";
import { decodeGif, parseGifMetadata } from "../src/image/gif";

import type { FramePoolMember, FramePoolOwner } from "../src/image/frame-pool";

// -----------------------------------------------------------------------------
// GIF builder: writes spec-valid GIF89a streams with literal-only LZW data,
// giving tests full control over delays, disposal, transparency and offsets
// -----------------------------------------------------------------------------

const packLzwLiterals = (minCodeSize: number, indexes: number[]): number[] => {
  const clearCode = 1 << minCodeSize;
  const endOfInformationCode = clearCode + 1;
  let available = clearCode + 2;
  let codeSize = minCodeSize + 1;

  const codes: number[] = [clearCode];
  const sizes: number[] = [codeSize];
  let first = true;
  for (const index of indexes) {
    codes.push(index);
    sizes.push(codeSize);
    if (!first) {
      available++;
      if ((available & ((1 << codeSize) - 1)) === 0 && available < 4096) {
        codeSize++;
      }
    }
    first = false;
  }
  codes.push(endOfInformationCode);
  sizes.push(codeSize);

  const bytes: number[] = [];
  let datum = 0;
  let bits = 0;
  for (let i = 0; i < codes.length; i++) {
    datum |= codes[i] << bits;
    bits += sizes[i];
    while (bits >= 8) {
      bytes.push(datum & 0xff);
      datum >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) {
    bytes.push(datum & 0xff);
  }
  return bytes;
};

type TestGifFrame = {
  indexes: number[];
  width: number;
  height: number;
  left?: number;
  top?: number;
  delayCentiseconds?: number;
  disposal?: number;
  transparentIndex?: number | null;
  interlaced?: boolean;
};

const buildGif = (opts: {
  width: number;
  height: number;
  palette: number[][];
  loopCount?: number;
  frames: TestGifFrame[];
}): Uint8Array<ArrayBuffer> => {
  const bytes: number[] = [];
  const push = (...values: number[]) => bytes.push(...values);
  const pushShort = (value: number) => push(value & 0xff, (value >> 8) & 0xff);
  const pushString = (value: string) =>
    push(...[...value].map((char) => char.charCodeAt(0)));

  const paletteSize = 2 ** Math.ceil(Math.log2(opts.palette.length));
  const palette = [...opts.palette];
  while (palette.length < paletteSize) {
    palette.push([0, 0, 0]);
  }

  pushString("GIF89a");
  pushShort(opts.width);
  pushShort(opts.height);
  push(0x80 | (Math.log2(paletteSize) - 1));
  push(0, 0);
  for (const [r, g, b] of palette) {
    push(r, g, b);
  }

  if (opts.loopCount !== undefined) {
    push(0x21, 0xff, 0x0b);
    pushString("NETSCAPE2.0");
    push(3, 1);
    pushShort(opts.loopCount);
    push(0);
  }

  for (const frame of opts.frames) {
    push(0x21, 0xf9, 4);
    push(
      ((frame.disposal ?? 0) << 2) | (frame.transparentIndex != null ? 1 : 0),
    );
    pushShort(frame.delayCentiseconds ?? 10);
    push(frame.transparentIndex ?? 0);
    push(0);

    push(0x2c);
    pushShort(frame.left ?? 0);
    pushShort(frame.top ?? 0);
    pushShort(frame.width);
    pushShort(frame.height);
    push(frame.interlaced ? 0x40 : 0);

    const minCodeSize = Math.max(2, Math.log2(paletteSize));
    const data = packLzwLiterals(minCodeSize, frame.indexes);
    push(minCodeSize, data.length, ...data, 0);
  }

  push(0x3b);
  return new Uint8Array(bytes);
};

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const PALETTE = [RED, GREEN, BLUE, [0, 0, 0]];

const pixelAt = (
  frame: { data: Uint8ClampedArray },
  index: number,
): number[] => [
  frame.data[index * 4],
  frame.data[index * 4 + 1],
  frame.data[index * 4 + 2],
  frame.data[index * 4 + 3],
];

describe("decodeGif", () => {
  it("decodes frames with delays and dimensions", () => {
    const gif = buildGif({
      width: 2,
      height: 2,
      palette: PALETTE,
      frames: [
        { indexes: [0, 0, 0, 0], width: 2, height: 2, delayCentiseconds: 10 },
        { indexes: [1, 1, 1, 1], width: 2, height: 2, delayCentiseconds: 5 },
      ],
    });

    const decoded = decodeGif(gif);

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.loopCount).toBe(0);
    expect(decoded.frames).toHaveLength(2);
    expect(decoded.frames[0].delay).toBe(100);
    expect(decoded.frames[1].delay).toBe(50);
    expect(pixelAt(decoded.frames[0], 0)).toEqual([...RED, 255]);
    expect(pixelAt(decoded.frames[1], 0)).toEqual([...GREEN, 255]);
  });

  it("falls back to 100ms for delays of 0 or 1 centiseconds", () => {
    const gif = buildGif({
      width: 1,
      height: 1,
      palette: PALETTE,
      frames: [
        { indexes: [0], width: 1, height: 1, delayCentiseconds: 0 },
        { indexes: [1], width: 1, height: 1, delayCentiseconds: 1 },
      ],
    });

    const decoded = decodeGif(gif);

    expect(decoded.frames[0].delay).toBe(100);
    expect(decoded.frames[1].delay).toBe(100);
  });

  it("reads the NETSCAPE loop count", () => {
    const gif = buildGif({
      width: 1,
      height: 1,
      palette: PALETTE,
      loopCount: 3,
      frames: [
        { indexes: [0], width: 1, height: 1 },
        { indexes: [1], width: 1, height: 1 },
      ],
    });

    expect(decodeGif(gif).loopCount).toBe(3);
  });

  it("keeps transparent pixels from the previous frame", () => {
    const gif = buildGif({
      width: 2,
      height: 2,
      palette: PALETTE,
      frames: [
        { indexes: [0, 0, 0, 0], width: 2, height: 2 },
        {
          indexes: [1, 0, 0, 1],
          width: 2,
          height: 2,
          transparentIndex: 1,
        },
      ],
    });

    const decoded = decodeGif(gif);

    // green pixels were marked transparent, so red shows through everywhere
    expect(pixelAt(decoded.frames[1], 0)).toEqual([...RED, 255]);
    expect(pixelAt(decoded.frames[1], 1)).toEqual([...RED, 255]);
  });

  it("clears the frame rect after disposal 2", () => {
    const gif = buildGif({
      width: 2,
      height: 1,
      palette: PALETTE,
      frames: [
        { indexes: [0, 0], width: 2, height: 1 },
        { indexes: [1, 1], width: 2, height: 1, disposal: 2 },
        { indexes: [2, 2], width: 2, height: 1 },
      ],
    });

    const decoded = decodeGif(gif);

    expect(pixelAt(decoded.frames[1], 0)).toEqual([...GREEN, 255]);
    // the green frame was cleared before the blue frame was drawn; blue at
    // index 2 is transparent in the palette sense here, so only drawn pixels
    // are blue and nothing red survives
    expect(pixelAt(decoded.frames[2], 0)).toEqual([...BLUE, 255]);
  });

  it("clears pixels drawn over by a later transparent frame after disposal 2", () => {
    const gif = buildGif({
      width: 2,
      height: 1,
      palette: PALETTE,
      frames: [
        { indexes: [0, 0], width: 2, height: 1 },
        { indexes: [1, 1], width: 2, height: 1, disposal: 2 },
        {
          indexes: [2, 0],
          width: 2,
          height: 1,
          transparentIndex: 0,
        },
      ],
    });

    const decoded = decodeGif(gif);

    expect(pixelAt(decoded.frames[2], 0)).toEqual([...BLUE, 255]);
    // green was cleared by disposal 2 and red is transparent in this frame
    expect(pixelAt(decoded.frames[2], 1)).toEqual([0, 0, 0, 0]);
  });

  it("restores the pre-frame canvas state after disposal 3", () => {
    const gif = buildGif({
      width: 2,
      height: 1,
      palette: PALETTE,
      frames: [
        { indexes: [0, 0], width: 2, height: 1 },
        { indexes: [1, 1], width: 2, height: 1, disposal: 3 },
        { indexes: [2, 1], width: 2, height: 1, transparentIndex: 1 },
      ],
    });

    const decoded = decodeGif(gif);

    // second pixel is red again (restored), not green
    expect(pixelAt(decoded.frames[2], 0)).toEqual([...BLUE, 255]);
    expect(pixelAt(decoded.frames[2], 1)).toEqual([...RED, 255]);
  });

  it("draws partial frames at their offset", () => {
    const gif = buildGif({
      width: 3,
      height: 3,
      palette: PALETTE,
      frames: [
        { indexes: new Array(9).fill(0), width: 3, height: 3 },
        { indexes: [1], width: 1, height: 1, left: 2, top: 1 },
      ],
    });

    const decoded = decodeGif(gif);

    expect(pixelAt(decoded.frames[1], 1 * 3 + 2)).toEqual([...GREEN, 255]);
    expect(pixelAt(decoded.frames[1], 0)).toEqual([...RED, 255]);
  });

  it("reorders interlaced rows", () => {
    // interlace pass order for 8 rows: 0, 4, 2, 6, 1, 3, 5, 7
    const rowOrder = [0, 4, 2, 6, 1, 3, 5, 7];
    const gif = buildGif({
      width: 1,
      height: 8,
      palette: [
        [0, 0, 0],
        [10, 0, 0],
        [20, 0, 0],
        [30, 0, 0],
        [40, 0, 0],
        [50, 0, 0],
        [60, 0, 0],
        [70, 0, 0],
        [80, 0, 0],
        [90, 0, 0],
        [100, 0, 0],
        [110, 0, 0],
        [120, 0, 0],
        [30, 0, 0],
        [90, 0, 0],
        [200, 0, 0],
      ],
      frames: [
        { indexes: new Array(8).fill(0), width: 1, height: 8 },
        {
          indexes: rowOrder.map((row) => row + 1),
          width: 1,
          height: 8,
          interlaced: true,
        },
      ],
    });

    const decoded = decodeGif(gif);
    const frame = decoded.frames[1];

    for (let row = 0; row < 8; row++) {
      expect(frame.data[row * 4]).toBe((row + 1) * 10);
    }
  });

  it("rejects animations above the frame count limit", () => {
    const gif = buildGif({
      width: 1,
      height: 1,
      palette: PALETTE,
      frames: new Array(MAX_ANIMATION_FRAMES + 1).fill({
        indexes: [0],
        width: 1,
        height: 1,
      }),
    });

    expect(() => decodeGif(gif)).toThrow(/frame limit/);
  });

  it("reads dimensions, delays and loop count without decoding pixels", () => {
    const gif = buildGif({
      width: 3,
      height: 2,
      palette: PALETTE,
      loopCount: 5,
      frames: [
        {
          indexes: new Array(6).fill(0),
          width: 3,
          height: 2,
          delayCentiseconds: 10,
        },
        {
          indexes: new Array(6).fill(1),
          width: 3,
          height: 2,
          delayCentiseconds: 25,
        },
        {
          indexes: new Array(6).fill(2),
          width: 3,
          height: 2,
          delayCentiseconds: 0,
        },
      ],
    });

    const metadata = parseGifMetadata(gif);

    expect(metadata.width).toBe(3);
    expect(metadata.height).toBe(2);
    expect(metadata.loopCount).toBe(5);
    expect(metadata.delays).toEqual([100, 250, 100]);
  });

  it("throws on truncated data", () => {
    const gif = buildGif({
      width: 1,
      height: 1,
      palette: PALETTE,
      frames: [
        { indexes: [0], width: 1, height: 1 },
        { indexes: [1], width: 1, height: 1 },
      ],
    });

    expect(() => decodeGif(gif.slice(0, 20))).toThrow();
  });
});

// -----------------------------------------------------------------------------
// APNG builder
// -----------------------------------------------------------------------------

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const uint32BE = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const uint16BE = (value: number): number[] => [
  (value >>> 8) & 0xff,
  value & 0xff,
];

const pngChunk = (type: string, data: number[]): number[] => {
  const body = [...[...type].map((char) => char.charCodeAt(0)), ...data];
  const crc = crc32(Buffer.from(body));
  return [...uint32BE(data.length), ...body, ...uint32BE(crc)];
};

type TestApngFrame = {
  rgba: number[];
  width: number;
  height: number;
  left?: number;
  top?: number;
  delayNumerator: number;
  delayDenominator: number;
  disposeOp?: number;
  blendOp?: number;
};

const buildApng = (opts: {
  width: number;
  height: number;
  loopCount?: number;
  frames: TestApngFrame[];
}): Uint8Array<ArrayBuffer> => {
  const bytes: number[] = [...PNG_HEADER];
  const push = (...values: number[]) => bytes.push(...values);

  push(
    ...pngChunk("IHDR", [
      ...uint32BE(opts.width),
      ...uint32BE(opts.height),
      8, // bit depth
      6, // color type RGBA
      0,
      0,
      0,
    ]),
  );
  push(
    ...pngChunk("acTL", [
      ...uint32BE(opts.frames.length),
      ...uint32BE(opts.loopCount ?? 0),
    ]),
  );

  let sequence = 0;
  opts.frames.forEach((frame, index) => {
    push(
      ...pngChunk("fcTL", [
        ...uint32BE(sequence++),
        ...uint32BE(frame.width),
        ...uint32BE(frame.height),
        ...uint32BE(frame.left ?? 0),
        ...uint32BE(frame.top ?? 0),
        ...uint16BE(frame.delayNumerator),
        ...uint16BE(frame.delayDenominator),
        frame.disposeOp ?? 0,
        frame.blendOp ?? 0,
      ]),
    );

    const scanlines: number[] = [];
    for (let y = 0; y < frame.height; y++) {
      scanlines.push(0);
      for (let x = 0; x < frame.width; x++) {
        const offset = (y * frame.width + x) * 4;
        scanlines.push(
          frame.rgba[offset],
          frame.rgba[offset + 1],
          frame.rgba[offset + 2],
          frame.rgba[offset + 3],
        );
      }
    }
    const zipped = [...deflateSync(Buffer.from(scanlines))];

    if (index === 0) {
      push(...pngChunk("IDAT", zipped));
    } else {
      push(...pngChunk("fdAT", [...uint32BE(sequence++), ...zipped]));
    }
  });

  push(...pngChunk("IEND", []));
  return new Uint8Array(bytes);
};

const solidPixels = (
  width: number,
  height: number,
  [r, g, b, a]: number[],
): number[] => {
  const pixels: number[] = [];
  for (let i = 0; i < width * height; i++) {
    pixels.push(r, g, b, a);
  }
  return pixels;
};

describe("decodeAnimatedImage (APNG)", () => {
  it("decodes frames with delays and loop count", async () => {
    const apng = buildApng({
      width: 2,
      height: 1,
      loopCount: 2,
      frames: [
        {
          rgba: solidPixels(2, 1, [...RED, 255]),
          width: 2,
          height: 1,
          delayNumerator: 120,
          delayDenominator: 1000,
        },
        {
          rgba: solidPixels(2, 1, [...GREEN, 255]),
          width: 2,
          height: 1,
          delayNumerator: 80,
          delayDenominator: 1000,
        },
      ],
    });

    const decoded = await decodeAnimatedImage(
      new Blob([apng], { type: "image/png" }),
    );

    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBe(2);
    expect(decoded!.height).toBe(1);
    expect(decoded!.loopCount).toBe(2);
    expect(decoded!.frames).toHaveLength(2);
    expect(decoded!.frames[0].delay).toBe(120);
    expect(decoded!.frames[1].delay).toBe(80);
    expect(pixelAt(decoded!.frames[0], 0)).toEqual([...RED, 255]);
    expect(pixelAt(decoded!.frames[1], 0)).toEqual([...GREEN, 255]);
  });

  it("alpha blends frames with blend op OVER", async () => {
    const apng = buildApng({
      width: 1,
      height: 1,
      frames: [
        {
          rgba: [...RED, 255],
          width: 1,
          height: 1,
          delayNumerator: 1,
          delayDenominator: 10,
        },
        {
          rgba: [0, 0, 255, 128],
          width: 1,
          height: 1,
          delayNumerator: 1,
          delayDenominator: 10,
          blendOp: 1,
        },
      ],
    });

    const decoded = await decodeAnimatedImage(new Blob([apng]));
    const [r, g, b, a] = pixelAt(decoded!.frames[1], 0);

    // source-over of 50% blue over opaque red
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(135);
    expect(g).toBe(0);
    expect(b).toBeGreaterThan(120);
    expect(b).toBeLessThan(135);
  });

  it("clears the frame rect after dispose op BACKGROUND", async () => {
    const apng = buildApng({
      width: 2,
      height: 1,
      frames: [
        {
          rgba: solidPixels(2, 1, [...RED, 255]),
          width: 2,
          height: 1,
          delayNumerator: 1,
          delayDenominator: 10,
        },
        {
          rgba: [...GREEN, 255],
          width: 1,
          height: 1,
          left: 1,
          delayNumerator: 1,
          delayDenominator: 10,
          disposeOp: 1,
        },
        {
          rgba: [...BLUE, 255],
          width: 1,
          height: 1,
          left: 0,
          delayNumerator: 1,
          delayDenominator: 10,
        },
      ],
    });

    const decoded = await decodeAnimatedImage(new Blob([apng]));

    expect(pixelAt(decoded!.frames[2], 0)).toEqual([...BLUE, 255]);
    // the green pixel was cleared to transparent, not restored to red
    expect(pixelAt(decoded!.frames[2], 1)).toEqual([0, 0, 0, 0]);
  });
});

// -----------------------------------------------------------------------------
// integration with real encoder output
// -----------------------------------------------------------------------------

const testResourcesDir = path.resolve(__dirname, "image");

const readFile = (name: string, type: string): Blob =>
  new Blob(
    [new Uint8Array(fs.readFileSync(path.join(testResourcesDir, name)))],
    {
      type,
    },
  );

describe("isAnimatedImage", () => {
  it("should detect animated GIF", async () => {
    const blob = readFile("example.gif", "image/gif");
    expect(await isAnimatedImage(blob)).toBe(true);
  });

  it("should detect animated PNG (APNG)", async () => {
    const blob = readFile("example.png", "image/png");
    expect(await isAnimatedImage(blob)).toBe(true);
  });

  it("should detect animated WebP", async () => {
    const blob = readFile("example.webp", "image/webp");
    expect(await isAnimatedImage(blob)).toBe(true);
  });

  it("should detect static GIF", async () => {
    const blob = readFile("false_example.gif", "image/gif");
    expect(await isAnimatedImage(blob)).toBe(false);
  });

  it("should detect static PNG", async () => {
    const blob = readFile("false_example.png", "image/png");
    expect(await isAnimatedImage(blob)).toBe(false);
  });

  it("should detect static WebP", async () => {
    const blob = readFile("false_example.webp", "image/webp");
    expect(await isAnimatedImage(blob)).toBe(false);
  });
});

describe("decodeAnimatedImage", () => {
  it("decodes a real animated GIF", async () => {
    const decoded = await decodeAnimatedImage(
      readFile("example.gif", "image/gif"),
    );

    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBe(4);
    expect(decoded!.height).toBe(4);
    expect(decoded!.frames).toHaveLength(3);
    expect(decoded!.frames.map((frame) => frame.delay)).toEqual([100, 50, 200]);
    expect(pixelAt(decoded!.frames[0], 0)).toEqual([...RED, 255]);
    expect(pixelAt(decoded!.frames[1], 0)).toEqual([...GREEN, 255]);
    expect(pixelAt(decoded!.frames[2], 0)).toEqual([...BLUE, 255]);
  });

  it("decodes a real APNG", async () => {
    const decoded = await decodeAnimatedImage(
      readFile("example.png", "image/png"),
    );

    expect(decoded).not.toBeNull();
    expect(decoded!.frames).toHaveLength(2);
    expect(pixelAt(decoded!.frames[0], 0)).toEqual([...RED, 255]);
    expect(pixelAt(decoded!.frames[1], 0)).toEqual([...GREEN, 255]);
  });

  it("returns null for animated WebP when ImageDecoder is unavailable", async () => {
    const decoded = await decodeAnimatedImage(
      readFile("example.webp", "image/webp"),
    );

    expect(decoded).toBeNull();
  });

  it("returns null for static images", async () => {
    expect(
      await decodeAnimatedImage(readFile("false_example.gif", "image/gif")),
    ).toBeNull();
    expect(
      await decodeAnimatedImage(readFile("false_example.png", "image/png")),
    ).toBeNull();
    expect(
      await decodeAnimatedImage(readFile("false_example.webp", "image/webp")),
    ).toBeNull();
  });
});

const POOL = 1000;

/** stub player: sheds by releasing whole frames, highest first */
const createOwner = (pool: FramePool, framePixels: number) => {
  const owner: FramePoolOwner & { member: FramePoolMember | null } = {
    member: null,
    shedCache(maxPixels: number) {
      while (this.member && this.member.usedPixels > maxPixels) {
        pool.release(this.member, framePixels);
      }
    },
  };
  return owner;
};

/** reserves frames one at a time until denied; returns frames reserved */
const fill = (
  pool: FramePool,
  member: FramePoolMember,
  framePixels: number,
  now: number,
) => {
  let frames = 0;
  pool.touch(member, now);
  while (pool.tryReserve(member, framePixels, now)) {
    frames++;
  }
  return frames;
};

describe("FramePool", () => {
  it("lets a lone animation cache up to its demand", () => {
    const pool = new FramePool(POOL);
    const owner = createOwner(pool, 100);
    const member = (owner.member = pool.register(owner, 500));

    expect(fill(pool, member, 100, 0)).toBe(5);
    expect(member.usedPixels).toBe(500);
  });

  it("caps a lone animation at the pool size", () => {
    const pool = new FramePool(POOL);
    const owner = createOwner(pool, 100);
    const member = (owner.member = pool.register(owner, 5000));

    expect(fill(pool, member, 100, 0)).toBe(10);
  });

  it("splits the pool equally between two large animations", () => {
    const pool = new FramePool(POOL);
    const ownerA = createOwner(pool, 100);
    const ownerB = createOwner(pool, 100);
    const memberA = (ownerA.member = pool.register(ownerA, 5000));
    const memberB = (ownerB.member = pool.register(ownerB, 5000));
    pool.touch(memberA, 0);
    pool.touch(memberB, 0);

    expect(fill(pool, memberA, 100, 0)).toBe(5);
    expect(fill(pool, memberB, 100, 0)).toBe(5);
  });

  it("redistributes a small animation's surplus to a large one", () => {
    const pool = new FramePool(POOL);
    const small = createOwner(pool, 100);
    const large = createOwner(pool, 100);
    const smallMember = (small.member = pool.register(small, 200));
    const largeMember = (large.member = pool.register(large, 5000));
    pool.touch(smallMember, 0);
    pool.touch(largeMember, 0);

    // small only needs 200 of its 500 slot; large gets the remaining 800
    expect(fill(pool, smallMember, 100, 0)).toBe(2);
    expect(fill(pool, largeMember, 100, 0)).toBe(8);
  });

  it("claws back an incumbent's over-share cache for a newcomer", () => {
    const pool = new FramePool(POOL);
    const first = createOwner(pool, 100);
    const firstMember = (first.member = pool.register(first, 5000));

    // alone, the first animation fills the whole pool
    expect(fill(pool, firstMember, 100, 0)).toBe(10);

    const second = createOwner(pool, 100);
    const secondMember = (second.member = pool.register(second, 5000));

    // the newcomer gets its equal slot; the incumbent is shed down to its
    expect(fill(pool, secondMember, 100, 10)).toBe(5);
    expect(firstMember.usedPixels).toBe(500);
  });

  it("evicts a paused animation's cache entirely", () => {
    const pool = new FramePool(POOL);
    const paused = createOwner(pool, 100);
    const pausedMember = (paused.member = pool.register(paused, 500));
    expect(fill(pool, pausedMember, 100, 0)).toBe(5);

    const running = createOwner(pool, 100);
    const runningMember = (running.member = pool.register(running, 5000));

    // well past the inactivity window, the paused member's cache is evicted
    // and the running one can use the entire pool
    expect(fill(pool, runningMember, 100, 100_000)).toBe(10);
    expect(pausedMember.usedPixels).toBe(0);
  });

  it("denies a reservation beyond the fair share", () => {
    const pool = new FramePool(POOL);
    const ownerA = createOwner(pool, 600);
    const ownerB = createOwner(pool, 600);
    const memberA = (ownerA.member = pool.register(ownerA, 1200));
    const memberB = (ownerB.member = pool.register(ownerB, 1200));
    pool.touch(memberA, 0);
    pool.touch(memberB, 0);

    // each slot is 500 — a 600 pixel frame never fits
    expect(pool.tryReserve(memberA, 600, 0)).toBe(false);
    expect(memberA.usedPixels).toBe(0);
  });
});

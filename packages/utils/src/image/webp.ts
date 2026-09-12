import { MAX_ANIMATION_FRAMES } from "./types";

import type { DecodedAnimatedImage, DecodedAnimatedImageFrame } from "./types";

type ImageDecoderTrack = {
  animated: boolean;
  frameCount: number;
  repetitionCount: number;
};

type ImageDecoderInstance = {
  tracks: { ready: Promise<void>; selectedTrack: ImageDecoderTrack | null };
  decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>;
  close(): void;
};

const getImageDecoder = ():
  | (new (options: { data: Uint8Array; type: string }) => ImageDecoderInstance)
  | null => (globalThis as any).ImageDecoder ?? null;

/**
 * Random-access animated WebP decoder backed by the WebCodecs ImageDecoder,
 * which composites frames natively and keeps its own internal caches so
 * frames are decoded on demand rather than stored up front.
 */
export class WebpDecoder {
  readonly width: number;
  readonly height: number;
  readonly loopCount: number;
  // per-frame display delay in ms
  readonly delays: number[];

  private decoder: ImageDecoderInstance;

  private constructor(
    decoder: ImageDecoderInstance,
    width: number,
    height: number,
    loopCount: number,
    delays: number[],
  ) {
    this.decoder = decoder;
    this.width = width;
    this.height = height;
    this.loopCount = loopCount;
    this.delays = delays;
  }

  static async create(bytes: Uint8Array): Promise<WebpDecoder> {
    const ImageDecoder = getImageDecoder();
    if (!ImageDecoder) {
      throw new Error("ImageDecoder API unavailable");
    }

    const decoder = new ImageDecoder({ data: bytes, type: "image/webp" });
    try {
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      if (!track?.animated) {
        throw new Error("WebP is not animated");
      }
      if (track.frameCount > MAX_ANIMATION_FRAMES) {
        throw new Error(
          `Animated image exceeds the ${MAX_ANIMATION_FRAMES} frame limit`,
        );
      }

      // one metadata pass to learn dimensions and per-frame durations; the
      // frames themselves are closed immediately and re-decoded on demand
      let width = 0;
      let height = 0;
      const delays: number[] = [];
      for (let index = 0; index < track.frameCount; index++) {
        const { image } = await decoder.decode({ frameIndex: index });
        width = image.displayWidth;
        height = image.displayHeight;
        delays.push(image.duration ? image.duration / 1000 : 100);
        image.close();
      }

      // repetitionCount is Infinity for endless animations; finite values are
      // surfaced either as play or repeat counts depending on the engine
      const loopCount = Number.isFinite(track.repetitionCount)
        ? Math.max(1, Math.round(track.repetitionCount))
        : 0;

      return new WebpDecoder(decoder, width, height, loopCount, delays);
    } catch (error) {
      decoder.close();
      throw error;
    }
  }

  /**
   * Decodes a single fully composited frame; the caller must close() it
   */
  async decodeFrame(index: number): Promise<VideoFrame> {
    const { image } = await this.decoder.decode({ frameIndex: index });
    return image;
  }

  close() {
    this.decoder.close();
  }
}

/**
 * One-shot decode of every frame. Used by tests and consumers that want
 * the full animation in memory; playback uses WebpDecoder on demand
 * */
export const decodeAnimatedWebp = async (
  bytes: Uint8Array,
): Promise<DecodedAnimatedImage> => {
  const decoder = await WebpDecoder.create(bytes);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D unavailable");
    }
    canvas.width = decoder.width;
    canvas.height = decoder.height;

    const frames: DecodedAnimatedImageFrame[] = [];
    for (let index = 0; index < decoder.delays.length; index++) {
      const image = await decoder.decodeFrame(index);
      context.clearRect(0, 0, decoder.width, decoder.height);
      context.drawImage(image, 0, 0);
      image.close();
      frames.push({
        data: context.getImageData(0, 0, decoder.width, decoder.height).data,
        delay: decoder.delays[index],
      });
    }

    return {
      width: decoder.width,
      height: decoder.height,
      frames,
      loopCount: decoder.loopCount,
    };
  } finally {
    decoder.close();
  }
};

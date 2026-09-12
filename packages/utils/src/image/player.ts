import type { AnimatedImage } from "@excalidraw/element/types";

import { readBlobBytes, sniffAnimatedImageType } from "../animated-image";

import { ApngDecoder } from "./apng";
import { ANIMATION_INACTIVITY_MS, animationFramePool } from "./frame-pool";
import { GifDecoder, parseGifMetadata } from "./gif";
import { WebpDecoder } from "./webp";

import type { FramePoolMember, FramePoolOwner } from "./frame-pool";

// Bound on synchronous decode work per pump invocation, so a large
// animation can't stall the main thread while catching up
const MAX_DECODES_PER_PUMP = 2;

type SequentialDecoder =
  | { kind: "gif"; decoder: GifDecoder }
  | { kind: "apng"; decoder: ApngDecoder };

type FrameSource = SequentialDecoder | { kind: "webp"; decoder: WebpDecoder };

/**
 * Just-in-time animated image player implementing the element package's
 * AnimatedImage contract.
 *
 * Frames are decoded at native resolution during playback: GIF/APNG advance
 * a single running composite sequentially (wrapping at the end), WebP uses
 * the native ImageDecoder's random access. Decoded frames are additionally
 * cached as bitmaps while the global frame pool has room, making small
 * animations effectively free after their first loop while large ones
 * re-decode on the fly instead of exhausting memory.
 */
class AnimatedImagePlayer implements AnimatedImage, FramePoolOwner {
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly delays: readonly number[];
  readonly totalDuration: number;
  readonly loopCount: number;
  startTime = 0;

  image: ImageBitmap | HTMLCanvasElement;
  renderedFrameIndex = -1;

  private source: FrameSource;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  //shares the sequential decoders' composite buffer
  // putImageData copies at call time, so no per-frame buffer copies are needed
  private compositeImageData: ImageData | null = null;
  private cache: (ImageBitmap | undefined)[];
  private targetFrameIndex = 0;
  private pumping = false;
  private poolMember: FramePoolMember;
  private lastSeekAt = 0;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    source: FrameSource,
    delays: readonly number[],
    loopCount: number,
  ) {
    this.source = source;
    this.width = source.decoder.width;
    this.height = source.decoder.height;
    this.frameCount = delays.length;
    this.delays = delays;
    this.totalDuration = delays.reduce((total, delay) => total + delay, 0);
    this.loopCount = loopCount;
    this.cache = new Array(this.frameCount);

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D unavailable");
    }
    this.context = context;
    this.image = this.canvas;

    this.poolMember = animationFramePool.register(
      this,
      this.width * this.height * this.frameCount,
    );

    if (source.kind !== "webp") {
      this.compositeImageData = new ImageData(
        source.decoder.composite,
        this.width,
        this.height,
      );
    }
  }

  /**
   * Pixels currently reserved in the shared frame pool for this player's
   * cached frames
   */
  get cachedPixels(): number {
    return this.poolMember.usedPixels;
  }

  seek(frameIndex: number) {
    this.markActive();
    const target = Math.max(0, Math.min(frameIndex, this.frameCount - 1));
    if (
      target !== this.targetFrameIndex ||
      target !== this.renderedFrameIndex
    ) {
      this.targetFrameIndex = target;
      void this.pump().catch((error) =>
        console.error("Animated image decode failed", error),
      );
    }
  }

  /**
   * Drops cached frames (highest indexes first) until at or below
   * `maxPixels`. Called by the frame pool for fairness and when this
   * animation pauses
   */
  shedCache(maxPixels: number) {
    const framePixels = this.width * this.height;
    for (
      let index = this.frameCount - 1;
      index >= 0 && this.poolMember.usedPixels > maxPixels;
      index--
    ) {
      const bitmap = this.cache[index];
      if (!bitmap) {
        continue;
      }
      if (this.image === bitmap) {
        // keep the displayed frame visible on the fallback canvas
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.drawImage(bitmap, 0, 0);
        this.image = this.canvas;
      }
      this.cache[index] = undefined;
      bitmap.close();
      animationFramePool.release(this.poolMember, framePixels);
    }
  }

  /**
   * Keeps the pool informed that this animation is playing, and arms a
   * timer that evicts this player's cache once seeks stop (e.g. when the
   * image scrolls out of the viewport)
   */
  private markActive() {
    this.lastSeekAt = Date.now();
    animationFramePool.touch(this.poolMember, this.lastSeekAt);
    if (this.inactivityTimer === null) {
      this.armInactivityTimer(ANIMATION_INACTIVITY_MS);
    }
  }

  private armInactivityTimer(delay: number) {
    this.inactivityTimer = setTimeout(() => {
      const idle = Date.now() - this.lastSeekAt;
      if (idle >= ANIMATION_INACTIVITY_MS) {
        this.inactivityTimer = null;
        this.shedCache(0);
      } else {
        this.armInactivityTimer(ANIMATION_INACTIVITY_MS - idle);
      }
    }, delay + 50);
  }

  /**
   * Decodes toward the target frame, bounded per invocation; seek() is
   * called on every animation tick, so interrupted catch-up work resumes on
   * the next tick
   */
  private async pump() {
    if (this.pumping) {
      return;
    }
    this.pumping = true;
    try {
      let decodes = 0;
      while (decodes < MAX_DECODES_PER_PUMP) {
        const target = this.targetFrameIndex;

        if (this.renderedFrameIndex === target) {
          // pre-warm: keep the sequential decoder just ahead of the
          // playhead so uncached frames are ready when their time comes
          if (this.source.kind !== "webp" && this.decoderLagsBehind(target)) {
            await this.advanceSequential();
            decodes++;
            continue;
          }
          break;
        }

        const cached = this.cache[target];
        if (cached) {
          this.image = cached;
          this.renderedFrameIndex = target;
          continue;
        }

        if (this.source.kind === "webp") {
          await this.presentWebpFrame(target);
          decodes++;
          continue;
        }

        if (
          this.source.decoder.nextFrameIndex ===
          (target + 1) % this.frameCount
        ) {
          // the composite already holds the target (decoded by pre-warm)
          this.presentComposite(target);
          continue;
        }

        await this.advanceSequential();
        decodes++;
      }
    } finally {
      this.pumping = false;
    }
  }

  /** whether the sequential decoder still has to run to serve the frame
   * after `target` (false when everything ahead is cached) */
  private decoderLagsBehind(target: number): boolean {
    if (this.source.kind === "webp") {
      return false;
    }
    let next: number | null = null;
    for (let step = 1; step <= this.frameCount; step++) {
      const index = (target + step) % this.frameCount;
      if (!this.cache[index]) {
        next = index;
        break;
      }
    }
    return (
      next !== null &&
      this.source.decoder.nextFrameIndex !== next &&
      // the composite currently holding `target` also counts as ready
      this.source.decoder.nextFrameIndex !== (target + 1) % this.frameCount
    );
  }

  /**
   * Decodes one frame with the sequential decoder, caching and presenting
   * it as appropriate
   */
  private async advanceSequential() {
    if (this.source.kind === "webp") {
      return;
    }
    const { index } =
      this.source.kind === "gif"
        ? this.source.decoder.decodeNext()
        : await this.source.decoder.decodeNext();

    const pixels = this.width * this.height;
    if (
      !this.cache[index] &&
      this.compositeImageData &&
      animationFramePool.tryReserve(this.poolMember, pixels)
    ) {
      try {
        this.cache[index] = await createImageBitmap(this.compositeImageData);
      } catch (error) {
        animationFramePool.release(this.poolMember, pixels);
        throw error;
      }
    }

    if (index === this.targetFrameIndex) {
      this.presentComposite(index);
    }
  }

  private presentComposite(index: number) {
    if (this.compositeImageData) {
      this.context.putImageData(this.compositeImageData, 0, 0);
    }
    this.image = this.canvas;
    this.renderedFrameIndex = index;
  }

  private async presentWebpFrame(index: number) {
    if (this.source.kind !== "webp") {
      return;
    }
    const pixels = this.width * this.height;
    const frame = await this.source.decoder.decodeFrame(index);
    try {
      if (
        !this.cache[index] &&
        animationFramePool.tryReserve(this.poolMember, pixels)
      ) {
        try {
          this.cache[index] = await createImageBitmap(frame);
        } catch (error) {
          animationFramePool.release(this.poolMember, pixels);
          throw error;
        }
      }
      const cached = this.cache[index];
      if (cached) {
        this.image = cached;
      } else {
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.drawImage(frame, 0, 0);
        this.image = this.canvas;
      }
      this.renderedFrameIndex = index;
    } finally {
      frame.close();
    }
  }

  /**
   * Resolves once the first frame is decoded and displayed.
   */
  async ready(): Promise<this> {
    this.targetFrameIndex = 0;
    // each pump makes at least one frame of progress; the bound guards
    // against a decoder that spins without advancing
    for (
      let i = 0;
      i <= this.frameCount && this.renderedFrameIndex !== 0;
      i++
    ) {
      await this.pump();
    }
    if (this.renderedFrameIndex !== 0) {
      throw new Error("Failed to decode the first animation frame");
    }
    return this;
  }
}

/**
 * Creates a just-in-time player for an animated image (GIF, APNG, animated
 * WebP), with the first frame decoded and ready to draw. Returns null when
 * the image is not animated or can't be decoded in this environment.
 * Callers should fall back to static rendering.
 */
export const createAnimatedImagePlayer = async (
  file: Blob,
): Promise<AnimatedImage | null> => {
  try {
    const bytes = await readBlobBytes(file);
    const type = sniffAnimatedImageType(bytes);
    if (!type) {
      return null;
    }

    let source: FrameSource;
    let delays: number[];
    let loopCount: number;

    if (type === "gif") {
      const metadata = parseGifMetadata(bytes);
      delays = metadata.delays;
      loopCount = metadata.loopCount;
      source = { kind: "gif", decoder: new GifDecoder(bytes) };
    } else if (type === "apng") {
      const decoder = new ApngDecoder(bytes);
      delays = decoder.delays;
      loopCount = decoder.loopCount;
      source = { kind: "apng", decoder };
    } else {
      const decoder = await WebpDecoder.create(bytes);
      delays = decoder.delays;
      loopCount = decoder.loopCount;
      source = { kind: "webp", decoder };
    }

    if (delays.length < 2) {
      return null;
    }

    return await new AnimatedImagePlayer(source, delays, loopCount).ready();
  } catch {
    return null;
  }
};

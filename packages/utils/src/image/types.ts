export type DecodedAnimatedImageFrame = {
  // Composited RGBA pixels in full image size
  data: Uint8ClampedArray<ArrayBuffer>;
  // How long the frame is displayed, in milliseconds
  delay: number;
};

// Result of the one-shot batch decoders (decodeGif & co.)
export type DecodedAnimatedImage = {
  width: number;
  height: number;
  frames: DecodedAnimatedImageFrame[];
  // 0 loops forever
  loopCount: number;
};

// Decode CPU/latency cap — animations with more frames fall back to a
// static image
export const MAX_ANIMATION_FRAMES = 1000;

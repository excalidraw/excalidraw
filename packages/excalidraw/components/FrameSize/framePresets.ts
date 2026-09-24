import type { ScreenIconDevice } from "../icons";

export type FrameSize = { width: number; height: number };

export type FramePreset = FrameSize & {
  name:
    | "slide16x9"
    | "slide4x3"
    | "widescreen16x10"
    | "ultrawide"
    | "laptop"
    | "monitor4k"
    | "tablet"
    | "phone";
  device?: ScreenIconDevice;
};

/** frame sizes of common screens, in scene units (1 unit = 1 css px at
 * 100% zoom) */
export const SCREEN_PRESETS: readonly FramePreset[] = [
  { name: "slide16x9", width: 1920, height: 1080 },
  { name: "slide4x3", width: 1024, height: 768 },
  { name: "widescreen16x10", width: 1920, height: 1200 },
  { name: "ultrawide", width: 2560, height: 1080 },
];

export const DEVICE_PRESETS: readonly FramePreset[] = [
  { name: "laptop", width: 1440, height: 900, device: "laptop" },
  { name: "monitor4k", width: 3840, height: 2160, device: "monitor" },
  { name: "tablet", width: 820, height: 1180, device: "tablet" },
  { name: "phone", width: 390, height: 844, device: "phone" },
];

export const isFramePortrait = ({ width, height }: FrameSize) => height > width;

/** a preset's size turned to the given orientation */
export const orientFrameSize = (
  size: FrameSize,
  portrait: boolean,
): FrameSize =>
  isFramePortrait(size) === portrait
    ? { width: size.width, height: size.height }
    : { width: size.height, height: size.width };

/** whether the size is the preset's, in either orientation */
export const matchesFramePreset = (size: FrameSize, preset: FramePreset) =>
  (size.width === preset.width && size.height === preset.height) ||
  (size.width === preset.height && size.height === preset.width);

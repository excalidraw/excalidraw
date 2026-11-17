// Basic element and editor types that every package shares. They live here,
// at the bottom of the package graph, and are re-exported from
// `@excalidraw/element/types` and `@excalidraw/excalidraw/types`.

import type { FONT_FAMILY, ROUNDNESS } from "./constants";
import type { MakeBrand, ValueOf } from "./utility-types";

export type FontFamilyKeys = keyof typeof FONT_FAMILY;
export type FontFamilyValues = typeof FONT_FAMILY[FontFamilyKeys];
export type FontString = string & { _brand: "fontString" };
/** unitless text line height (multiplier of the font size) */
export type UnitlessLineHeight = number & { _brand: "unitlessLineHeight" };

export type FillStyle = "hachure" | "cross-hatch" | "solid" | "zigzag";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type RoundnessType = ValueOf<typeof ROUNDNESS>;
export type ArrowType = "sharp" | "round" | "elbow";

export type NormalizedZoomValue = number & { _brand: "normalizedZoom" };
export type Zoom = Readonly<{
  value: NormalizedZoomValue;
}>;
export type NullableGridSize = (number & MakeBrand<"NullableGridSize">) | null;

export type UnsubscribeCallback = () => void;

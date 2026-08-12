/**
 * Purpose:
 *   Type shapes for Obsidian-host-defined data stored opaquely on
 *   `AppState` (`customPens`, `currentStrokeOptions`, `resetCustomPen`).
 *   These are Obsidian Excalidraw plugin concepts, not general-purpose
 *   Excalidraw ones, so they live in this ringfenced file rather than
 *   `types.ts` -- kept next to the other Obsidian-only surfaces
 *   (`obsidianUtils.ts`, `obsidianEntry.ts`).
 *
 * Author:
 *   zsviczian
 *
 * References:
 *   https://github.com/zsviczian/obsidian-excalidraw-plugin
 *
 * Notes:
 *   The fork cannot depend on its own consumer plugin, so these are the
 *   canonical definitions. The plugin's `src/types/penTypes.ts` and
 *   `ObsidianMenu.tsx`'s `ResetCustomPenState` alias these types instead of
 *   keeping independent copies, so the two repositories cannot drift apart.
 *   Edit here, not there.
 */

export type ObsidianPenStrokeOptions = {
  thinning: number;
  smoothing: number;
  streamline: number;
  easing: string;
  simulatePressure?: boolean;
  start: {
    cap: boolean;
    taper: number | boolean;
    easing: string;
  };
  end: {
    cap: boolean;
    taper: number | boolean;
    easing: string;
  };
};

export type ObsidianPenOptions = {
  highlighter: boolean;
  constantPressure: boolean;
  hasOutline: boolean;
  outlineWidth: number;
  options: ObsidianPenStrokeOptions;
};

export type ObsidianExtendedFillStyle =
  | "dots"
  | "zigzag"
  | "zigzag-line"
  | "dashed"
  | "hachure"
  | "cross-hatch"
  | "solid"
  | "";

export type ObsidianPenType =
  | "default"
  | "highlighter"
  | "finetip"
  | "fountain"
  | "marker"
  | "thick-thin"
  | "thin-thick-thin";

export type ObsidianPenStyle = {
  type: ObsidianPenType;
  freedrawOnly: boolean;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle: ObsidianExtendedFillStyle;
  strokeWidth: number;
  roughness: number;
  penOptions: ObsidianPenOptions;
};

/** Snapshot of current-item stroke properties captured before a custom pen
 * overrides them, restored when the pen is deselected. */
export type ObsidianResetCustomPenState = {
  currentItemStrokeWidthKey?: string | null;
  currentItemStrokeWidth?: number | null;
  currentItemStrokeVariability?: string | null;
  currentItemBackgroundColor?: string | null;
  currentItemStrokeColor?: string | null;
  currentItemFillStyle?: string | null;
  currentItemRoughness?: number | null;
};

export {
  isPolyPresetType,
  POLY_PRESET_TYPES,
} from "@excalidraw/element/polyPresets";

export const SOLID_PRESET_TYPES = new Set([
  "prism",
  "pyramid",
  "tetrahedron",
  "cylinder",
  "sphere",
]);

export const isSolidPresetType = (type: string): boolean =>
  SOLID_PRESET_TYPES.has(type);

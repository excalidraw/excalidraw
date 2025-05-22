import type {
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
  FillStyle,
  StrokeStyle,
  GroupId,
  RoundnessType,
  FractionalIndex,
  BoundElement,
  FileId,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { Radians } from "@excalidraw/math";

// Creates base type, less redundant properties
export type RabbitElementBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: Radians;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: readonly GroupId[];
  frameId: string | null;
  roundness: null | { type: RoundnessType; value?: number };
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: readonly BoundElement[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, any>;
  index: FractionalIndex | null;
};

// compatible with RectangularElement
export type RabbitSearchBoxElement = {
  id: string;
  type: "rabbit-searchbox";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: Radians;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: readonly GroupId[];
  frameId: string | null;
  roundness: null | { type: RoundnessType; value?: number };
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: readonly BoundElement[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, any>;
  index: FractionalIndex | null;
  
  // text-related properties required by ExcalidrawTextElement
  text: string;
  fontSize: number;
  fontFamily: FontFamilyValues;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  containerId: string | null;
  originalText: string;
  autoResize: boolean;
  lineHeight: number & { _brand: "unitlessLineHeight" };
  
  // rabbitSearchBox specific properties
  rabbitId: string;
  hasIcon: boolean;
  
  isEditing: boolean;
  currentText: string;
};

export type RabbitImageElement = {
  type: "rabbit-image";
  imageUrl: string;
  label: string;
} & RabbitElementBase;

// Add to union type when adding more Rabbit element types
export type RabbitElement = RabbitSearchBoxElement | RabbitImageElement;

export const isRabbitElement = (element: ExcalidrawElement): element is RabbitElement => {
  // return element.type === "rabbit-searchbox";
  // When you add more Rabbit element types, change to:
  return element.type.startsWith("rabbit-");
};

export const isRabbitSearchBoxElement = (
  element: ExcalidrawElement
): element is RabbitSearchBoxElement => {
  return element.type === "rabbit-searchbox";
};

export const isRabbitImageElement = (
  element: ExcalidrawElement
): element is RabbitImageElement => {
  return element.type === "rabbit-image";
};
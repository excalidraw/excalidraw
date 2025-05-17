import {
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  ROUNDNESS,
  randomInteger,
  randomId,
  getFontString,
  getUpdatedTimestamp,
  getLineHeight,
} from "@excalidraw/common";

import { FillStyle, StrokeStyle, RoundnessType } from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math"; // Change import to type import for Radians
import { newElement } from "@excalidraw/element/newElement";
import { normalizeText, measureText } from "@excalidraw/element/textMeasurements";

import type {
  TextAlign,
  VerticalAlign,
  FontFamilyValues,
} from "@excalidraw/element/types";
import { RabbitSearchBoxElement, RabbitElementBase, RabbitImageElement } from "./rabbitElement";

export const newRabbitSearchBoxElement = (
  opts: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: FontFamilyValues;
    textAlign?: TextAlign;
    verticalAlign?: VerticalAlign;
    hasIcon?: boolean;
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: FillStyle;
    strokeWidth?: number;
    strokeStyle?: StrokeStyle;
    roughness?: number;
    opacity?: number;
    roundness?: { type: RoundnessType; value?: number };
    angle?: number;
  }
) => {
  // default values
  const fontFamily = opts.fontFamily || DEFAULT_FONT_FAMILY;
  const fontSize = opts.fontSize || DEFAULT_FONT_SIZE;
  const lineHeight = getLineHeight(fontFamily);
  const text = normalizeText(opts.text || "Search...");
  const textAlign = opts.textAlign || DEFAULT_TEXT_ALIGN;
  const verticalAlign = opts.verticalAlign || DEFAULT_VERTICAL_ALIGN;
  const hasIcon = opts.hasIcon !== undefined ? opts.hasIcon : true;
  
  // extra padding for the icon if enabled
  const iconPadding = hasIcon ? 30 : 0;
  
  // for defaults
  const metrics = measureText(
    text,
    getFontString({ fontFamily, fontSize }),
    lineHeight,
  );
  
  // if not provided, set dimensions w defaults
  const width = opts.width || Math.max(200, metrics.width + 20 + iconPadding); 
  const height = opts.height || Math.max(40, metrics.height + 16); 

  // generic element as base
  const baseElement = newElement({
    type: "rabbit-searchbox" as any,
    x: opts.x,
    y: opts.y,
    width,
    height,
    strokeColor: opts.strokeColor || "#666666",
    backgroundColor: opts.backgroundColor || "#ffffff",
    fillStyle: opts.fillStyle || DEFAULT_ELEMENT_PROPS.fillStyle,
    strokeWidth: opts.strokeWidth || 1,
    strokeStyle: opts.strokeStyle || DEFAULT_ELEMENT_PROPS.strokeStyle,
    roughness: opts.roughness || 0,
    opacity: opts.opacity || 100,
    roundness: opts.roundness || { 
      type: ROUNDNESS.ADAPTIVE_RADIUS as unknown as RoundnessType, 
      value: 4 
    },    
    angle: (opts.angle || 0) as Radians,
  });

  // rabbitSearchBox specific properties
  const searchBoxElement = {
    ...baseElement,
    type: "rabbit-searchbox",
    rabbitId: `rabbit-${randomId()}`,
    text,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign,
    hasIcon,
    lineHeight,
  };

  // type assertion to bypass TypeScript's type checking
  return searchBoxElement as RabbitSearchBoxElement;
};

export const newRabbitImageElement = (
  opts: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: FontFamilyValues;
    textAlign?: TextAlign;
    verticalAlign?: VerticalAlign;
    hasIcon?: boolean;
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: FillStyle;
    strokeWidth?: number;
    strokeStyle?: StrokeStyle;
    roughness?: number;
    opacity?: number;
    roundness?: { type: RoundnessType; value?: number };
    angle?: number;
    imageUrl?: string; 
    label?: string;    
  }
): RabbitImageElement => {
  const base: RabbitElementBase = {
    id: randomId(),
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 200,
    height: opts.height ?? 200,
    angle: (opts.angle || 0) as Radians,
    version: 1,
    versionNonce: 0,
    strokeColor: opts.strokeColor ?? "#000000",
    backgroundColor: opts.backgroundColor ?? "#ffffff",
    fillStyle: opts.fillStyle ?? "solid",
    strokeWidth: opts.strokeWidth ?? 1,
    strokeStyle: opts.strokeStyle ?? "solid",
    roughness: opts.roughness ?? 0,
    opacity: opts.opacity ?? 100,
    groupIds: [],
    frameId: null,
    roundness: opts.roundness ?? null,
    seed: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: {},
    index: null,
  };

  return {
    ...base,
    type: "rabbit-image",
    imageUrl: opts.imageUrl ?? "https://via.placeholder.com/150",
    label: opts.label ?? "Rabbit Image",
  };
};

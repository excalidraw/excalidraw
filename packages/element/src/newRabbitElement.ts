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
import type { Radians } from "@excalidraw/math"; 
import { newElement } from "@excalidraw/element/newElement";
import { normalizeText, measureText } from "@excalidraw/element/textMeasurements";

import type {
  TextAlign,
  VerticalAlign,
  FontFamilyValues,
} from "@excalidraw/element/types";
import { RabbitSearchBoxElement } from "./rabbitElement";

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
    // originalText: text,
    autoResize: false,
    containerId: null,
    isEditing: false,
    currentText: text,
  };

  // type assertion to bypass TypeScript's type checking
  return searchBoxElement as RabbitSearchBoxElement;
};

export const getSearchBoxText = (element: RabbitSearchBoxElement): string => {
  if (element.currentText !== "Search..." && element.currentText.trim() !== "") {
    console.log("Search Box Text:", element.currentText);
  }
  return element.currentText;
};
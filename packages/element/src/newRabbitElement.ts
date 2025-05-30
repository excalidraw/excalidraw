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
import { RabbitSearchBoxElement, RabbitElementBase, RabbitImageElement, RabbitImageTabsElement, RabbitColorPaletteElement } from "./rabbitElement";
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
    boundElements: [],
  });

  // rabbitSearchBox specific properties
  const searchBoxElement = {
    ...baseElement,
    type: "rabbit-searchbox",
    rabbitId: `rabbit-${randomId()}`,
    
    
    // IMPORTANT: Standard text properties for WYSIWYG compatibility
    text,
    originalText: text,  // This is what WYSIWYG editor uses
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign,
    lineHeight,
    autoResize: false,
    containerId: `rabbit-${randomId()}`,
    boundElements: [],
    
    // Custom properties for your search box functionality
    hasIcon,
    isEditing: false,
    currentText: text,  // Keep this in sync with originalText
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

export const newRabbitImageTabsElement = (
  opts: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    images?: Array<{
      id: string;
      title: string;
      subImages: Array<{ id: string; url: string; title: string }>;
    }>;
    activeTabIndex?: number;
    tabHeight?: number;
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
): RabbitImageTabsElement => {
  const base: RabbitElementBase = {
    id: randomId(),
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 400,
    height: opts.height ?? 300,
    angle: (opts.angle || 0) as Radians,
    version: 1,
    versionNonce: 0,
    strokeColor: opts.strokeColor ?? "#1e1e1e",
    backgroundColor: opts.backgroundColor ?? "#ffffff",
    fillStyle: opts.fillStyle ?? "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: opts.strokeStyle ?? "solid",
    roughness: opts.roughness ?? 1,
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
    type: "rabbit-image-tabs",
    images: opts.images ?? [
      {
        id: "1",
        title: "Tab 1",
        subImages: Array.from({ length: 10 }).map((_, i) => ({
          id: `1-${i + 1}`,
          url: `https://via.placeholder.com/350x200/4f46e5/ffffff?text=Tab1+Image+${i + 1}`,
          title: `Tab 1 - Image ${i + 1}`,
        })),
      },
      {
        id: "2",
        title: "Tab 2",
        subImages: Array.from({ length: 10 }).map((_, i) => ({
          id: `2-${i + 1}`,
          url: `https://via.placeholder.com/350x200/dc2626/ffffff?text=Tab2+Image+${i + 1}`,
          title: `Tab 2 - Image ${i + 1}`,
        })),
      },
      {
        id: "3",
        title: "Tab 3",
        subImages: Array.from({ length: 10 }).map((_, i) => ({
          id: `3-${i + 1}`,
          url: `https://via.placeholder.com/350x200/059669/ffffff?text=Tab3+Image+${i + 1}`,
          title: `Tab 3 - Image ${i + 1}`,
        })),
      },
    ],
    activeTabIndex: opts.activeTabIndex ?? 0,
    tabHeight: opts.tabHeight ?? 40,
  };
};

export const newRabbitColorPalette = (
  opts: {
    x: number;
    y: number;
    colors?: string[];
    width?: number;
    rectangleHeight?: number;
    angle?: number;
  }
): RabbitColorPaletteElement => {
  const defaultColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
  const colors = opts.colors || defaultColors;
  const width = opts.width || 200;
  const rectangleHeight = opts.rectangleHeight || 50;
  const totalHeight = rectangleHeight * 5;

  // Use the same base structure as the other elements
  const base: RabbitElementBase = {
    id: randomId(),
    x: opts.x,
    y: opts.y,
    width,
    height: totalHeight,
    angle: (opts.angle || 0) as Radians,
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000), // Changed from 0 to random
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid" as const,
    strokeWidth: 2,
    strokeStyle: "solid" as const,
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(), // Changed from 1 to Date.now()
    link: null,
    locked: false,
    customData: {}, // Added missing customData property
    index: null,
  };

  return {
    ...base,
    type: "rabbit-color-palette",
    colors: colors.slice(0, 5), // Ensure exactly 5 colors
    rectangleHeight,
  };
};


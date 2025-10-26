/*
 * This file contains the last used color data for the application.
 * - Store the last used colors in map with keys as element types
 * - Provide functions to get and set last used colors
 * - must be updated when user changes color for an element
 */
export type LastUsedColor = {
  [elementType: string]: string;
};
export const lastUsedColors: LastUsedColor = {};

export const getLastUsedColor = (elementType: string): string => {
  return lastUsedColors[elementType];
};

export const setLastUsedColor = (elementType: string, color: string): void => {
  if (typeof color !== "string" || !color) {
    throw new Error("color must be a valid string");
  }

  lastUsedColors[elementType] = color;
};

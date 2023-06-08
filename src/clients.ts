import oc from "open-color";

type Colors = { background: string; stroke: string; text: string };

const colorAssignments = new Map<string, Colors>();
const goldenRatio = (1 + Math.sqrt(5)) / 2;

export const getClientColors = (userId: string) => {
  if (colorAssignments.has(userId)) {
    // If the color for the user is already assigned, return it
    return colorAssignments.get(userId)!;
  }
  // Generate a new color for the user with the largest possible hue distance
  const color = generateUniqueColors(colorAssignments.size);
  colorAssignments.set(userId, color);
  return color;
};

/**
 * Generate a unique color for a user based on the golden ratio.
 *
 * Generates a color with the largest possible hue distance from all other colors. Colors are generated based on number of assigned colors and should be unique up to several hundereds.
 */
const generateUniqueColors = (assignedCollorsSize: number): Colors => {
  // First collaberator gets black color
  if (assignedCollorsSize === 0) {
    return {
      background: "#1b1b1f",
      stroke: oc.white,
      text: oc.white,
    };
  }
  // Calculate the angle based on the golden ratio and number of assigned colors
  const hue = (assignedCollorsSize * (360 / goldenRatio)) % 360;

  const saturation = 100;
  const lightness = 80;

  return {
    background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    stroke: oc.white,
    text: "#1b1b1f",
  };
};

/**
 * returns first char, capitalized
 */
export const getNameInitial = (name?: string | null) => {
  // first char can be a surrogate pair, hence using codePointAt
  const firstCodePoint = name?.trim()?.codePointAt(0);
  return (
    firstCodePoint ? String.fromCodePoint(firstCodePoint) : "?"
  ).toUpperCase();
};

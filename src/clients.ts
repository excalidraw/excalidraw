import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  getAllColorsSpecificShade,
} from "./colors";
import { AppState } from "./types";

const BG_COLORS = getAllColorsSpecificShade(
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
);
const STROKE_COLORS = getAllColorsSpecificShade(
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
);

export const getClientColors = (clientId: string, appState: AppState) => {
  if (appState?.collaborators) {
    const currentUser = appState.collaborators.get(clientId);
    if (currentUser?.color) {
      return currentUser.color;
    }
  }
  // Naive way of getting an integer out of the clientId
  const sum = clientId.split("").reduce((a, str) => a + str.charCodeAt(0), 0);

  return {
    background: BG_COLORS[sum % BG_COLORS.length],
    stroke: STROKE_COLORS[sum % STROKE_COLORS.length],
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

import colors from "./colors";
import { AppState } from "./types";

export const getClientColors = (clientId: string, appState: AppState) => {
  if (appState?.collaborators) {
    const currentUser = appState.collaborators.get(clientId);
    if (currentUser?.color) {
      return currentUser.color;
    }
  }
  // Naive way of getting an integer out of the clientId
  const sum = clientId.split("").reduce((a, str) => a + str.charCodeAt(0), 0);

  // Skip transparent background.
  const backgrounds = colors.elementBackground.slice(1);
  const strokes = colors.elementStroke.slice(1);
  return {
    background: backgrounds[sum % backgrounds.length],
    stroke: strokes[sum % strokes.length],
  };
};

export const getClientInitials = (userName?: string) => {
  if (!userName) {
    return "?";
  }

  return userName[0].toUpperCase();
};

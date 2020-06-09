import colors from "./colors";

export const getClientColors = (clientId: string) => {
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

// @TODO: This is terrible for i18n. Also we probably want to get initials if words len > 1?
export const getClientShortName = (username: string) => {
  return username.substring(0, 2);
};

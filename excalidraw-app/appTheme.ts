import type { Theme } from "@excalidraw/element/types";

/** URL themes affect the initial session without replacing the saved preference. */
export const getThemeFromSearch = (search: string): Theme | undefined => {
  const theme = new URLSearchParams(search).get("theme");
  return theme === "dark" || theme === "light" ? theme : undefined;
};

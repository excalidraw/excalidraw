import { THEME } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

export const useHandleAppTheme = (initialTheme?: Theme) => {
  const [appTheme, setAppThemeState] = useState<Theme | "system">(() => {
    return (
      initialTheme ||
      (localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME) as
        | Theme
        | "system"
        | null) ||
      THEME.LIGHT
    );
  });
  const [editorTheme, setEditorTheme] = useState<Theme>(() =>
    appTheme === "system"
      ? getDarkThemeMediaQuery()?.matches
        ? THEME.DARK
        : THEME.LIGHT
      : appTheme,
  );

  const setAppTheme = useCallback((theme: Theme | "system") => {
    // Persist explicit choices, not a theme supplied by a shared URL.
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, theme);
    setAppThemeState(theme);
  }, []);

  useEffect(() => {
    const mediaQuery = getDarkThemeMediaQuery();

    const handleChange = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? THEME.DARK : THEME.LIGHT);
    };

    if (appTheme === "system") {
      mediaQuery?.addEventListener("change", handleChange);
    }

    return () => {
      mediaQuery?.removeEventListener("change", handleChange);
    };
  }, [appTheme]);

  useLayoutEffect(() => {
    if (appTheme === "system") {
      setEditorTheme(
        getDarkThemeMediaQuery()?.matches ? THEME.DARK : THEME.LIGHT,
      );
    } else {
      setEditorTheme(appTheme);
    }
  }, [appTheme]);

  return { editorTheme, appTheme, setAppTheme };
};

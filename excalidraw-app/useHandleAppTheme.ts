import { THEME } from "@excalidraw/excalidraw";
import { EVENT, CODES, KEYS } from "@excalidraw/common";
import { useEffect, useLayoutEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

export const useHandleAppTheme = () => {
  const [appTheme, setAppTheme] = useState<Theme | "system">(() => {
    return (
      (localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME) as
        | Theme
        | "system"
        | null) || THEME.LIGHT
    );
  });
  const [editorTheme, setEditorTheme] = useState<Theme>(THEME.LIGHT);

  useEffect(() => {
    const mediaQuery = getDarkThemeMediaQuery();

    const handleChange = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? THEME.DARK : THEME.LIGHT);
    };

    if (appTheme === "system") {
      mediaQuery?.addEventListener("change", handleChange);
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (
        !event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.shiftKey &&
        event.code === CODES.D
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setAppTheme(editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK);
      }
    };

    document.addEventListener(EVENT.KEYDOWN, handleKeydown, { capture: true });

    return () => {
      mediaQuery?.removeEventListener("change", handleChange);
      document.removeEventListener(EVENT.KEYDOWN, handleKeydown, {
        capture: true,
      });
    };
  }, [appTheme, editorTheme, setAppTheme]);

  useLayoutEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, appTheme);

    if (appTheme === "system") {
      setEditorTheme(
        getDarkThemeMediaQuery()?.matches ? THEME.DARK : THEME.LIGHT,
      );
    } else {
      setEditorTheme(appTheme);
    }
  }, [appTheme]);

  // Mirror the resolved theme onto the <html> element so app-shell chrome
  // outside the Excalidraw root (e.g. the TabBar) can react to runtime theme
  // toggles. The pre-mount script in index.html only sets this once on boot.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      editorTheme === THEME.DARK,
    );
  }, [editorTheme]);

  return { editorTheme, appTheme, setAppTheme };
};

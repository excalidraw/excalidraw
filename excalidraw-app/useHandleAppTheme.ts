import { THEME } from "@excalidraw/excalidraw";
import { EVENT, CODES, KEYS } from "@excalidraw/common";
import {
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useSyncExternalStore,
  useCallback,
} from "react";

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

  const systemTheme = useSyncExternalStore(
    useCallback((callback: () => void) => {
      const mediaQuery = getDarkThemeMediaQuery();
      mediaQuery?.addEventListener("change", callback);
      return () => mediaQuery?.removeEventListener("change", callback);
    }, []),
    () => (getDarkThemeMediaQuery()?.matches ? THEME.DARK : THEME.LIGHT),
  );

  const editorTheme = useMemo(() => {
    return appTheme === "system" ? systemTheme : appTheme;
  }, [appTheme, systemTheme]);

  useEffect(() => {
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
      document.removeEventListener(EVENT.KEYDOWN, handleKeydown, {
        capture: true,
      });
    };
  }, [editorTheme, setAppTheme]);

  useLayoutEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, appTheme);
  }, [appTheme]);

  return { editorTheme, appTheme, setAppTheme };
};

import { useEffect, useState } from "react";
import { FONT_FAMILY, DEFAULT_FONT_FAMILY } from "@excalidraw/common";

import { STORAGE_KEYS } from "./app_constants";

import type { FontFamilyValues } from "@excalidraw/element/types";

export const useHandleDefaultFontFamily = () => {
  const [defaultFontFamily, setDefaultFontFamily] = useState<FontFamilyValues>(
    () => {
      const stored = localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_DEFAULT_FONT_FAMILY,
      );
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed in FONT_FAMILY) {
          return parsed as FontFamilyValues;
        }
      }
      return DEFAULT_FONT_FAMILY;
    },
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEFAULT_FONT_FAMILY,
      defaultFontFamily.toString(),
    );
  }, [defaultFontFamily]);

  return { defaultFontFamily, setDefaultFontFamily };
};
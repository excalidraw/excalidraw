import { useCallback, useEffect, useRef, useState } from "react";

import { isCustomFontFamily } from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import {
  restoreCaretPosition,
  saveCaretPosition,
} from "../../hooks/useTextEditorFocus";

import type { Fonts } from "../../fonts";

/**
 * Minimum time a retry stays in the loading state. A resolution served from the
 * host's cache returns near-instantly, which would otherwise read as the retry
 * never having run.
 */
const RETRY_FEEDBACK_DURATION = 500;

const retryFeedbackDelay = (isRetry: boolean) =>
  isRetry
    ? new Promise<void>((resolve) =>
        setTimeout(resolve, RETRY_FEEDBACK_DURATION),
      )
    : null;

export type FontSelectionOptions = {
  keepOpen?: boolean;
};

type FontResolution = { type: "family"; family: CustomFontFamily } | null;

interface FontResolutionOptions {
  fonts: Fonts;
  registeredFonts: Fonts["registered"];
  failedResolutions: ReadonlyMap<string, unknown>;
  isEditingText: boolean;
  onSelect: (fontFamily: FontFamily, options?: FontSelectionOptions) => void;
}

export const useFontResolution = ({
  fonts,
  registeredFonts,
  failedResolutions,
  isEditingText,
  onSelect,
}: FontResolutionOptions) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [fontResolution, setFontResolution] = useState<FontResolution>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const resolvingFamily =
    fontResolution?.type === "family" ? fontResolution.family : null;

  const select = useCallback(
    (fontFamily: FontFamily, options?: FontSelectionOptions) => {
      // an open popup keeps the focus
      const savedCaret =
        isEditingText && !options?.keepOpen ? saveCaretPosition() : null;

      onSelect(fontFamily, options);

      if (savedCaret) {
        restoreCaretPosition(savedCaret);
      }
    },
    [isEditingText, onSelect],
  );

  const cancelResolution = useCallback(() => {
    requestIdRef.current += 1;
    setFontResolution(null);
  }, []);

  // a `fontProviders` change swaps the `fonts` instance (see
  // `AppFonts.onPropsUpdated`) - an in-flight resolution belongs to the old
  // provider set and must not apply its selection (or call its provider
  // callbacks) under the new one
  useEffect(() => {
    cancelResolution();
  }, [fonts, cancelResolution]);

  /** @returns whether the family got selected */
  const selectFontFamily = useCallback(
    async (fontFamily: FontFamily) => {
      const isRetry =
        isCustomFontFamily(fontFamily) && failedResolutions.has(fontFamily);

      if (!isCustomFontFamily(fontFamily) || registeredFonts.has(fontFamily)) {
        // applies right away - drop any in-flight resolution, so that its later
        // result cannot override this (more recent) selection
        cancelResolution();
        select(fontFamily, isRetry ? { keepOpen: true } : undefined);
        return true;
      }

      // last click wins, exactly as it does for registered families above -
      // bumping the request id invalidates any in-flight resolution's
      // selection, and the loading indicator moves to this row. The
      // superseded resolver still settles registry-side (a resolution is a
      // fact about the family, not about this click)
      const requestId = ++requestIdRef.current;
      const retryDelay = retryFeedbackDelay(isRetry);
      setFontResolution({ type: "family", family: fontFamily });
      try {
        const result = await fonts.registerCustomFamily(fontFamily);
        await retryDelay;

        if (requestIdRef.current !== requestId || result.status !== "success") {
          return false;
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setFontResolution(null);
        }
      }

      select(fontFamily, isRetry ? { keepOpen: true } : undefined);
      return true;
    },
    [cancelResolution, failedResolutions, fonts, registeredFonts, select],
  );

  const onSearchChange = useCallback((term: string) => {
    requestIdRef.current += 1;
    setFontResolution(null);
    setSearchTerm(term);
  }, []);

  return {
    inputRef,
    searchTerm,
    resolvingFamily,
    selectFontFamily,
    onSearchChange,
    cancelResolution,
  };
};

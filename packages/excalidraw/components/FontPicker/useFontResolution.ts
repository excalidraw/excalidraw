import { useCallback, useEffect, useRef, useState } from "react";

import {
  createProviderFontFamily,
  isCustomFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import {
  restoreCaretPosition,
  saveCaretPosition,
} from "../../hooks/useTextEditorFocus";

import type { Fonts } from "../../fonts";

import type { FontProviders } from "../../types";

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

type FontResolution =
  | { type: "family"; family: CustomFontFamily }
  | { type: "search" }
  | null;

interface FontResolutionOptions {
  fonts: Fonts;
  fontProviders?: FontProviders;
  registeredFonts: Fonts["registered"];
  failedResolutions: ReadonlyMap<string, unknown>;
  isEditingText: boolean;
  onSelect: (fontFamily: FontFamily, options?: FontSelectionOptions) => void;
}

export const useFontResolution = ({
  fonts,
  fontProviders,
  registeredFonts,
  failedResolutions,
  isEditingText,
  onSelect,
}: FontResolutionOptions) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [failedSearchTerm, setFailedSearchTerm] = useState<string | null>(null);
  const [fontResolution, setFontResolution] = useState<FontResolution>(null);
  const [newSceneFamilies, setNewSceneFamilies] = useState<Set<FontFamily>>(
    new Set(),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const isResolving = fontResolution !== null;
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

  const notifyNewFontUsed = useCallback(
    (provider: string, familyName: string) => {
      try {
        fontProviders?.[provider]?.onNewFontUsed?.(familyName);
      } catch (error) {
        // a host callback failing is not this selection's failure - contain
        // it instead of rejecting the (unawaited) event-handler promise
        console.error(
          `onNewFontUsed callback failed for provider "${provider}"`,
          error,
        );
      }
    },
    [fontProviders],
  );

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

  const selectSearchedFontFamily = useCallback(
    async (fontFamily: CustomFontFamily) => {
      const parsed = parseProviderFontFamily(fontFamily);
      if (
        (await selectFontFamily(fontFamily)) &&
        parsed &&
        // a suggestion may name an offered family, i.e. "Roboto" for "rovoto"
        !fontProviders?.[parsed.providerId]?.availableFonts.includes(
          parsed.familyName,
        )
      ) {
        notifyNewFontUsed(parsed.providerId, parsed.familyName);
      }
    },
    [fontProviders, notifyNewFontUsed, selectFontFamily],
  );

  /** @param providers the ones to probe for the typed name, in order */
  const resolveFontFamily = useCallback(
    async (providers: readonly string[]) => {
      const familyName = searchTerm.trim();
      if (!familyName || isResolving || !providers.length) {
        return;
      }

      const isRetry = failedSearchTerm === searchTerm;
      const retryDelay = retryFeedbackDelay(isRetry);
      const requestId = ++requestIdRef.current;
      setFontResolution({ type: "search" });

      try {
        for (const provider of providers) {
          const family = createProviderFontFamily(provider, familyName);
          // probing each provider for the searched name - a provider not
          // carrying it must not leave its catalog entry marked as failed, the
          // search reports its own failure via `failedSearchTerm`
          const result = await fonts.registerCustomFamily(family, {
            recordFailure: false,
          });
          if (requestIdRef.current !== requestId) {
            return;
          }
          if (result.status !== "success") {
            continue;
          }

          await retryDelay;
          if (requestIdRef.current !== requestId) {
            return;
          }
          setFailedSearchTerm(null);
          setNewSceneFamilies((families) => new Set(families).add(family));
          setSearchTerm("");
          if (inputRef.current) {
            inputRef.current.value = "";
          }

          select(family, { keepOpen: true });
          notifyNewFontUsed(provider, familyName);

          return;
        }

        await retryDelay;
        if (requestIdRef.current === requestId) {
          setFailedSearchTerm(searchTerm);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setFontResolution(null);
        }
      }
    },
    [
      failedSearchTerm,
      fonts,
      isResolving,
      notifyNewFontUsed,
      searchTerm,
      select,
    ],
  );

  const onSearchChange = useCallback((term: string) => {
    requestIdRef.current += 1;
    setFontResolution(null);
    setSearchTerm(term);
    setFailedSearchTerm(null);
  }, []);

  return {
    inputRef,
    searchTerm,
    failedSearchTerm,
    isResolving,
    resolvingFamily,
    newSceneFamilies,
    selectFontFamily,
    selectSearchedFontFamily,
    resolveFontFamily,
    onSearchChange,
    cancelResolution,
  };
};

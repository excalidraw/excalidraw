import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { createProviderFontFamily } from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import { getProvidedFonts } from "./useFontCatalog";

import type { Fonts } from "../../fonts";
import type { FontProviders } from "../../types";

/** fonts asked for at a time - see `FontProvider.loadMore` */
const PAGE_SIZE = 20;
/** pages asked for in a row while they bring nothing which isn't listed */
const MAX_PAGES_PER_LOAD = 5;

export type MoreFont = { value: CustomFontFamily; text: string };

interface MoreFontsOptions {
  fonts: Fonts;
  fontProviders?: FontProviders;
  /** the fonts the picker lists as of now - loading skips them */
  listedFamiliesRef: React.RefObject<ReadonlySet<FontFamily>>;
}

/** what got loaded so far, and where each provider's paging stands */
interface MoreFontsState {
  moreFonts: readonly MoreFont[];
  /**
   * the user asked for more at least once - from then on more gets loaded
   * as they reach the end of the list
   */
  isActive: boolean;
  offsets: Map<string, number>;
  exhausted: ReadonlySet<string>;
  loaded: Set<FontFamily>;
}

/**
 * Kept per `Fonts` instance, so that the fonts are still listed when the
 * picker reopens - for as long as the editor and its set of providers live
 * (a `fontProviders` change swaps the instance).
 */
const statesByFonts = new WeakMap<Fonts, MoreFontsState>();

const getMoreFontsState = (fonts: Fonts) => {
  let state = statesByFonts.get(fonts);
  if (!state) {
    state = {
      moreFonts: [],
      isActive: false,
      offsets: new Map(),
      exhausted: new Set(),
      loaded: new Set(),
    };
    statesByFonts.set(fonts, state);
  }
  return state;
};

/**
 * Fonts loaded on demand from the providers able to page through what they
 * have (`FontProvider.loadMore`), in the order they arrived - appended, never
 * re-sorted, so that loading doesn't move the fonts listed before.
 *
 * Kept when the picker closes - see `statesByFonts`.
 */
export const useMoreFonts = ({
  fonts,
  fontProviders,
  listedFamiliesRef,
}: MoreFontsOptions) => {
  const state = getMoreFontsState(fonts);
  // the state lives outside of React
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [isLoading, setIsLoading] = useState(false);

  const fontProvidersRef = useRef(fontProviders);
  fontProvidersRef.current = fontProviders;
  const controllerRef = useRef<AbortController | null>(null);

  // a page still on its way as the picker closes (or the `fonts` instance
  // gets swapped) is dropped, and asked for again next time
  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setIsLoading(false);
    },
    [fonts],
  );

  const { exhausted } = state;
  const hasMore = useMemo(
    () =>
      Object.entries(fontProviders ?? {}).some(
        ([providerId, provider]) =>
          provider.loadMore && !exhausted.has(providerId),
      ),
    [fontProviders, exhausted],
  );

  const loadMore = useCallback(async () => {
    if (controllerRef.current) {
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    state.isActive = true;

    const added: MoreFont[] = [];
    const exhausted = new Set(state.exhausted);
    try {
      // a page may hold nothing but fonts which are listed already (i.e. the
      // most popular ones, which a host tends to offer up front)
      for (let page = 0; page < MAX_PAGES_PER_LOAD && !added.length; page++) {
        const next = Object.entries(fontProvidersRef.current ?? {}).find(
          ([providerId, provider]) =>
            provider.loadMore && !exhausted.has(providerId),
        );
        if (!next) {
          break;
        }
        const [providerId, provider] = next;
        const offset = state.offsets.get(providerId) ?? 0;

        let provided: readonly unknown[] = [];
        try {
          const result = await provider.loadMore!({
            offset,
            limit: PAGE_SIZE,
            signal: controller.signal,
          });
          provided = Array.isArray(result) ? result : [];
        } catch (error) {
          if (!controller.signal.aborted) {
            // not asked again for as long as the list is kept
            console.error(
              `loading more fonts failed for provider "${providerId}"`,
              error,
            );
          }
        }
        if (controller.signal.aborted) {
          return;
        }

        state.offsets.set(providerId, offset + provided.length);
        if (provided.length < PAGE_SIZE) {
          exhausted.add(providerId);
        }
        for (const { id, label } of getProvidedFonts(provided)) {
          const value = createProviderFontFamily(providerId, id);
          if (
            !state.loaded.has(value) &&
            !listedFamiliesRef.current?.has(value)
          ) {
            state.loaded.add(value);
            added.push({ value, text: label });
          }
        }
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (added.length) {
          state.moreFonts = [...state.moreFonts, ...added];
        }
        if (exhausted.size !== state.exhausted.size) {
          state.exhausted = exhausted;
        }
        setIsLoading(false);
        rerender();
      }
    }
  }, [state, listedFamiliesRef]);

  return {
    moreFonts: state.moreFonts,
    hasMore,
    /** fonts got loaded on demand, and there are no more to load */
    isAtEnd: !hasMore && state.moreFonts.length > 0,
    isLoading,
    isActive: state.isActive,
    loadMore,
  };
};

import { useEffect, useMemo, useRef, useState } from "react";

import type { Fonts } from "../../fonts";

import type { FontProviders, FontSearchResult } from "../../types";

const SEARCH_DEBOUNCE = 200;

export type ProviderSearchResult = FontSearchResult & { providerId: string };

interface FontSearchOptions {
  fonts: Fonts;
  fontProviders?: FontProviders;
  searchTerm: string;
}

/** the providers' `search` results for the current term, in provider order */
export const useFontSearch = ({
  fonts,
  fontProviders,
  searchTerm,
}: FontSearchOptions) => {
  // `null` marks a failed search
  const [search, setSearch] = useState<{
    query: string;
    results: Map<string, FontSearchResult | null>;
  } | null>(null);
  // hosts may pass `fontProviders` inline - re-run on the provider set
  // (`fonts`, see `AppFonts.onPropsUpdated`), not on every new object
  const fontProvidersRef = useRef(fontProviders);
  fontProvidersRef.current = fontProviders;
  const query = searchTerm.trim();

  useEffect(() => {
    const providers = Object.entries(fontProvidersRef.current ?? {}).filter(
      ([, provider]) => provider.search,
    );
    if (!query || !providers.length) {
      return;
    }

    const controller = new AbortController();
    const settle = (providerId: string, result: FontSearchResult | null) =>
      setSearch((prev) => ({
        query,
        results: new Map(prev?.query === query ? prev.results : undefined).set(
          providerId,
          result,
        ),
      }));

    const timeout = setTimeout(() => {
      for (const [providerId, provider] of providers) {
        Promise.resolve()
          .then(() => provider.search!(query, { signal: controller.signal }))
          .then((result) => {
            if (!Array.isArray(result?.names)) {
              throw new Error("expected { kind, names }");
            }
            if (!controller.signal.aborted) {
              settle(providerId, result);
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted) {
              console.error(
                `font search failed for provider "${providerId}"`,
                error,
              );
              settle(providerId, null);
            }
          });
      }
    }, SEARCH_DEBOUNCE);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, fonts]);

  return useMemo(() => {
    const results: ProviderSearchResult[] = [];
    // providers to try the typed name with - those it may be news to
    const resolvableProviders: string[] = [];
    let isSearching = false;

    for (const [providerId, provider] of Object.entries(fontProviders ?? {})) {
      if (!provider.search) {
        resolvableProviders.push(providerId);
        continue;
      }
      const result =
        search?.query === query ? search.results.get(providerId) : undefined;
      if (result) {
        results.push({ ...result, providerId });
      } else if (result === null) {
        resolvableProviders.push(providerId);
      } else if (query) {
        isSearching = true;
      }
    }

    return { results, resolvableProviders, isSearching };
  }, [search, query, fontProviders]);
};

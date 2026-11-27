import fuzzy from "fuzzy";

import { deburr } from "./deburr";

// queries are normalized the same way everywhere so the match ignores case,
// diacritics and the separators people type into shortcuts ("Ctrl + F")
export const normalizeFuzzyQuery = (query: string) =>
  deburr(query.toLocaleLowerCase().replace(/[<>_| -]/g, ""));

/** the haystack is expected to be lowercased and deburred already */
export const fuzzyMatches = (query: string, haystack: string) =>
  fuzzy.test(normalizeFuzzyQuery(query), haystack);

/** returns the matching items, best match first */
export const fuzzyFilter = <T>(
  query: string,
  items: readonly T[],
  extract: (item: T) => string,
) =>
  fuzzy
    .filter(normalizeFuzzyQuery(query), [...items], { extract })
    .sort((a, b) => b.score - a.score)
    .map((result) => result.original);

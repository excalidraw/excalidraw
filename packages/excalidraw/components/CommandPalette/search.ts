import fuzzy from "fuzzy";

import { deburr } from "../../deburr";

const SEARCH_QUERY_CHARS_TO_IGNORE = /[<>_| -]/g;

export type SearchableItem = {
  haystack?: string;
};

export const normalizeSearchQuery = (query: string) => {
  return deburr(
    query.toLocaleLowerCase().replace(SEARCH_QUERY_CHARS_TO_IGNORE, ""),
  );
};

export const buildSearchHaystack = (
  ...parts: Array<string | string[] | null | undefined>
) => {
  return deburr(parts.flat().filter(Boolean).join(" ").toLocaleLowerCase());
};

export const filterItemsBySearch = <T extends SearchableItem>(
  query: string,
  items: T[],
) => {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return items;
  }

  return fuzzy
    .filter(normalizedQuery, items, {
      extract: (item) => item.haystack ?? "",
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.original);
};

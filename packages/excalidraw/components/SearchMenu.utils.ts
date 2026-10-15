/**
 * Utilities for stable search results ordering
 * Ensures search results remain in consistent order despite scene updates
 */

import type { SearchMatchItem } from "./SearchMenu";

/**
 * Sorts search matches by element.id and then by match index
 * Ensures stable ordering regardless of scene changes or element repositioning
 *
 * @param items - Array of search match items to sort
 * @returns - New sorted array maintaining stable order
 */
export const getStableMatches = (items: SearchMatchItem[]): SearchMatchItem[] => {
  return [...items].sort((a, b) => {
    // First, sort by element ID (stable identifier)
    const idComparison = a.element.id.localeCompare(b.element.id);
    if (idComparison !== 0) {
      return idComparison;
    }
    // If same element, sort by match index within the text
    return (a.index ?? 0) - (b.index ?? 0);
  });
};

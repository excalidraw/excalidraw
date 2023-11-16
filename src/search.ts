import MiniSearch, { Query, SearchOptions, SearchResult } from "minisearch";

import { ExcalidrawElement } from "./element/types";

const _miniSearch = new MiniSearch({
  fields: ["searchableText"],
  storeFields: ["id", "searchableText"],
});
let _miniSearchIndexedElemIds: { [k: string]: boolean } = {};

const _searchableElemType = {
  "text": true,
};

function isSearchableElem(elem: ExcalidrawElement) {
  return elem && elem.type in _searchableElemType;
}

function getSearchableText(elem: ExcalidrawElement) {
  if (elem && elem.type === "text") {
    return elem.text;
  }
  throw new Error(
    `getSearchableRecord: Not implemented type ${elem.type ?? "unknown"}!`,
  );
}

function getSearchableRecord(elem: ExcalidrawElement) {
  const searchableText = getSearchableText(elem);
  return { id: elem.id, searchableText };
}

export const textSearch = {
  DEFAULT_DEBOUNCE_TIME: 300,
  DEFAULT_FUZZY: 0.2,

  getSearchMatchKeys: (results: SearchResult[], elemId: string) => {
    const match = results.find((r) => r.id === elemId);
    return match ? Object.keys(match.match) : [];
  },

  isEqualMatchKeys: (keys1: string[], keys2: string[]) => {
    return JSON.stringify(keys1.sort()) === JSON.stringify(keys2.sort());
  },

  _highlightTextInCanvasContextWithKey: (
    text: string,
    context: CanvasRenderingContext2D,
    xOffset: number,
    yOffset: number,
    key: string,
  ) => {
    let start = 0;
    let pos = text.indexOf(key, start);
    const oldFillStyle = context.fillStyle;
    context.fillStyle = "yellow"; // TODO: what's this look alike in dark theme?
    while (pos >= 0) {
      const startX =
        xOffset + context.measureText(text.substring(0, pos)).width;
      const endX =
        xOffset +
        context.measureText(text.substring(0, pos + key.length)).width;
      context.fillRect(startX, yOffset - 20, endX - startX, 25);

      start = pos + key.length;
      pos = text.indexOf(key, start);
    }
    context.fillStyle = oldFillStyle;
  },

  highlightTextInCanvasContext: (
    text: string,
    context: CanvasRenderingContext2D,
    xOffset: number,
    yOffset: number,
    searchMatchKeys: string[],
  ) => {
    searchMatchKeys.forEach((key) =>
      textSearch._highlightTextInCanvasContextWithKey(
        text,
        context,
        xOffset,
        yOffset,
        key,
      ),
    );
  },

  search: (query: Query, searchOptions?: SearchOptions) =>
    _miniSearch.search(query, searchOptions),

  resetSearch: () => {
    _miniSearch.removeAll();
    _miniSearchIndexedElemIds = {};
  },

  replaceAllElements: (elems: readonly ExcalidrawElement[]) => {
    if (Array.isArray(elems)) {
      const elemsIdMap: { [k: string]: boolean } = {};

      elems.forEach((elem) => {
        elemsIdMap[elem.id] = true;

        if (isSearchableElem(elem)) {
          if (_miniSearch.has(elem.id)) {
            _miniSearch.discard(elem.id);
          }
          _miniSearch.add(getSearchableRecord(elem));
          _miniSearchIndexedElemIds[elem.id] = true;
        }
      });

      const toDiscardElemIds = Object.keys(_miniSearchIndexedElemIds).filter(
        (id) => !elemsIdMap[id],
      );
      toDiscardElemIds.forEach((id) => {
        _miniSearch.discard(id);
        delete _miniSearchIndexedElemIds[id];
      });
    }
  },
};

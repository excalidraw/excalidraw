import MiniSearch, { Query, SearchOptions } from "minisearch";

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

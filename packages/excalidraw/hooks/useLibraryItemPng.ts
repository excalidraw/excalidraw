import { useEffect, useState } from "react";
import { COLOR_PALETTE } from "../colors";
import { atom, useAtom } from "../editor-jotai";
import { exportToBlob } from "../../utils/export";
import type { LibraryItem } from "../types";

export type PngCacheItem = { blob: Blob; url: string };
export type PngCache = Map<LibraryItem["id"], PngCacheItem>;

export const libraryItemPngsCache = atom<PngCache>(new Map());

const exportLibraryItemToPng = async (elements: LibraryItem["elements"]) => {
  const blob = await exportToBlob({
    mimeType: "image/png",
    maxWidthOrHeight: 200,
    elements,
    appState: {
      exportBackground: false,
      viewBackgroundColor: COLOR_PALETTE.white,
    },
    files: null,
  });

  return { blob, url: URL.createObjectURL(blob) };
};

export const useLibraryItemPng = (
  id: LibraryItem["id"] | null,
  elements: LibraryItem["elements"] | undefined,
  pngCache: PngCache,
): PngCacheItem | undefined => {
  const [result, setResult] = useState<PngCacheItem>();

  useEffect(() => {
    if (elements) {
      if (id) {
        // Try to load cached svg
        const cachedBlob = pngCache.get(id);

        if (cachedBlob) {
          setResult(cachedBlob);
        } else {
          // When there is no svg in cache export it and save to cache
          (async () => {
            const item = await exportLibraryItemToPng(elements);

            if (item) {
              pngCache.set(id, item);
              setResult(item);
            }
          })();
        }
      } else {
        // When we have no id (usualy selected items from canvas) just export the svg
        (async () => {
          const blob = await exportLibraryItemToPng(elements);
          setResult(blob);
        })();
      }
    }
  }, [id, elements, pngCache, setResult]);

  return result;
};

export const useLibraryCache = () => {
  const [cache] = useAtom(libraryItemPngsCache);

  const clearLibraryCache = () => cache.clear();

  const deleteItemsFromLibraryCache = (items: LibraryItem["id"][]) => {
    items.forEach((item) => cache.delete(item));
  };

  return {
    clearLibraryCache,
    deleteItemsFromLibraryCache,
    cache,
  };
};

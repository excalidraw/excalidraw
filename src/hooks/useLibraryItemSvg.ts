import { atom, useAtom } from "jotai";
import { useEffect, useState } from "react";
import { COLOR_PALETTE } from "../colors";
import { exportToSvg } from "../packages/utils";
import { LibraryItem } from "../types";

export const libraryItemSvgsCache = atom<Map<LibraryItem["id"], SVGSVGElement>>(
  new Map(),
);

const exportLibraryItemToSvg = async (elements: LibraryItem["elements"]) => {
  return await exportToSvg({
    elements,
    appState: {
      exportBackground: false,
      viewBackgroundColor: COLOR_PALETTE.white,
    },
    files: null,
  });
};

export const useLibraryItemSvg = (
  id: LibraryItem["id"] | null,
  elements: LibraryItem["elements"] | undefined,
): SVGSVGElement | undefined => {
  const [svgCache, setSvgCache] = useAtom(libraryItemSvgsCache);
  const [svg, setSvg] = useState<SVGSVGElement>();

  useEffect(() => {
    if (elements) {
      if (id) {
        // Try to load cached svg
        const cachedSvg = svgCache.get(id);

        if (cachedSvg) {
          setSvg(cachedSvg);
        } else {
          // When there is no svg in cache export it and save to cache
          (async () => {
            const exportedSvg = await exportLibraryItemToSvg(elements);

            if (exportedSvg) {
              svgCache.set(id, exportedSvg);
              setSvg(exportedSvg);
            }
          })();
        }
      } else {
        // When we have no id (usualy selected items from canvas) just export the svg
        (async () => {
          const exportedSvg = await exportLibraryItemToSvg(elements);
          setSvg(exportedSvg);
        })();
      }
    }
  }, [id, elements, svgCache, setSvgCache, setSvg]);

  return svg;
};

export const useLibraryCache = () => {
  const [svgCache] = useAtom(libraryItemSvgsCache);

  const clearLibraryCache = () => svgCache.clear();

  const deleteItemsFromLibraryCache = (items: LibraryItem["id"][]) => {
    items.forEach((item) => svgCache.delete(item));
  };

  return {
    clearLibraryCache,
    deleteItemsFromLibraryCache,
    svgCache,
  };
};

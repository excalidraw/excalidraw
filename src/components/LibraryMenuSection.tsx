import React, { memo, ReactNode, useEffect, useMemo, useState } from "react";
import { EmptyLibraryUnit, LibraryUnit } from "./LibraryUnit";
import { LibraryItem } from "../types";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { SvgCache } from "../hooks/useLibraryItemSvg";
import { useTransition } from "../hooks/useTransition";

const ITEMS_RENDERED_PER_BATCH = 17;
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

type LibraryOrPendingItem = (
  | LibraryItem
  | /* pending library item */ {
      id: null;
      elements: readonly NonDeleted<ExcalidrawElement>[];
    }
)[];

interface Props {
  items: LibraryOrPendingItem;
  onClick: (id: LibraryItem["id"] | null) => void;
  onItemSelectToggle: (id: LibraryItem["id"], event: React.MouseEvent) => void;
  onItemDrag: (id: LibraryItem["id"], event: React.DragEvent) => void;
  isItemSelected: (id: LibraryItem["id"] | null) => boolean;
  svgCache: SvgCache;
}

export const LibraryMenuSectionGrid = ({
  children,
}: {
  children: ReactNode;
}) => {
  return <div className="library-menu-items-container__grid">{children}</div>;
};

export const LibraryMenuSection = memo(
  ({
    items,
    onItemSelectToggle,
    onItemDrag,
    isItemSelected,
    onClick,
    svgCache,
  }: Props) => {
    const [, startTransition] = useTransition();
    const [index, setIndex] = useState(0);

    const itemsRenderedPerBatch = useMemo(() => {
      return svgCache.size === 0
        ? ITEMS_RENDERED_PER_BATCH
        : CACHED_ITEMS_RENDERED_PER_BATCH;
    }, [svgCache]);

    useEffect(() => {
      if (index < items.length) {
        startTransition(() => {
          setIndex(index + itemsRenderedPerBatch);
        });
      }
    }, [index, items.length, startTransition, itemsRenderedPerBatch]);

    return (
      <>
        {items.map((item, i) => {
          return i < index ? (
            <LibraryUnit
              elements={item?.elements}
              isPending={!item?.id && !!item?.elements}
              onClick={onClick}
              svgCache={svgCache}
              id={item?.id}
              selected={isItemSelected(item.id)}
              onToggle={onItemSelectToggle}
              onDrag={onItemDrag}
              key={item?.id ?? i}
            />
          ) : (
            <EmptyLibraryUnit key={i} />
          );
        })}
      </>
    );
  },
);

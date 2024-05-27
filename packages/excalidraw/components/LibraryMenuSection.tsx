import type { ReactNode } from "react";
import React, { memo, useEffect, useState } from "react";
import { EmptyLibraryUnit, LibraryUnit } from "./LibraryUnit";
import type { LibraryItem } from "../types";
import type { ExcalidrawElement, NonDeleted } from "../element/types";
import type { SvgCache } from "../hooks/useLibraryItemSvg";
import { useTransition } from "../hooks/useTransition";

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
  itemsRenderedPerBatch: number;
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
    itemsRenderedPerBatch,
  }: Props) => {
    const [, startTransition] = useTransition();
    const [index, setIndex] = useState(0);

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

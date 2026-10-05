import clsx from "clsx";
import React, { memo, useEffect, useState } from "react";

import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";

import { useTransition } from "../hooks/useTransition";

import { EmptyLibraryUnit, LibraryUnit } from "./LibraryUnit";

import type { SvgCache } from "../hooks/useLibraryItemSvg";
import type { LibraryItem } from "../types";
import type { ReactNode } from "react";

type LibraryOrPendingItem = readonly (
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
  /** larger items with their name below */
  showNames?: boolean;
}

export const LibraryMenuSectionGrid = ({
  children,
  showNames,
}: {
  children: ReactNode;
  /** fewer columns, for items rendered with `showNames` */
  showNames?: boolean;
}) => {
  return (
    <div
      className={clsx("library-menu-items-container__grid", {
        "library-menu-items-container__grid--named": showNames,
      })}
    >
      {children}
    </div>
  );
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
    showNames,
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
              name={"name" in item ? item.name : undefined}
              showName={showNames}
              selected={isItemSelected(item.id)}
              onToggle={onItemSelectToggle}
              onDrag={onItemDrag}
              key={item?.id ?? i}
            />
          ) : (
            <EmptyLibraryUnit key={i} showName={showNames} />
          );
        })}
      </>
    );
  },
);

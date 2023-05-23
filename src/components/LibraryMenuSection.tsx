import React, { useEffect, useState, useTransition } from "react";
import { LibraryUnit } from "./LibraryUnit";
import { LibraryItem } from "../types";
import Stack from "./Stack";
import Spinner from "./Spinner";
import clsx from "clsx";
import { ExcalidrawElement, NonDeleted } from "../element/types";

const ITEMS_PER_ROW = 4;
const ROWS_RENDERED_PER_BATCH = 4;

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
}

function LibraryRow({
  items,
  onItemSelectToggle,
  onItemDrag,
  isItemSelected,
  onClick,
}: Props) {
  return (
    <Stack.Row gap={1}>
      {items.map((item) => (
        <Stack.Col key={item.id}>
          <LibraryUnit
            elements={item?.elements}
            isPending={!item?.id && !!item?.elements}
            onClick={onClick}
            id={item?.id || null}
            selected={isItemSelected(item.id)}
            onToggle={onItemSelectToggle}
            onDrag={onItemDrag}
          />
        </Stack.Col>
      ))}
    </Stack.Row>
  );
}

const EmptyLibraryRow = ({ showSpinner }: { showSpinner: boolean }) => (
  <Stack.Row gap={1}>
    <Stack.Col>
      <div className={clsx("library-unit")}>
        {showSpinner && <Spinner synchronized />}
      </div>
    </Stack.Col>
  </Stack.Row>
);

function LibraryMenuSection({
  items,
  onItemSelectToggle,
  onItemDrag,
  isItemSelected,
  onClick,
}: Props) {
  const rows = Math.ceil(items.length / ITEMS_PER_ROW);
  const [, startTransition] = useTransition();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < rows) {
      startTransition(() => {
        setIndex(index + ROWS_RENDERED_PER_BATCH);
      });
    }
  }, [index, rows, startTransition]);

  return (
    <>
      {Array.from({ length: rows }).map((_, i) =>
        i < index ? (
          <LibraryRow
            key={i}
            items={items.slice(i * ITEMS_PER_ROW, (i + 1) * ITEMS_PER_ROW)}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onClick}
            isItemSelected={isItemSelected}
          />
        ) : (
          <EmptyLibraryRow key={i} showSpinner={i === index} />
        ),
      )}
    </>
  );
}

export default LibraryMenuSection;

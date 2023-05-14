import React, { useEffect, useState, useTransition } from "react";
import { LibraryUnit } from "./LibraryUnit";
import { LibraryItem } from "../types";
import Stack from "./Stack";
import Spinner from "./Spinner";
import clsx from "clsx";
import { ExcalidrawElement, NonDeleted } from "../element/types";

type LibraryOrPendingItem = (
  | LibraryItem
  | /* pending library item */ {
      id: null;
      elements: readonly NonDeleted<ExcalidrawElement>[];
    }
)[];

interface Props {
  items: LibraryOrPendingItem;
  itemsPerRow: number;
}

interface LibraryRowProps {
  items: LibraryOrPendingItem;
  onClick?: () => void;
}

function LibraryRow({ items, onClick }: LibraryRowProps) {
  return (
    <>
      {items.map((item) => (
        <Stack.Col key={item.id}>
          <LibraryUnit
            elements={item?.elements}
            isPending={!item?.id && !!item?.elements}
            onClick={onClick || (() => {})}
            id={item?.id || null}
            selected={false}
            onToggle={() => {}}
            onDrag={() => {}}
          />
        </Stack.Col>
      ))}
    </>
  );
}

function LibraryMenuSection({ items, itemsPerRow }: Props) {
  const rows = Math.ceil(items.length / itemsPerRow);
  const [_, startTransition] = useTransition();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < rows) {
      startTransition(() => {
        setIndex(index + 1);
      });
    }
  }, [index, rows, startTransition]);

  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>
          {i < index ? (
            <Stack.Row gap={1}>
              <LibraryRow
                items={items.slice(i * itemsPerRow, (i + 1) * itemsPerRow)}
              />
            </Stack.Row>
          ) : (
            <Stack.Row gap={1}>
              <Stack.Col>
                <div className={clsx("library-unit")}>
                  <Spinner />
                </div>
              </Stack.Col>
            </Stack.Row>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

export default LibraryMenuSection;

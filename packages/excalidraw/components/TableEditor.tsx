import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import {
  applyDarkModeFilter,
  getFontString,
  KEYS,
  sceneCoordsToViewportCoords,
  THEME,
} from "@excalidraw/common";
import { getTableKeyFontSize, getTableLayout } from "@excalidraw/element";

import type { TableCell } from "@excalidraw/element";
import type {
  ExcalidrawTableElement,
  ExcalidrawTableRow,
  NonDeleted,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { useExcalidrawAppState } from "./App";
import { PlusIcon, CloseIcon } from "./icons";

import "./TableEditor.scss";

import type { AppTable } from "./App.table";

/** suggestions offered in the key column (constraints first, then types) */
const KEY_SUGGESTIONS = [
  "PK",
  "FK",
  "UK",
  "NN",
  "int",
  "bigint",
  "uuid",
  "varchar",
  "text",
  "boolean",
  "date",
  "timestamp",
  "decimal",
  "json",
];

type Column = "key" | "name";

const cellId = (cell: TableCell) =>
  cell.type === "title" ? "title" : `${cell.rowId}:${cell.type}`;

/**
 * Edits a table's cells in place. The canvas keeps drawing the table's shape
 * (so the hand-drawn look and the live auto-resize stay visible) and leaves
 * out its text, which these inputs render instead at the exact same layout —
 * every keystroke is written to the element, so the table grows as you type
 * and bound arrows follow along.
 */
export const TableEditor = ({
  table,
  controller,
}: {
  table: NonDeleted<ExcalidrawTableElement>;
  controller: AppTable;
}) => {
  const appState = useExcalidrawAppState();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  /** the cell to focus once the next render has mounted it */
  const pendingFocus = useRef<{ cell: TableCell; select: boolean } | null>({
    cell: controller.initialCell,
    select: true,
  });

  // the latest table, for handlers that run between renders
  const tableRef = useRef(table);
  tableRef.current = table;

  const layout = getTableLayout(table);

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) {
      return;
    }
    const input =
      inputs.current.get(cellId(pending.cell)) ?? inputs.current.get("title");
    if (input) {
      pendingFocus.current = null;
      input.focus({ preventScroll: true });
      if (pending.select) {
        input.select();
      } else {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  });

  // --- finishing ---------------------------------------------------------------

  useEffect(() => {
    // a press anywhere outside the editor (canvas, toolbar, …) finishes it
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        controller.stopEditing();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [controller]);

  // --- content updates -----------------------------------------------------------

  const setRows = useCallback(
    (rows: readonly ExcalidrawTableRow[]) => {
      controller.updateContent(tableRef.current, { rows });
    },
    [controller],
  );

  const updateRow = (rowId: string, column: Column, value: string) => {
    setRows(
      tableRef.current.rows.map((row) =>
        row.id === rowId ? { ...row, [column]: value } : row,
      ),
    );
  };

  const insertRow = (index: number, focusColumn: Column = "name") => {
    const row = controller.newRow();
    const rows = [...tableRef.current.rows];
    rows.splice(index, 0, row);
    pendingFocus.current = {
      cell: { type: focusColumn, rowId: row.id },
      select: false,
    };
    setRows(rows);
  };

  const removeRow = (rowId: string, focusAfter = true) => {
    const rows = tableRef.current.rows;
    const index = rows.findIndex((row) => row.id === rowId);
    if (index === -1) {
      return;
    }
    if (focusAfter) {
      const neighbor = rows[index - 1] ?? rows[index + 1];
      pendingFocus.current = {
        cell: neighbor
          ? { type: "name", rowId: neighbor.id }
          : { type: "title" },
        select: false,
      };
    }
    setRows(rows.filter((row) => row.id !== rowId));
  };

  const moveRow = (rowId: string, delta: -1 | 1, column: Column) => {
    const rows = [...tableRef.current.rows];
    const index = rows.findIndex((row) => row.id === rowId);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= rows.length) {
      return;
    }
    [rows[index], rows[target]] = [rows[target], rows[index]];
    pendingFocus.current = { cell: { type: column, rowId }, select: false };
    setRows(rows);
  };

  // --- keyboard navigation -------------------------------------------------------

  /** title → key₀ → name₀ → key₁ → … in reading order */
  const getCellOrder = (): TableCell[] => [
    { type: "title" },
    ...tableRef.current.rows.flatMap((row): TableCell[] => [
      { type: "key", rowId: row.id },
      { type: "name", rowId: row.id },
    ]),
  ];

  const focusCell = (cell: TableCell, select = true) => {
    const input = inputs.current.get(cellId(cell));
    if (input) {
      input.focus({ preventScroll: true });
      if (select) {
        input.select();
      }
    }
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    cell: TableCell,
  ) => {
    // keep the editor's keys away from the canvas shortcuts
    event.stopPropagation();

    if (event.nativeEvent.isComposing) {
      return;
    }

    const rows = tableRef.current.rows;
    const rowIndex =
      cell.type === "title"
        ? -1
        : rows.findIndex((row) => row.id === cell.rowId);

    if (
      event.key === KEYS.ESCAPE ||
      (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD])
    ) {
      event.preventDefault();
      controller.stopEditing();
      return;
    }

    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      if (cell.type === "title") {
        // straight into the first field, creating it on an empty table
        if (rows.length) {
          focusCell({ type: "name", rowId: rows[0].id });
        } else {
          insertRow(0);
        }
      } else {
        insertRow(rowIndex + 1, event.shiftKey ? "key" : "name");
      }
      return;
    }

    if (event.key === KEYS.TAB) {
      event.preventDefault();
      const order = getCellOrder();
      const index = order.findIndex((c) => cellId(c) === cellId(cell));
      const next = order[index + (event.shiftKey ? -1 : 1)];
      if (next) {
        focusCell(next);
      } else if (!event.shiftKey) {
        // tabbing past the last cell adds a field
        insertRow(rows.length, "key");
      }
      return;
    }

    if (
      (event.key === KEYS.ARROW_UP || event.key === KEYS.ARROW_DOWN) &&
      cell.type !== "title"
    ) {
      event.preventDefault();
      const delta = event.key === KEYS.ARROW_UP ? -1 : 1;
      if (event.altKey) {
        moveRow(cell.rowId, delta, cell.type);
        return;
      }
      const target = rows[rowIndex + delta];
      focusCell(
        target ? { type: cell.type, rowId: target.id } : { type: "title" },
      );
      return;
    }

    if (event.key === KEYS.ARROW_DOWN && cell.type === "title" && rows[0]) {
      event.preventDefault();
      focusCell({ type: "name", rowId: rows[0].id });
      return;
    }

    if (event.key === KEYS.BACKSPACE && cell.type !== "title") {
      const row = rows[rowIndex];
      const input = event.currentTarget;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if (!row.key && !row.name) {
        // an empty row goes away
        event.preventDefault();
        removeRow(row.id);
      } else if (cell.type === "name" && atStart) {
        // step back into the key column
        event.preventDefault();
        const keyInput = inputs.current.get(
          cellId({ type: "key", rowId: row.id }),
        );
        keyInput?.focus({ preventScroll: true });
        keyInput?.setSelectionRange(row.key.length, row.key.length);
      }
    }
  };

  // --- positioning ---------------------------------------------------------------

  const { zoom } = appState;
  const { x: left, y: top } = sceneCoordsToViewportCoords(
    { sceneX: table.x, sceneY: table.y },
    appState,
  );
  const isDarkMode = appState.theme === THEME.DARK;
  const color = applyDarkModeFilter(table.strokeColor, isDarkMode);
  const font = getFontString(table);
  const keyFont = getFontString({
    fontSize: getTableKeyFontSize(table.fontSize),
    fontFamily: table.fontFamily,
  });
  const lineHeightPx = table.fontSize * layout.lineHeight;
  const keyLineHeightPx = layout.keyFontSize * layout.lineHeight;
  const datalistId = `excalidraw-table-keys-${table.id}`;

  const registerInput =
    (cell: TableCell) => (input: HTMLInputElement | null) => {
      if (input) {
        inputs.current.set(cellId(cell), input);
      } else {
        inputs.current.delete(cellId(cell));
      }
    };

  return (
    <div
      ref={rootRef}
      className={clsx("excalidraw-table-editor", {
        "excalidraw-table-editor--dark": isDarkMode,
      })}
      style={{
        left: left - appState.offsetLeft,
        top: top - appState.offsetTop,
        width: table.width,
        height: table.height,
        transform: `scale(${zoom.value})`,
        transformOrigin: "0 0",
        ["--table-editor-zoom" as string]: zoom.value,
        ["--table-editor-color" as string]: color,
        opacity: table.opacity / 100,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className="excalidraw-table-editor__frame"
        style={{
          // rotated about the table's center, as on the canvas
          transform: `rotate(${table.angle}rad)`,
          transformOrigin: `${table.width / 2}px ${table.height / 2}px`,
        }}
      >
        <input
          ref={registerInput({ type: "title" })}
          className="excalidraw-table-editor__input excalidraw-table-editor__title"
          style={{
            left: layout.title.x,
            top: layout.title.y,
            width: layout.title.width,
            height: lineHeightPx,
            lineHeight: `${lineHeightPx}px`,
            font,
          }}
          value={table.title}
          placeholder={t("table.titlePlaceholder")}
          spellCheck={false}
          autoComplete="off"
          aria-label={t("table.titlePlaceholder")}
          onChange={(event) =>
            controller.updateContent(tableRef.current, {
              title: event.target.value,
            })
          }
          onKeyDown={(event) => onKeyDown(event, { type: "title" })}
        />

        {layout.rows.map(({ row, key, name, keyTextY, nameTextY }) => (
          <div key={row.id} className="excalidraw-table-editor__row">
            <input
              ref={registerInput({ type: "key", rowId: row.id })}
              className="excalidraw-table-editor__input excalidraw-table-editor__key"
              style={{
                left: key.x + layout.paddingX,
                top: keyTextY,
                // up to the column divider, so placeholders aren't clipped
                width: key.width - layout.paddingX - 2 * layout.unit,
                height: keyLineHeightPx,
                lineHeight: `${keyLineHeightPx}px`,
                font: keyFont,
              }}
              value={row.key}
              list={datalistId}
              placeholder={t("table.keyPlaceholder")}
              spellCheck={false}
              autoComplete="off"
              aria-label={t("table.keyPlaceholder")}
              onChange={(event) => updateRow(row.id, "key", event.target.value)}
              onKeyDown={(event) =>
                onKeyDown(event, { type: "key", rowId: row.id })
              }
            />
            <input
              ref={registerInput({ type: "name", rowId: row.id })}
              className="excalidraw-table-editor__input excalidraw-table-editor__name"
              style={{
                left: name.x + layout.paddingX,
                top: nameTextY,
                width: name.width - layout.paddingX * 1.5,
                height: lineHeightPx,
                lineHeight: `${lineHeightPx}px`,
                font,
              }}
              value={row.name}
              placeholder={t("table.namePlaceholder")}
              spellCheck={false}
              autoComplete="off"
              aria-label={t("table.namePlaceholder")}
              onChange={(event) =>
                updateRow(row.id, "name", event.target.value)
              }
              onKeyDown={(event) =>
                onKeyDown(event, { type: "name", rowId: row.id })
              }
            />
            <button
              type="button"
              tabIndex={-1}
              className="excalidraw-table-editor__remove"
              style={{ top: key.y + key.height / 2, left: table.width }}
              title={t("table.removeRow")}
              aria-label={t("table.removeRow")}
              onClick={() => removeRow(row.id, false)}
            >
              {CloseIcon}
            </button>
          </div>
        ))}

        {!table.collapsed && (
          <button
            type="button"
            className="excalidraw-table-editor__add"
            style={{ top: table.height, left: table.width / 2 }}
            onClick={() => insertRow(tableRef.current.rows.length, "key")}
          >
            {PlusIcon}
            <span>{t("table.addRow")}</span>
          </button>
        )}
      </div>

      <datalist id={datalistId}>
        {KEY_SUGGESTIONS.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
};

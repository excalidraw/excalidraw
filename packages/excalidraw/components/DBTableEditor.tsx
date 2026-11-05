import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  applyDarkModeFilter,
  getFontString,
  KEYS,
  sceneCoordsToViewportCoords,
  THEME,
} from "@excalidraw/common";
import { getDBTableKeyFontSize, getDBTableLayout } from "@excalidraw/element";

import type { DBTableCell, DBTableColumn } from "@excalidraw/element";
import type {
  ExcalidrawDBTableElement,
  ExcalidrawDBTableRow,
  NonDeleted,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { useExcalidrawAppState } from "./App";
import { PlusIcon, CloseIcon } from "./icons";

import "./DBTableEditor.scss";

import type { AppDBTable } from "./App.dbTable";

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

type Column = DBTableColumn;

/** two panes, the right one filled: the canvas examples toggle's glyph */
const ExamplesIcon = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path
      d="M8 2.75h3.75a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H8z"
      fill="currentColor"
      fillOpacity="0.35"
      stroke="none"
    />
    <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5" />
    <path d="M8 2.75v10.5" />
  </svg>
);

const DragHandleIcon = (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    {[5, 8, 11].flatMap((y) =>
      [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />),
    )}
  </svg>
);

const cellId = (cell: DBTableCell) =>
  cell.type === "title" ? "title" : `${cell.rowId}:${cell.type}`;

/**
 * Edits a table's cells in place. The canvas keeps drawing the table's shape
 * (so the hand-drawn look and the live auto-resize stay visible) and leaves
 * out its text, which these inputs render instead at the exact same layout —
 * every keystroke is written to the element, so the table grows as you type
 * and bound arrows follow along.
 */
export const DBTableEditor = ({
  table,
  controller,
}: {
  table: NonDeleted<ExcalidrawDBTableElement>;
  controller: AppDBTable;
}) => {
  const appState = useExcalidrawAppState();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  /** the cell to focus once the next render has mounted it */
  const pendingFocus = useRef<{ cell: DBTableCell; select: boolean } | null>({
    cell: controller.initialCell,
    select: true,
  });

  // the latest table, for handlers that run between renders
  const tableRef = useRef(table);
  tableRef.current = table;

  const layout = getDBTableLayout(table);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const appStateZoomRef = useRef(appState.zoom.value);
  appStateZoomRef.current = appState.zoom.value;

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
    (rows: readonly ExcalidrawDBTableRow[]) => {
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

  /** drags a row by its handle; it is reordered live as the pointer crosses rows */
  const startRowDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    rowId: string,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startIndex = tableRef.current.rows.findIndex((r) => r.id === rowId);
    const rowHeight = getDBTableLayout(tableRef.current).rows[0]?.rect.height;
    if (startIndex === -1 || !rowHeight) {
      return;
    }
    const { angle } = tableRef.current;
    // pointer travel along the table's own (rotated) vertical axis, in scene px
    const along = (e: PointerEvent) =>
      (-e.clientX * Math.sin(angle) + e.clientY * Math.cos(angle)) /
      appStateZoomRef.current;
    const startAlong = along(event.nativeEvent);
    setDraggedRowId(rowId);

    const onMove = (e: PointerEvent) => {
      const rows = [...tableRef.current.rows];
      const from = rows.findIndex((r) => r.id === rowId);
      const to = Math.max(
        0,
        Math.min(
          rows.length - 1,
          startIndex + Math.round((along(e) - startAlong) / rowHeight),
        ),
      );
      if (from === -1 || from === to) {
        return;
      }
      rows.splice(to, 0, rows.splice(from, 1)[0]);
      setRows(rows);
    };
    const onEnd = () => {
      setDraggedRowId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  // --- keyboard navigation -------------------------------------------------------

  /** title → key₀ → name₀ (→ example₀) → key₁ → … in reading order */
  const getCellOrder = (): DBTableCell[] => [
    { type: "title" },
    ...tableRef.current.rows.flatMap((row): DBTableCell[] => [
      { type: "key", rowId: row.id },
      { type: "name", rowId: row.id },
      ...(tableRef.current.showExamples
        ? [{ type: "example", rowId: row.id } as const]
        : []),
    ]),
  ];

  /**
   * Shows or hides the examples column from the editor. Shown, the caret
   * moves to the first field still missing an example; hidden while an
   * example was being edited, it moves to that field's name.
   */
  const toggleExamples = () => {
    const focusedRowId = (() => {
      for (const [id, input] of inputs.current) {
        if (input === document.activeElement && id !== "title") {
          return id.slice(0, id.lastIndexOf(":"));
        }
      }
      return null;
    })();
    const isShown = controller.toggleExamples(tableRef.current, {
      startEditing: false,
    });
    const rows = tableRef.current.rows;
    if (isShown) {
      const target =
        rows.find((row) => !row.example?.trim()) ??
        rows.find((row) => row.id === focusedRowId) ??
        rows[0];
      pendingFocus.current = target
        ? { cell: { type: "example", rowId: target.id }, select: true }
        : null;
    } else {
      pendingFocus.current = {
        cell: focusedRowId
          ? { type: "name", rowId: focusedRowId }
          : { type: "title" },
        select: false,
      };
    }
  };

  const focusCell = (cell: DBTableCell, select = true) => {
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
    cell: DBTableCell,
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
      const previousColumn =
        cell.type === "example" ? "name" : cell.type === "name" ? "key" : null;
      if (!row.key && !row.name && !row.example) {
        // an empty row goes away
        event.preventDefault();
        removeRow(row.id);
      } else if (previousColumn && atStart) {
        // step back into the column on the left
        event.preventDefault();
        const previousInput = inputs.current.get(
          cellId({ type: previousColumn, rowId: row.id }),
        );
        const length = row[previousColumn]?.length ?? 0;
        previousInput?.focus({ preventScroll: true });
        previousInput?.setSelectionRange(length, length);
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
    fontSize: getDBTableKeyFontSize(table.fontSize),
    fontFamily: table.fontFamily,
  });
  const lineHeightPx = table.fontSize * layout.lineHeight;
  const keyLineHeightPx = layout.keyFontSize * layout.lineHeight;
  const datalistId = `excalidraw-dbtable-keys-${table.id}`;

  const registerInput =
    (cell: DBTableCell) => (input: HTMLInputElement | null) => {
      if (input) {
        inputs.current.set(cellId(cell), input);
      } else {
        inputs.current.delete(cellId(cell));
      }
    };

  return (
    <div
      ref={rootRef}
      className={clsx("excalidraw-dbtable-editor", {
        "excalidraw-dbtable-editor--dark": isDarkMode,
      })}
      style={{
        left: left - appState.offsetLeft,
        top: top - appState.offsetTop,
        width: table.width,
        height: table.height,
        transform: `scale(${zoom.value})`,
        transformOrigin: "0 0",
        ["--dbtable-editor-zoom" as string]: zoom.value,
        ["--dbtable-editor-color" as string]: color,
        opacity: table.opacity / 100,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className="excalidraw-dbtable-editor__frame"
        style={{
          // rotated about the table's center, as on the canvas
          transform: `rotate(${table.angle}rad)`,
          transformOrigin: `${table.width / 2}px ${table.height / 2}px`,
        }}
      >
        <input
          ref={registerInput({ type: "title" })}
          className="excalidraw-dbtable-editor__input excalidraw-dbtable-editor__title"
          style={{
            left: layout.title.x,
            top: layout.title.y,
            width: layout.title.width,
            height: lineHeightPx,
            lineHeight: `${lineHeightPx}px`,
            font,
          }}
          value={table.title}
          placeholder={t("dbTable.titlePlaceholder")}
          spellCheck={false}
          autoComplete="off"
          aria-label={t("dbTable.titlePlaceholder")}
          onChange={(event) =>
            controller.updateContent(tableRef.current, {
              title: event.target.value,
            })
          }
          onKeyDown={(event) => onKeyDown(event, { type: "title" })}
        />

        {layout.rows.map(({ row, key, name, example, keyTextY, nameTextY }) => (
          <div
            key={row.id}
            className={clsx("excalidraw-dbtable-editor__row", {
              "excalidraw-dbtable-editor__row--dragged":
                draggedRowId === row.id,
            })}
          >
            <button
              type="button"
              tabIndex={-1}
              className="excalidraw-dbtable-editor__drag"
              style={{ top: key.y + key.height / 2, left: 0 }}
              title={t("dbTable.dragRow")}
              aria-label={t("dbTable.dragRow")}
              onPointerDown={(event) => startRowDrag(event, row.id)}
            >
              {DragHandleIcon}
            </button>
            <input
              ref={registerInput({ type: "key", rowId: row.id })}
              className="excalidraw-dbtable-editor__input excalidraw-dbtable-editor__key"
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
              placeholder={t("dbTable.keyPlaceholder")}
              spellCheck={false}
              autoComplete="off"
              aria-label={t("dbTable.keyPlaceholder")}
              onChange={(event) => updateRow(row.id, "key", event.target.value)}
              onKeyDown={(event) =>
                onKeyDown(event, { type: "key", rowId: row.id })
              }
            />
            <input
              ref={registerInput({ type: "name", rowId: row.id })}
              className="excalidraw-dbtable-editor__input excalidraw-dbtable-editor__name"
              style={{
                left: name.x + layout.paddingX,
                top: nameTextY,
                width: name.width - layout.paddingX * 1.5,
                height: lineHeightPx,
                lineHeight: `${lineHeightPx}px`,
                font,
              }}
              value={row.name}
              placeholder={t("dbTable.namePlaceholder")}
              spellCheck={false}
              autoComplete="off"
              aria-label={t("dbTable.namePlaceholder")}
              onChange={(event) =>
                updateRow(row.id, "name", event.target.value)
              }
              onKeyDown={(event) =>
                onKeyDown(event, { type: "name", rowId: row.id })
              }
            />
            {example && (
              <input
                ref={registerInput({ type: "example", rowId: row.id })}
                className="excalidraw-dbtable-editor__input excalidraw-dbtable-editor__example"
                style={{
                  left: example.x + layout.paddingX,
                  top: nameTextY,
                  width: example.width - layout.paddingX * 1.5,
                  height: lineHeightPx,
                  lineHeight: `${lineHeightPx}px`,
                  font,
                }}
                value={row.example ?? ""}
                placeholder={t("dbTable.examplePlaceholder")}
                spellCheck={false}
                autoComplete="off"
                aria-label={t("dbTable.exampleLabel", {
                  name: row.name || t("dbTable.namePlaceholder"),
                })}
                onChange={(event) =>
                  updateRow(row.id, "example", event.target.value)
                }
                onKeyDown={(event) =>
                  onKeyDown(event, { type: "example", rowId: row.id })
                }
              />
            )}
            <button
              type="button"
              tabIndex={-1}
              className="excalidraw-dbtable-editor__remove"
              style={{ top: key.y + key.height / 2, left: table.width }}
              title={t("dbTable.removeRow")}
              aria-label={t("dbTable.removeRow")}
              onClick={() => removeRow(row.id, false)}
            >
              {CloseIcon}
            </button>
          </div>
        ))}

        {!table.collapsed && (
          <div
            className="excalidraw-dbtable-editor__footer"
            style={{ top: table.height, left: table.width / 2 }}
          >
            <button
              type="button"
              className="excalidraw-dbtable-editor__pill excalidraw-dbtable-editor__add"
              onClick={() => insertRow(tableRef.current.rows.length, "key")}
            >
              {PlusIcon}
              <span>{t("dbTable.addRow")}</span>
            </button>
            <button
              type="button"
              className={clsx(
                "excalidraw-dbtable-editor__pill",
                "excalidraw-dbtable-editor__examples-toggle",
                { "is-active": !!table.showExamples },
              )}
              aria-pressed={!!table.showExamples}
              title={t("dbTable.examplesHint")}
              // keep the caret in its cell, so the toggle knows which row
              onMouseDown={(event) => event.preventDefault()}
              onClick={toggleExamples}
            >
              {ExamplesIcon}
              <span>
                {table.showExamples
                  ? t("dbTable.hideExamples")
                  : t("dbTable.showExamples")}
              </span>
            </button>
          </div>
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

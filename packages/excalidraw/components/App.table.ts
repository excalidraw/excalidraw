import { getGridPoint, KEYS } from "@excalidraw/common";

import {
  getTableCellAtPoint,
  isPointOnTableToggle,
  isTableElement,
  newTableElement,
  newTableRow,
  updateTableContent,
} from "@excalidraw/element";

import type { TableCell, TableContentUpdate } from "@excalidraw/element";

import type {
  ExcalidrawTableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type App from "./App";

type ScenePoint = { x: number; y: number };

/**
 * Owns the database-table interactions: placing a table with the tool,
 * collapsing it from its header toggle, and the in-place cell editing that
 * `TableEditor` renders over the canvas.
 */
export class AppTable {
  constructor(private app: App) {}

  /** the click armed on pointer down, committed on (a genuine) pointer up */
  private pending: ScenePoint | null = null;

  /** the cell `TableEditor` focuses when it mounts */
  public initialCell: TableCell = { type: "title" };

  // ---------------------------------------------------------------------------
  // creation
  // ---------------------------------------------------------------------------

  handlePointerDown = (scenePointer: ScenePoint) => {
    this.pending = scenePointer;
  };

  handlePointerUp = () => {
    const point = this.pending;
    this.pending = null;
    if (point) {
      this.createAt(point);
    }
  };

  cancel = () => {
    this.pending = null;
  };

  /**
   * Places a new table with its top-left corner at the click (snapped to the
   * grid unless Ctrl/Cmd is held, like other shapes) and starts editing its
   * name with the text selected, so the user can type right away.
   */
  createAt = (point: ScenePoint) => {
    const { state } = this.app;
    const [x, y] = getGridPoint(
      point.x,
      point.y,
      this.app.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.app.getEffectiveGridSize(),
    );

    const table = newTableElement({
      type: "table",
      x,
      y,
      strokeColor: state.currentItemStrokeColor,
      backgroundColor: getTableBackgroundColor(
        state.currentItemBackgroundColor,
      ),
      fillStyle: state.currentItemFillStyle,
      strokeWidth: this.app.getCurrentItemStrokeWidth("table"),
      strokeStyle: state.currentItemStrokeStyle,
      roughness: state.currentItemRoughness,
      opacity: state.currentItemOpacity,
      roundness: this.app.getCurrentItemRoundness("table"),
      fontFamily: state.currentItemFontFamily,
      locked: false,
      frameId: this.app.getTopLayerFrameAtSceneCoords({ x, y })?.id ?? null,
      renderEnvironment: this.app.renderEnvironment,
    });

    this.app.insertNewElement(table);
    this.app.scheduleCapture();
    this.startEditing(table, { type: "title" });
    return table;
  };

  // ---------------------------------------------------------------------------
  // collapse toggle
  // ---------------------------------------------------------------------------

  /** the top-most table whose toggle is at `point`, if any */
  getTableWithToggleAt = (point: ScenePoint) => {
    const hit = this.app.getElementAtPosition(point.x, point.y);
    if (
      isTableElement(hit) &&
      !hit.locked &&
      isPointOnTableToggle(hit, point, this.app.state.zoom.value)
    ) {
      return hit;
    }
    return null;
  };

  /** toggles the table whose toggle was clicked; `true` if one was */
  handleTogglePointerDown = (point: ScenePoint) => {
    const table = this.getTableWithToggleAt(point);
    if (!table) {
      return false;
    }
    this.toggleCollapsed(table);
    this.app.setState({
      selectedElementIds: { [table.id]: true },
      selectedGroupIds: {},
    });
    return true;
  };

  toggleCollapsed = (table: NonDeleted<ExcalidrawTableElement>) => {
    this.updateContent(table, { collapsed: !table.collapsed });
    this.app.scheduleCapture();
  };

  // ---------------------------------------------------------------------------
  // in-place editing
  // ---------------------------------------------------------------------------

  /** the double-clicked table cell (or the title), when a table was hit */
  handleDoubleClick = (point: ScenePoint) => {
    const hit = this.app.getElementAtPosition(point.x, point.y);
    if (!isTableElement(hit) || hit.locked) {
      return false;
    }
    if (isPointOnTableToggle(hit, point, this.app.state.zoom.value)) {
      // the first click of the pair already toggled it
      return true;
    }
    this.startEditing(
      hit,
      getTableCellAtPoint(hit, point) ?? { type: "title" },
    );
    return true;
  };

  startEditing = (table: ExcalidrawTableElement, cell: TableCell) => {
    // editing a collapsed table's body means showing it first
    if (table.collapsed && cell.type !== "title") {
      this.updateContent(table, { collapsed: false });
    }
    this.initialCell = cell;
    this.app.setState({
      editingTableId: table.id,
      selectedElementIds: { [table.id]: true },
      selectedGroupIds: {},
      editingGroupId: null,
    });
  };

  /**
   * Ends in-place editing: rows left fully empty are dropped (they are the
   * "add field" rows the user never filled in), and the session becomes one
   * undo step.
   */
  stopEditing = () => {
    const id = this.app.state.editingTableId;
    if (!id) {
      return;
    }
    const table = this.getEditingTable(id);
    if (table) {
      const rows = table.rows.filter(
        (row) => row.key.trim() || row.name.trim(),
      );
      if (rows.length !== table.rows.length) {
        this.updateContent(table, { rows });
      }
    }
    this.app.setState({ editingTableId: null });
    this.app.scheduleCapture();
  };

  getEditingTable = (id = this.app.state.editingTableId) => {
    if (!id) {
      return null;
    }
    const element = this.app.scene.getNonDeletedElement(id);
    return isTableElement(element) ? element : null;
  };

  updateContent = (
    table: ExcalidrawTableElement,
    updates: TableContentUpdate,
  ) => {
    updateTableContent(
      table,
      updates,
      this.app.scene,
      this.app.renderEnvironment,
    );
  };

  newRow = newTableRow;
}

/**
 * A table without a header color would lose its structure, so a transparent
 * current background falls back to the palette's light blue.
 */
export const TABLE_DEFAULT_BACKGROUND = "#a5d8ff";

const getTableBackgroundColor = (currentItemBackgroundColor: string) =>
  currentItemBackgroundColor === "transparent"
    ? TABLE_DEFAULT_BACKGROUND
    : currentItemBackgroundColor;

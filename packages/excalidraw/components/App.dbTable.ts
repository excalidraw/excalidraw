import { getGridPoint, KEYS } from "@excalidraw/common";

import {
  getDBTableCellAtPoint,
  getDBTableToggleAtPoint,
  isPointOnDBTableToggle,
  isDBTableElement,
  newDBTableElement,
  newDBTableRow,
  updateDBTableContent,
} from "@excalidraw/element";

import type { DBTableCell, DBTableContentUpdate } from "@excalidraw/element";

import type {
  ExcalidrawDBTableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type App from "./App";

type ScenePoint = { x: number; y: number };

/**
 * Owns the database-table interactions: placing a table with the tool,
 * collapsing it or showing its examples from its header toggles, and the
 * in-place cell editing that
 * `DBTableEditor` renders over the canvas.
 */
export class AppDBTable {
  constructor(private app: App) {}

  /** the click armed on pointer down, committed on (a genuine) pointer up */
  private pending: ScenePoint | null = null;

  /** the cell `DBTableEditor` focuses when it mounts */
  public initialCell: DBTableCell = { type: "title" };

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

    const table = newDBTableElement({
      type: "dbtable",
      x,
      y,
      strokeColor: state.currentItemStrokeColor,
      backgroundColor: getDBTableBackgroundColor(
        state.currentItemBackgroundColor,
      ),
      fillStyle: state.currentItemFillStyle,
      strokeWidth: this.app.getCurrentItemStrokeWidth("dbtable"),
      strokeStyle: state.currentItemStrokeStyle,
      roughness: state.currentItemRoughness,
      opacity: state.currentItemOpacity,
      roundness: this.app.getCurrentItemRoundness("dbtable"),
      fontFamily: state.currentItemFontFamily,
      locked: false,
      frameId: this.app.getTopLayerFrameAtSceneCoords({ x, y })?.id ?? null,
      renderEnvironment: this.app.renderEnvironment,
    });

    this.app.insertNewElement(table);
    this.app.scheduleCapture();
    // with the tool locked, tables are placed one after another (and, like
    // other shapes, not selected); otherwise the new table is named first
    if (!state.activeTool.locked) {
      this.startEditing(table, { type: "title" });
    }
    return table;
  };

  // ---------------------------------------------------------------------------
  // collapse toggle
  // ---------------------------------------------------------------------------

  /** the top-most table whose toggle is at `point`, if any */
  getDBTableWithToggleAt = (point: ScenePoint) => {
    const hit = this.app.getElementAtPosition(point.x, point.y);
    if (
      isDBTableElement(hit) &&
      !hit.locked &&
      isPointOnDBTableToggle(hit, point, this.app.state.zoom.value)
    ) {
      return hit;
    }
    return null;
  };

  /** toggles the table whose toggle was clicked; `true` if one was */
  handleTogglePointerDown = (point: ScenePoint) => {
    const table = this.getDBTableWithToggleAt(point);
    if (!table) {
      return false;
    }
    const toggle = getDBTableToggleAtPoint(
      table,
      point,
      this.app.state.zoom.value,
    );
    this.app.setState({
      selectedElementIds: { [table.id]: true },
      selectedGroupIds: {},
    });
    if (toggle === "examples") {
      this.toggleExamples(table);
    } else {
      this.toggleCollapsed(table);
    }
    return true;
  };

  toggleCollapsed = (table: NonDeleted<ExcalidrawDBTableElement>) => {
    this.updateContent(table, { collapsed: !table.collapsed });
    this.app.scheduleCapture();
  };

  /**
   * Shows or hides the examples column. When the table has no examples at
   * all yet, showing it puts the caret in the first one so the user can
   * start filling them in right away.
   *
   * @returns the table's examples state after the toggle
   */
  toggleExamples = (
    table: NonDeleted<ExcalidrawDBTableElement>,
    { startEditing = true }: { startEditing?: boolean } = {},
  ) => {
    if (table.showExamples) {
      this.updateContent(table, { showExamples: false });
      this.app.scheduleCapture();
      return false;
    }
    this.updateContent(table, { showExamples: true });
    this.app.scheduleCapture();
    const { rows } = table;
    if (
      startEditing &&
      rows.length &&
      !rows.some((row) => row.example?.trim()) &&
      !this.app.state.editingDBTableId
    ) {
      this.startEditing(table, { type: "example", rowId: rows[0].id });
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // in-place editing
  // ---------------------------------------------------------------------------

  /** the double-clicked table cell (or the title), when a table was hit */
  handleDoubleClick = (point: ScenePoint) => {
    const hit = this.app.getElementAtPosition(point.x, point.y);
    if (!isDBTableElement(hit) || hit.locked) {
      return false;
    }
    if (isPointOnDBTableToggle(hit, point, this.app.state.zoom.value)) {
      // the first click of the pair already toggled it
      return true;
    }
    this.startEditing(
      hit,
      getDBTableCellAtPoint(hit, point) ?? { type: "title" },
    );
    return true;
  };

  startEditing = (table: ExcalidrawDBTableElement, cell: DBTableCell) => {
    // editing a collapsed table's body means showing it first
    if (table.collapsed && cell.type !== "title") {
      this.updateContent(table, { collapsed: false });
    }
    this.initialCell = cell;
    this.app.setState({
      editingDBTableId: table.id,
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
    const id = this.app.state.editingDBTableId;
    if (!id) {
      return;
    }
    const table = this.getEditingDBTable(id);
    if (table) {
      const rows = table.rows.filter(
        (row) => row.key.trim() || row.name.trim() || row.example?.trim(),
      );
      if (rows.length !== table.rows.length) {
        this.updateContent(table, { rows });
      }
    }
    this.app.setState({ editingDBTableId: null });
    this.app.scheduleCapture();
  };

  getEditingDBTable = (id = this.app.state.editingDBTableId) => {
    if (!id) {
      return null;
    }
    const element = this.app.scene.getNonDeletedElement(id);
    return isDBTableElement(element) ? element : null;
  };

  updateContent = (
    table: ExcalidrawDBTableElement,
    updates: DBTableContentUpdate,
  ) => {
    updateDBTableContent(
      table,
      updates,
      this.app.scene,
      this.app.renderEnvironment,
    );
  };

  newRow = newDBTableRow;
}

/**
 * A table without a header color would lose its structure, so a transparent
 * current background falls back to the palette's light blue.
 */
export const DB_TABLE_DEFAULT_BACKGROUND = "#a5d8ff";

const getDBTableBackgroundColor = (currentItemBackgroundColor: string) =>
  currentItemBackgroundColor === "transparent"
    ? DB_TABLE_DEFAULT_BACKGROUND
    : currentItemBackgroundColor;

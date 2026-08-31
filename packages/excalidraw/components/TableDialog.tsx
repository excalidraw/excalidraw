import React, { useState } from "react";
import clsx from "clsx";

import { useApp } from "./App";
import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { TableIcon } from "./icons";
import { t } from "../i18n";
import { createTableElements } from "../table";
import { useUIAppState } from "../context/ui-appState";

import "./TableDialog.scss";

const GRID_MAX_ROWS = 8;
const GRID_MAX_COLS = 8;

export const TableDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { onInsertElements, focusContainer } = useApp();
  const app = useApp();
  const appState = useUIAppState();

  const [selectedRows, setSelectedRows] = useState(app.state.tableNumRows || 3);
  const [selectedCols, setSelectedCols] = useState(app.state.tableNumCols || 3);
  const [hoveredRows, setHoveredRows] = useState<number | null>(null);
  const [hoveredCols, setHoveredCols] = useState<number | null>(null);

  const displayRows = hoveredRows ?? selectedRows;
  const displayCols = hoveredCols ?? selectedCols;

  const handleInsertDirectly = () => {
    app.setAppState({
      tableNumRows: selectedRows,
      tableNumCols: selectedCols,
    });

    // Center in current viewport
    const width = selectedCols * 100;
    const height = selectedRows * 50;
    const x = -app.state.scrollX + app.state.width / 2 - width / 2;
    const y = -app.state.scrollY + app.state.height / 2 - height / 2;

    const tableElements = createTableElements({
      x,
      y,
      width,
      height,
      rows: selectedRows,
      cols: selectedCols,
      appState,
    });

    onInsertElements(tableElements);

    app.setAppState({
      openDialog: null,
    });
    onClose();
    focusContainer();
  };

  const handleDrawOnCanvas = () => {
    app.setAppState({
      tableNumRows: selectedRows,
      tableNumCols: selectedCols,
      openDialog: null,
    });
    app.setActiveTool({ type: "table" });
    onClose();
    app.focusContainer();
  };

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {TableIcon}
          <span>{t("labels.table_insertTable")}</span>
        </div>
      }
      className="TableDialog"
      autofocus={false}
    >
      <div className="TableDialog__container">
        <div className="TableDialog__preview-label">
          {displayCols} × {displayRows} {t("toolBar.table")}
        </div>

        {/* 8x8 Visual Grid Picker */}
        <div
          className="TableDialog__grid"
          onMouseLeave={() => {
            setHoveredRows(null);
            setHoveredCols(null);
          }}
        >
          {Array.from({ length: GRID_MAX_ROWS }).map((_, r) =>
            Array.from({ length: GRID_MAX_COLS }).map((_, c) => {
              const rowNum = r + 1;
              const colNum = c + 1;
              const isHighlighted =
                rowNum <= displayRows && colNum <= displayCols;
              const isSelected =
                rowNum <= selectedRows && colNum <= selectedCols;

              return (
                <div
                  key={`${r}_${c}`}
                  className={clsx("TableDialog__grid-cell", {
                    "TableDialog__grid-cell--highlighted": isHighlighted,
                    "TableDialog__grid-cell--selected": isSelected,
                  })}
                  onMouseEnter={() => {
                    setHoveredRows(rowNum);
                    setHoveredCols(colNum);
                  }}
                  onClick={() => {
                    setSelectedRows(rowNum);
                    setSelectedCols(colNum);
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Row & Column Steppers */}
        <div className="TableDialog__steppers">
          <div className="TableDialog__stepper">
            <label>{t("labels.table_rows")}</label>
            <div className="TableDialog__stepper-controls">
              <button
                type="button"
                onClick={() => setSelectedRows((prev) => Math.max(1, prev - 1))}
              >
                -
              </button>
              <span>{selectedRows}</span>
              <button
                type="button"
                onClick={() => setSelectedRows((prev) => Math.min(20, prev + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="TableDialog__stepper">
            <label>{t("labels.table_cols")}</label>
            <div className="TableDialog__stepper-controls">
              <button
                type="button"
                onClick={() => setSelectedCols((prev) => Math.max(1, prev - 1))}
              >
                -
              </button>
              <span>{selectedCols}</span>
              <button
                type="button"
                onClick={() => setSelectedCols((prev) => Math.min(20, prev + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="TableDialog__actions">
          <FilledButton
            variant="filled"
            color="primary"
            onClick={handleInsertDirectly}
            label={t("labels.table_insertTable")}
          >
            {t("labels.table_insertTable")}
          </FilledButton>
          <FilledButton
            variant="outlined"
            color="muted"
            onClick={handleDrawOnCanvas}
            label={t("labels.table_drawOnCanvas")}
          >
            {t("labels.table_drawOnCanvas")}
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};

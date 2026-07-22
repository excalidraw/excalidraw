import React, { useState } from "react";
import { useApp } from "./App";
import { Dialog } from "./Dialog";
import { createTableElements } from "../actions/actionTable";
import { t } from "../i18n";
import "./TableCreationDialog.scss";

export const TableCreationDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { onInsertElements, focusContainer } = useApp();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const [inputRows, setInputRows] = useState(3);
  const [inputCols, setInputCols] = useState(3);

  const handleInsert = (rowsCount: number, colsCount: number) => {
    // Determine the viewport center position or default coordinates
    const tableElements = createTableElements(0, 0, rowsCount, colsCount);
    onInsertElements(tableElements);
    onClose();
    focusContainer();
  };

  const maxRows = 10;
  const maxCols = 10;

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title={
        <div className="TableCreationDialog__title">
          {t("toolBar.table")}
        </div>
      }
      className="TableCreationDialog"
      autofocus={false}
    >
      <div className="TableCreationDialog__container">
        <div className="TableCreationDialog__grid-header">
          {hoveredRow !== null && hoveredCol !== null
            ? `Create a ${hoveredRow + 1} × ${hoveredCol + 1} Table`
            : "Select Table Size"}
        </div>

        <div
          className="TableCreationDialog__grid"
          onMouseLeave={() => {
            setHoveredRow(null);
            setHoveredCol(null);
          }}
        >
          {Array.from({ length: maxRows }).map((_, r) => (
            <div key={r} className="TableCreationDialog__grid-row">
              {Array.from({ length: maxCols }).map((_, c) => {
                const isHighlighted =
                  hoveredRow !== null &&
                  hoveredCol !== null &&
                  r <= hoveredRow &&
                  c <= hoveredCol;

                return (
                  <div
                    key={c}
                    className={`TableCreationDialog__grid-cell ${
                      isHighlighted ? "highlighted" : ""
                    }`}
                    onMouseEnter={() => {
                      setHoveredRow(r);
                      setHoveredCol(c);
                    }}
                    onClick={() => handleInsert(r + 1, c + 1)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="TableCreationDialog__divider" />

        <div className="TableCreationDialog__manual">
          <div className="TableCreationDialog__manual-field">
            <label>Rows</label>
            <input
              type="number"
              min="1"
              max="50"
              value={inputRows}
              onChange={(e) => setInputRows(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="TableCreationDialog__manual-field">
            <label>Columns</label>
            <input
              type="number"
              min="1"
              max="20"
              value={inputCols}
              onChange={(e) => setInputCols(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <button
            type="button"
            className="TableCreationDialog__insert-btn"
            onClick={() => handleInsert(inputRows, inputCols)}
          >
            Insert
          </button>
        </div>
      </div>
    </Dialog>
  );
};

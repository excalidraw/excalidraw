import React, { useState } from "react";

import { t } from "../i18n";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";

interface TableConfigDialogProps {
  onClose: () => void;
  onCreate: (rows: number, columns: number) => void;
}

export const TableConfigDialog = ({
  onClose,
  onCreate,
}: TableConfigDialogProps) => {
  const [rows, setRows] = useState("3");
  const [columns, setColumns] = useState("3");

  const handleCreate = () => {
    const rowCount = parseInt(rows) || 3;
    const columnCount = parseInt(columns) || 3;
    if (rowCount > 0 && columnCount > 0) {
      onCreate(rowCount, columnCount);
      onClose();
    }
  };

  return (
    <Dialog onCloseRequest={onClose} title={t("toolBar.table")}>
      <div style={{ padding: "20px", minWidth: "300px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            {t("labels.rows")}
          </label>
          <input
            type="number"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
            min="1"
            max="20"
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid var(--default-border-color)",
              borderRadius: "4px",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            {t("labels.columns")}
          </label>
          <input
            type="number"
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
            min="1"
            max="20"
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid var(--default-border-color)",
              borderRadius: "4px",
            }}
          />
        </div>
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
        >
          <FilledButton
            onClick={onClose}
            variant="outlined"
            label={t("buttons.cancel")}
          >
            {t("buttons.cancel")}
          </FilledButton>
          <FilledButton
            onClick={handleCreate}
            variant="filled"
            label={t("buttons.create")}
          >
            {t("buttons.create")}
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};

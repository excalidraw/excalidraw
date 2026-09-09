import { useState } from "react";

import { getStrokeWidthByKey, KEYS } from "@excalidraw/common";

import { trackEvent } from "../analytics";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";
import {
  createTableElements,
  DEFAULT_TABLE_COLS,
  DEFAULT_TABLE_ROWS,
  parseTableDimension,
} from "../tables/createTable";

import { useApp } from "./App";
import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { TextField } from "./TextField";

import "./CreateTableDialog.scss";

import type { KeyboardEvent } from "react";

let lastTableSize = {
  rows: DEFAULT_TABLE_ROWS,
  cols: DEFAULT_TABLE_COLS,
};

export const CreateTableDialog = ({ onClose }: { onClose: () => void }) => {
  const app = useApp();
  const appState = useUIAppState();
  const [rowsInput, setRowsInput] = useState(String(lastTableSize.rows));
  const [colsInput, setColsInput] = useState(String(lastTableSize.cols));

  const insertTable = () => {
    const rows = parseTableDimension(rowsInput, lastTableSize.rows);
    const cols = parseTableDimension(colsInput, lastTableSize.cols);

    lastTableSize = { rows, cols };

    const elements = createTableElements({
      rows,
      cols,
      styles: {
        strokeColor: appState.currentItemStrokeColor,
        backgroundColor: appState.currentItemBackgroundColor,
        fillStyle: appState.currentItemFillStyle,
        strokeWidth: getStrokeWidthByKey(
          "rectangle",
          appState.currentItemStrokeWidthKey,
        ),
        strokeStyle: appState.currentItemStrokeStyle,
        roughness: appState.currentItemRoughness,
        opacity: appState.currentItemOpacity,
      },
    });

    app.onInsertElements(elements);
    trackEvent("toolbar", "table", "insert");
    onClose();
    app.focusContainer();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      insertTable();
    }
  };

  return (
    <Dialog
      size={360}
      onCloseRequest={onClose}
      title={t("labels.createTable")}
      className="CreateTableDialog"
    >
      <div className="CreateTableDialog__fields">
        <div data-testid="create-table-cols">
          <TextField
            label={t("labels.tableColumns")}
            value={colsInput}
            onChange={setColsInput}
            onKeyDown={handleKeyDown}
            selectOnRender
          />
        </div>
        <div data-testid="create-table-rows">
          <TextField
            label={t("labels.tableRows")}
            value={rowsInput}
            onChange={setRowsInput}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <div className="CreateTableDialog__actions">
        <FilledButton
          color="primary"
          label={t("buttons.insertTable")}
          onClick={insertTable}
        >
          {t("buttons.insertTable")}
        </FilledButton>
      </div>
    </Dialog>
  );
};

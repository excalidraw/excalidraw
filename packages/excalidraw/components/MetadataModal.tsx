import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { t } from "../i18n";
import { useExcalidrawSetAppState } from "./App";
import { ExcalidrawElement } from "@excalidraw/element/types";
import { jsonToKVArray, kvArrayToJson, isValidJson } from "../utils/metadataHelpers";
import { newElementWith } from "@excalidraw/element";
import { KEYS } from "@excalidraw/common";
import { TrashIcon, PlusIcon } from "./icons";

import "./MetadataModal.scss";

interface MetadataModalProps {
  elements: readonly ExcalidrawElement[];
  appState: any;
  onClose: () => void;
  onSave: (customData: any) => void;
}

export const MetadataModal = ({
  elements,
  appState,
  onClose,
  onSave,
}: MetadataModalProps) => {
  const setAppState = useExcalidrawSetAppState();
  const element = elements[0];
  /** Currently supports editing metadata for a single selected element. */

  const [activeTab, setActiveTab] = useState<"form" | "json">("form");
  const [kvRows, setKvRows] = useState<{ key: string; value: string }[]>([]);
  const [jsonText, setJsonText] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (element) {
      const customData = element.customData || {};
      setKvRows(jsonToKVArray(customData));
      setJsonText(JSON.stringify(customData, null, 2));
    }
  }, [element]);

  const handleSave = () => {
    let newCustomData = {};

    if (activeTab === "form") {
      newCustomData = kvArrayToJson(kvRows);
    } else {
      if (!isValidJson(jsonText)) {
        return;
      }
      newCustomData = JSON.parse(jsonText);
    }

    onSave(newCustomData);
  };

  const handleTabChange = (tab: "form" | "json") => {
    if (tab === "form") {
      /** Synchronize JSON changes to the Form view. */
      if (isValidJson(jsonText)) {
        setKvRows(jsonToKVArray(JSON.parse(jsonText)));
      }
    } else {
      /** Synchronize Form changes to the JSON view. */
      setJsonText(JSON.stringify(kvArrayToJson(kvRows), null, 2));
      setJsonError(null);
    }
    setActiveTab(tab);
  };

  const updateJson = (val: string) => {
    setJsonText(val);
    if (val.trim() === "") {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const addRow = () => {
    setKvRows([...kvRows, { key: "", value: "" }]);
  };

  const updateRow = (index: number, field: "key" | "value", val: string) => {
    const newRows = [...kvRows];
    newRows[index][field] = val;
    setKvRows(newRows);
  };

  const deleteRow = (index: number) => {
    const newRows = kvRows.filter((_, i) => i !== index);
    setKvRows(newRows);
  };

  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.metadata")}
      className="MetadataModal"
      autofocus={false}
    >
      <div className="MetadataModal__tabs">
        <button
          className={`MetadataModal__tab ${activeTab === "form" ? "active" : ""}`}
          onClick={() => handleTabChange("form")}
        >
          Form Editor
        </button>
        <button
          className={`MetadataModal__tab ${activeTab === "json" ? "active" : ""}`}
          onClick={() => handleTabChange("json")}
        >
          JSON Editor
        </button>
      </div>

      <div className="MetadataModal__content">
        {activeTab === "form" ? (
          <div className="MetadataModal__form">
            {kvRows.map((row, i) => (
              <div key={i} className="MetadataModal__row">
                <input
                  type="text"
                  placeholder="Key"
                  value={row.key}
                  onChange={(e) => updateRow(i, "key", e.target.value)}
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                  onKeyPress={stopPropagation}
                  className="MetadataModal__input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => updateRow(i, "value", e.target.value)}
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                  onKeyPress={stopPropagation}
                  className="MetadataModal__input"
                />
                <button
                  onClick={() => deleteRow(i)}
                  className="MetadataModal__delete-btn"
                  title="Delete row"
                >
                  {TrashIcon}
                </button>
              </div>
            ))}
            <button onClick={addRow} className="MetadataModal__add-btn">
              {PlusIcon} Add Row
            </button>
          </div>
        ) : (
          <div className="MetadataModal__json">
            <textarea
              value={jsonText}
              onChange={(e) => updateJson(e.target.value)}
              onKeyDown={stopPropagation}
              onKeyUp={stopPropagation}
              onKeyPress={stopPropagation}
              className="MetadataModal__textarea"
              spellCheck={false}
            />
            {jsonError && <div className="MetadataModal__error">{jsonError}</div>}
          </div>
        )}
      </div>

      <div className="MetadataModal__footer">
        <button onClick={onClose} className="MetadataModal__cancel-btn">
          {t("buttons.cancel")}
        </button>
        <button
          onClick={handleSave}
          className="MetadataModal__save-btn"
          disabled={activeTab === "json" && !!jsonError}
        >
          {t("buttons.save")}
        </button>
      </div>
    </Dialog>
  );
};

import React, { useState, useCallback, useEffect } from "react";
import clsx from "clsx";
import { t } from "../../i18n";
import { Island } from "../Island";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Trash, MapPin, Eye } from "../icons";
import type { AppClassProperties, AppState, IndexItem } from "../../types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { actionAddIndexItem, actionRemoveIndexItem, actionUpdateIndexItem } from "../../actions/actionIndex";

import "./IndexSection.scss";

interface IndexSectionProps {
  app: AppClassProperties;
  appState: AppState;
  onClose: () => void;
}

export const IndexSection: React.FC<IndexSectionProps> = ({
  app,
  appState,
  onClose,
}) => {
  const [newItemName, setNewItemName] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Clean up orphaned pins when elements are deleted
  useEffect(() => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const orphanedItems = appState.indexItems.filter(
      item => item.elementId && !elementsMap.has(item.elementId)
    );
    
    orphanedItems.forEach(item => {
      app.syncActionResult(actionRemoveIndexItem.perform(
        app.scene.getElements(),
        appState,
        { id: item.id },
        app
      ));
    });
  }, [app.scene.getElements(), appState.indexItems, app]);

  const addIndexItem = useCallback(() => {
    if (!newItemName.trim()) return;

    const selectedElements = app.scene.getSelectedElements(appState);
    let x = appState.scrollX + appState.width / 2;
    let y = appState.scrollY + appState.height / 2;
    let elementId: string | undefined;

    // If an element is selected, use its position
    if (selectedElements.length > 0) {
      const element = selectedElements[0];
      x = element.x + element.width / 2;
      y = element.y + element.height / 2;
      elementId = element.id;
    }

    const newItem: IndexItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      x,
      y,
      elementId,
      timestamp: Date.now(),
    };

    app.syncActionResult(actionAddIndexItem.perform(
      app.scene.getElements(),
      appState,
      newItem,
      app
    ));
    setNewItemName("");
    setIsAddingItem(false);
  }, [newItemName, app, appState]);

  const removeIndexItem = useCallback((id: string) => {
    app.syncActionResult(actionRemoveIndexItem.perform(
      app.scene.getElements(),
      appState,
      { id },
      app
    ));
  }, [app, appState]);

  const startEditing = useCallback((item: IndexItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId || !editingName.trim()) return;
    
    app.syncActionResult(actionUpdateIndexItem.perform(
      app.scene.getElements(),
      appState,
      { id: editingId, updates: { name: editingName.trim() } },
      app
    ));
    setEditingId(null);
    setEditingName("");
  }, [editingId, editingName, app, appState]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const navigateToItem = useCallback((item: IndexItem) => {
    // If the item is associated with an element, navigate to it and select it
    if (item.elementId) {
      const element = app.scene.getNonDeletedElementsMap().get(item.elementId);
      if (element) {
        app.scrollToContent([element], {
          animate: true,
          fitToContent: true,
        });
        app.syncActionResult({
          appState: {
            selectedElementIds: { [item.elementId]: true },
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        return;
      }
    }

    // Navigate to the coordinates by updating the viewport
    const centerX = item.x - appState.width / 2;
    const centerY = item.y - appState.height / 2;
    
    app.syncActionResult({
      appState: {
        scrollX: centerX,
        scrollY: centerY,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [app, appState.width, appState.height]);

  const getCurrentViewportCenter = () => {
    return {
      x: appState.scrollX + appState.width / 2,
      y: appState.scrollY + appState.height / 2,
    };
  };

  return (
    <div className="index-section">
      <div className="index-section__header">
        <h3>{t("indexSection.title")}</h3>
        <Button
          type="button"
          size="small"
          onClick={onClose}
          title={t("buttons.close")}
        >
          ×
        </Button>
      </div>

      <div className="index-section__content">
        <div className="index-section__add-item">
          {!isAddingItem ? (
            <Button
              type="button"
              size="small"
              onClick={() => setIsAddingItem(true)}
              title={t("indexSection.addItem")}
            >
              <MapPin size={16} />
              {t("indexSection.addPin")}
            </Button>
          ) : (
            <div className="index-section__add-form">
              <TextField
                value={newItemName}
                onChange={(value) => setNewItemName(value)}
                placeholder={t("indexSection.enterName")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addIndexItem();
                  } else if (e.key === "Escape") {
                    setIsAddingItem(false);
                    setNewItemName("");
                  }
                }}
                autoFocus
              />
              <div className="index-section__add-buttons">
                <Button
                  type="button"
                  size="small"
                  onClick={addIndexItem}
                  disabled={!newItemName.trim()}
                >
                  {t("buttons.add")}
                </Button>
                <Button
                  type="button"
                  size="small"
                  onClick={() => {
                    setIsAddingItem(false);
                    setNewItemName("");
                  }}
                >
                  {t("buttons.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="index-section__items">
          {appState.indexItems.length === 0 ? (
            <div className="index-section__empty">
              <p>{t("indexSection.empty")}</p>
              <p className="index-section__help">
                {t("indexSection.help")}
              </p>
            </div>
          ) : (
            <ul className="index-section__list">
              {appState.indexItems.map((item) => (
                <li key={item.id} className="index-section__item">
                  <div className="index-section__item-content">
                    <div className="index-section__item-info">
                      {editingId === item.id ? (
                        <TextField
                          value={editingName}
                          onChange={setEditingName}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              saveEdit();
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span 
                            className="index-section__item-name"
                            onDoubleClick={() => startEditing(item)}
                          >
                            {item.name}
                          </span>
                          <span className="index-section__item-coords">
                            ({Math.round(item.x)}, {Math.round(item.y)})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="index-section__item-actions">
                      {editingId === item.id ? (
                        <>
                          <Button
                            type="button"
                            size="small"
                            onClick={saveEdit}
                            disabled={!editingName.trim()}
                          >
                            ✓
                          </Button>
                          <Button
                            type="button"
                            size="small"
                            onClick={cancelEdit}
                          >
                            ✕
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="small"
                            onClick={() => navigateToItem(item)}
                            title={t("indexSection.goTo")}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            type="button"
                            size="small"
                            onClick={() => removeIndexItem(item.id)}
                            title={t("buttons.delete")}
                          >
                            <Trash size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
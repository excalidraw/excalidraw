import clsx from "clsx";
import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";

import { DEFAULT_LAYER_ID, randomId } from "@excalidraw/common";

import type {
  Layer,
  LayerId,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import {
  actionMergeSelectedLayers,
  actionMergeAllLayers,
} from "../actions/actionLayer";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";

import { useApp, useExcalidrawSetAppState, useExcalidrawElements } from "./App";
import {
  eyeIcon,
  eyeClosedIcon,
  TrashIcon,
  chevronUpIcon,
  chevronDownIcon,
} from "./icons";

import "./LayersPanel.scss";

/**
 * Editable layer name component with double-click to edit functionality
 */
const EditableLayerName = memo(
  ({
    name,
    onRename,
  }: {
    name: string;
    onRename: (newName: string) => void;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const handleSubmit = useCallback(() => {
      const trimmedValue = editValue.trim();
      if (trimmedValue && trimmedValue !== name) {
        onRename(trimmedValue);
      } else {
        setEditValue(name);
      }
      setIsEditing(false);
    }, [editValue, name, onRename]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          handleSubmit();
        } else if (e.key === "Escape") {
          setEditValue(name);
          setIsEditing(false);
        }
      },
      [handleSubmit, name],
    );

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          className="layer-ui__layers-item-name-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span
        className="layer-ui__layers-item-name"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        title={t("labels.renameLayer")}
      >
        {name}
      </span>
    );
  },
);
EditableLayerName.displayName = "EditableLayerName";

const LayerItem = memo(
  ({
    layer,
    isActive,
    isSelected,
    isFirst,
    isLast,
    canDelete,
    selectedCount,
    elementCount,
    onSelect,
    onToggleVisibility,
    onRename,
    onDelete,
    onMoveUp,
    onMoveDown,
  }: {
    layer: Layer;
    isActive: boolean;
    isSelected: boolean;
    isFirst: boolean;
    isLast: boolean;
    canDelete: boolean;
    selectedCount: number;
    elementCount: number;
    onSelect: (e: React.MouseEvent) => void;
    onToggleVisibility: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
  }) => {
    return (
      <div
        className={clsx("layer-ui__layers-item", {
          "layer-ui__layers-item--active": isActive,
          "layer-ui__layers-item--selected": isSelected,
          "layer-ui__layers-item--has-selection": selectedCount > 0,
        })}
        onClick={onSelect}
      >
        <button
          className="layer-ui__layers-visibility-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          title={layer.visible ? t("labels.hideLayer") : t("labels.showLayer")}
        >
          {layer.visible ? eyeIcon : eyeClosedIcon}
        </button>

        <EditableLayerName name={layer.name} onRename={onRename} />

        {elementCount > 0 && (
          <span
            className={clsx("layer-ui__layers-item-count", {
              "layer-ui__layers-item-count--selected": selectedCount > 0,
            })}
            title={
              selectedCount > 0
                ? t("labels.selectedElementsOnLayer", {
                    selected: selectedCount,
                    total: elementCount,
                  })
                : t("labels.elementsOnLayer", { count: elementCount })
            }
          >
            {selectedCount > 0
              ? `${selectedCount}/${elementCount}`
              : elementCount}
          </span>
        )}

        <div className="layer-ui__layers-item-actions">
          <button
            className="layer-ui__layers-item-action"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={isFirst}
            title={t("labels.moveLayerUp")}
          >
            {chevronUpIcon}
          </button>
          <button
            className="layer-ui__layers-item-action"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={isLast}
            title={t("labels.moveLayerDown")}
          >
            {chevronDownIcon}
          </button>
          <button
            className="layer-ui__layers-item-action layer-ui__layers-item-action--delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={!canDelete}
            title={
              canDelete
                ? t("labels.deleteLayer")
                : t("labels.cannotDeleteLastLayer")
            }
          >
            {TrashIcon}
          </button>
        </div>

        {isActive && (
          <span className="layer-ui__layers-item-active-indicator" />
        )}
      </div>
    );
  },
);
LayerItem.displayName = "LayerItem";

const LayersPanelWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="layer-ui__layers">{children}</div>;
};

/**
 * Generate a new layer name like "Layer 2", "Layer 3", etc.
 */
const generateLayerName = (existingLayers: readonly Layer[]): string => {
  const existingNumbers = existingLayers
    .map((layer) => {
      const match = layer.name.match(/^Layer (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const maxNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return `Layer ${maxNumber + 1}`;
};

/**
 * Helper to get the layer ID for an element, defaulting to the default layer.
 */
const getElementLayerId = (
  element: ExcalidrawElement,
  defaultLayerId: LayerId,
): LayerId => {
  return element.layerId ?? defaultLayerId;
};

/**
 * LayersPanel component - displays and manages layers in the sidebar.
 * This component is meant to be rendered inside <Sidebar.Tab/> in DefaultSidebar.
 *
 * Supports multi-selection with Cmd/Ctrl + Click for merge operations.
 */
export const LayersPanel = memo(() => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();
  const app = useApp();

  const layers = appState.layers;
  const activeLayerId = appState.activeLayerId;
  const selectedElementIds = appState.selectedElementIds;
  const selectedLayerIds = appState.selectedLayerIds;

  // Sort layers by order (higher order = top of list)
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  // Count selected layers
  const selectedLayerCount = Object.keys(selectedLayerIds).length;

  // Find the default layer (lowest order) for elements without explicit layerId
  const defaultLayerId = useMemo(() => {
    if (layers.length === 0) {
      return DEFAULT_LAYER_ID;
    }
    return layers.reduce((min, layer) =>
      layer.order < min.order ? layer : min,
    ).id;
  }, [layers]);

  // Count elements and selected elements per layer
  const layerCounts = useMemo(() => {
    const counts: Record<LayerId, { total: number; selected: number }> = {};

    // Initialize counts for all layers
    layers.forEach((layer) => {
      counts[layer.id] = { total: 0, selected: 0 };
    });

    // Count non-deleted elements
    elements.forEach((element) => {
      if (element.isDeleted) {
        return;
      }
      const layerId = getElementLayerId(element, defaultLayerId);
      if (counts[layerId]) {
        counts[layerId].total++;
        if (selectedElementIds[element.id]) {
          counts[layerId].selected++;
        }
      }
    });

    return counts;
  }, [elements, layers, selectedElementIds, defaultLayerId]);

  /**
   * Handle layer selection with multi-select support (Cmd/Ctrl + Click)
   */
  const handleSelectLayer = useCallback(
    (layerId: LayerId, event: React.MouseEvent) => {
      const isMultiSelect = event.metaKey || event.ctrlKey;

      if (isMultiSelect) {
        // Toggle selection for multi-select
        const newSelectedLayerIds = { ...selectedLayerIds };
        if (newSelectedLayerIds[layerId]) {
          delete newSelectedLayerIds[layerId];
        } else {
          newSelectedLayerIds[layerId] = true;
        }
        setAppState({
          selectedLayerIds: newSelectedLayerIds,
          activeLayerId: layerId,
        });
      } else {
        // Single select - clear multi-selection and set active layer
        setAppState({
          activeLayerId: layerId,
          selectedLayerIds: { [layerId]: true },
        });
      }
    },
    [selectedLayerIds, setAppState],
  );

  const handleToggleVisibility = useCallback(
    (layerId: LayerId) => {
      const updatedLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      );
      setAppState({ layers: updatedLayers });
    },
    [layers, setAppState],
  );

  const handleAddLayer = useCallback(() => {
    const maxOrder = layers.reduce(
      (max, layer) => Math.max(max, layer.order),
      0,
    );
    const newLayer: Layer = {
      id: randomId(),
      name: generateLayerName(layers),
      visible: true,
      locked: false,
      order: maxOrder + 1,
    };
    setAppState({
      layers: [...layers, newLayer],
      activeLayerId: newLayer.id,
      selectedLayerIds: { [newLayer.id]: true },
    });
  }, [layers, setAppState]);

  const handleRenameLayer = useCallback(
    (layerId: LayerId, newName: string) => {
      const updatedLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, name: newName } : layer,
      );
      setAppState({ layers: updatedLayers });
    },
    [layers, setAppState],
  );

  const handleDeleteLayer = useCallback(
    (layerId: LayerId) => {
      // Cannot delete if it's the last layer
      if (layers.length <= 1) {
        return;
      }

      // Find the layer to fall back to (lowest order layer)
      const remainingLayers = layers.filter((l) => l.id !== layerId);
      const targetLayer = remainingLayers.reduce((min, layer) =>
        layer.order < min.order ? layer : min,
      );

      // Update active layer if we're deleting the active one
      const newActiveLayerId =
        activeLayerId === layerId ? targetLayer.id : activeLayerId;

      // Remove from selectedLayerIds if present
      const newSelectedLayerIds = { ...selectedLayerIds };
      delete newSelectedLayerIds[layerId];

      setAppState({
        layers: remainingLayers,
        activeLayerId: newActiveLayerId,
        selectedLayerIds: newSelectedLayerIds,
      });

      // Note: Elements on the deleted layer will remain with their layerId
      // They will be treated as belonging to the default layer when rendered
    },
    [layers, activeLayerId, selectedLayerIds, setAppState],
  );

  const handleMoveLayerUp = useCallback(
    (layerId: LayerId) => {
      const sortedByOrder = [...layers].sort((a, b) => b.order - a.order);
      const currentIndex = sortedByOrder.findIndex((l) => l.id === layerId);

      if (currentIndex <= 0) {
        return; // Already at top
      }

      const currentLayer = sortedByOrder[currentIndex];
      const aboveLayer = sortedByOrder[currentIndex - 1];

      // Swap orders
      const updatedLayers = layers.map((layer) => {
        if (layer.id === currentLayer.id) {
          return { ...layer, order: aboveLayer.order };
        }
        if (layer.id === aboveLayer.id) {
          return { ...layer, order: currentLayer.order };
        }
        return layer;
      });

      setAppState({ layers: updatedLayers });
    },
    [layers, setAppState],
  );

  const handleMoveLayerDown = useCallback(
    (layerId: LayerId) => {
      const sortedByOrder = [...layers].sort((a, b) => b.order - a.order);
      const currentIndex = sortedByOrder.findIndex((l) => l.id === layerId);

      if (currentIndex >= sortedByOrder.length - 1) {
        return; // Already at bottom
      }

      const currentLayer = sortedByOrder[currentIndex];
      const belowLayer = sortedByOrder[currentIndex + 1];

      // Swap orders
      const updatedLayers = layers.map((layer) => {
        if (layer.id === currentLayer.id) {
          return { ...layer, order: belowLayer.order };
        }
        if (layer.id === belowLayer.id) {
          return { ...layer, order: currentLayer.order };
        }
        return layer;
      });

      setAppState({ layers: updatedLayers });
    },
    [layers, setAppState],
  );

  /**
   * Handle merge selected layers
   */
  const handleMergeSelectedLayers = useCallback(() => {
    if (selectedLayerCount < 2) {
      return;
    }
    app.actionManager.executeAction(actionMergeSelectedLayers);
  }, [selectedLayerCount, app.actionManager]);

  /**
   * Handle merge all layers
   */
  const handleMergeAllLayers = useCallback(() => {
    if (layers.length < 2) {
      return;
    }
    app.actionManager.executeAction(actionMergeAllLayers);
  }, [layers.length, app.actionManager]);

  /**
   * Clear layer selection
   */
  const handleClearSelection = useCallback(() => {
    setAppState({ selectedLayerIds: {} });
  }, [setAppState]);

  return (
    <LayersPanelWrapper>
      <div className="layer-ui__layers-header">
        <h3 className="layer-ui__layers-title">{t("labels.layers")}</h3>
        <div className="layer-ui__layers-header-actions">
          {layers.length >= 2 && (
            <button
              className="layer-ui__layers-header-button"
              onClick={handleMergeAllLayers}
              title={t("labels.mergeAllLayers")}
            >
              {t("labels.mergeAll")}
            </button>
          )}
          <button
            className="layer-ui__layers-add-button"
            onClick={handleAddLayer}
            title={t("labels.addLayer")}
          >
            +
          </button>
        </div>
      </div>

      {selectedLayerCount >= 2 && (
        <div className="layer-ui__layers-selection-bar">
          <span className="layer-ui__layers-selection-count">
            {t("labels.layersSelected", { count: selectedLayerCount })}
          </span>
          <div className="layer-ui__layers-selection-actions">
            <button
              className="layer-ui__layers-selection-action"
              onClick={handleMergeSelectedLayers}
              title={t("labels.mergeSelectedLayers")}
            >
              {t("labels.merge")}
            </button>
            <button
              className="layer-ui__layers-selection-action layer-ui__layers-selection-action--secondary"
              onClick={handleClearSelection}
              title={t("labels.clearSelection")}
            >
              {t("labels.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="layer-ui__layers-list">
        {sortedLayers.length === 0 ? (
          <div className="layer-ui__layers-empty">
            {t("labels.noLayersYet")}
          </div>
        ) : (
          sortedLayers.map((layer, index) => {
            const counts = layerCounts[layer.id] || { total: 0, selected: 0 };
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={layer.id === activeLayerId}
                isSelected={!!selectedLayerIds[layer.id]}
                isFirst={index === 0}
                isLast={index === sortedLayers.length - 1}
                canDelete={layers.length > 1}
                selectedCount={counts.selected}
                elementCount={counts.total}
                onSelect={(e) => handleSelectLayer(layer.id, e)}
                onToggleVisibility={() => handleToggleVisibility(layer.id)}
                onRename={(newName) => handleRenameLayer(layer.id, newName)}
                onDelete={() => handleDeleteLayer(layer.id)}
                onMoveUp={() => handleMoveLayerUp(layer.id)}
                onMoveDown={() => handleMoveLayerDown(layer.id)}
              />
            );
          })
        )}
      </div>

      <div className="layer-ui__layers-footer">
        <span className="layer-ui__layers-hint">
          {t("labels.layerMultiSelectHint")}
        </span>
      </div>
    </LayersPanelWrapper>
  );
});

LayersPanel.displayName = "LayersPanel";

import { useCallback } from "react";

import { MIME_TYPES } from "@excalidraw/common";

import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { t } from "../i18n";
import {
  isFavoriteTemplateId,
  toggleFavoriteTemplateId,
} from "../data/shapeTemplatesStorage";

import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

import "./ShapeTemplatesMenuItems.scss";

import type { ExcalidrawTemplateIds } from "../data/types";
import type { LibraryItem, ShapeTemplate, ShapeTemplates } from "../types";

const ITEMS_RENDERED_PER_BATCH = 17;

export default function ShapeTemplatesMenuItems({
  templates,
  onInsertTemplate,
  emptyMessage,
  onFavoritesChange,
}: {
  templates: ShapeTemplates;
  onInsertTemplate: (template: ShapeTemplate) => void;
  emptyMessage: string;
  onFavoritesChange: () => void;
}) {
  const { svgCache } = useLibraryCache();

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      const data: ExcalidrawTemplateIds = {
        templateIds: [id],
      };
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawTemplateIds,
        JSON.stringify(data),
      );
    },
    [],
  );

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return;
      }
      const template = templates.find((t) => t.id === id);
      if (template) {
        onInsertTemplate(template);
      }
    },
    [templates, onInsertTemplate],
  );

  const onItemSelectToggle = useCallback(() => {}, []);

  const isItemSelected = useCallback(() => false, []);

  const onToggleFavorite = useCallback(
    (event: React.MouseEvent, templateId: string) => {
      event.stopPropagation();
      toggleFavoriteTemplateId(templateId);
      onFavoritesChange();
    },
    [onFavoritesChange],
  );

  return (
    <div className="shape-templates-menu-items" role="tabpanel">
      {templates.length === 0 ? (
        <div className="shape-templates-menu-items__empty">{emptyMessage}</div>
      ) : (
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            items={templates.map((template) => ({
              id: template.id,
              status: "unpublished" as const,
              elements: template.elements,
              created: 0,
            }))}
            onClick={onItemClick}
            onItemDrag={onItemDrag}
            onItemSelectToggle={onItemSelectToggle}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
            itemsRenderedPerBatch={ITEMS_RENDERED_PER_BATCH}
            renderItemOverlay={(id) => {
              const favorited = isFavoriteTemplateId(id);
              return (
                <button
                  type="button"
                  className={`shape-templates-menu-items__favorite${
                    favorited
                      ? " shape-templates-menu-items__favorite--active"
                      : ""
                  }`}
                  aria-label={
                    favorited
                      ? t("shapeTemplates.removeFavorite")
                      : t("shapeTemplates.addFavorite")
                  }
                  onClick={(event) => onToggleFavorite(event, id)}
                >
                  ★
                </button>
              );
            }}
          />
        </LibraryMenuSectionGrid>
      )}
    </div>
  );
}

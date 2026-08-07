import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { duplicateElements } from "@excalidraw/element";

import { distributeLibraryItemsOnSquareGrid } from "../data/library";
import {
  getAllShapeTemplates,
  loadUserShapeTemplates,
} from "../data/shapeTemplates";
import {
  getFavoriteTemplateIds,
  getRecentTemplateIds,
  pushRecentTemplateId,
} from "../data/shapeTemplatesStorage";
import { t } from "../i18n";

import { useApp } from "./App";
import ShapeTemplatesMenuItems from "./ShapeTemplatesMenuItems";
import { searchIcon } from "./icons";

import "./ShapeTemplatesMenu.scss";

import type { LibraryItem, ShapeTemplate, ShapeTemplates } from "../types";

type TemplatesTab = "recent" | "favorites";

const toLibraryItems = (templates: ShapeTemplates): LibraryItem[] =>
  templates.map((template) => ({
    id: template.id,
    status: "unpublished" as const,
    elements: template.elements,
    created: 0,
    name: template.name,
  }));

export const ShapeTemplatesMenu = memo(() => {
  const { onInsertElements } = useApp();
  const [templates, setTemplates] = useState<ShapeTemplates>(() =>
    getAllShapeTemplates(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TemplatesTab>("recent");
  const [favoritesRevision, setFavoritesRevision] = useState(0);

  useEffect(() => {
    loadUserShapeTemplates();
    setTemplates(getAllShapeTemplates());
  }, []);

  const libraryItems = useMemo(() => toLibraryItems(templates), [templates]);

  const displayedTemplates = useMemo(() => {
    void favoritesRevision;
    const query = searchQuery.trim().toLowerCase();

    let list: ShapeTemplate[];
    if (activeTab === "favorites") {
      const favoriteIds = new Set(getFavoriteTemplateIds());
      list = templates.filter((template) => favoriteIds.has(template.id));
    } else {
      const recentIds = getRecentTemplateIds();
      const byId = new Map(templates.map((template) => [template.id, template]));
      list = recentIds
        .map((id) => byId.get(id))
        .filter((template): template is ShapeTemplate => template != null);
      if (list.length === 0) {
        list = [...templates];
      }
    }

    if (!query) {
      return list;
    }

    return list.filter((template) => {
      const name = template.name.toLowerCase();
      const category = (template.category || "").toLowerCase();
      return name.includes(query) || category.includes(query);
    });
  }, [activeTab, favoritesRevision, searchQuery, templates]);

  const onInsertTemplates = useCallback(
    (items: LibraryItem[]) => {
      const duplicated = items.map((item) => ({
        ...item,
        elements: duplicateElements({
          type: "everything",
          elements: item.elements,
          randomizeSeed: true,
          preserveFrameChildrenOrder: true,
        }).duplicatedElements,
      }));
      onInsertElements(distributeLibraryItemsOnSquareGrid(duplicated));
    },
    [onInsertElements],
  );

  const onInsertTemplate = useCallback(
    (template: ShapeTemplate) => {
      pushRecentTemplateId(template.id);
      const item = libraryItems.find((i) => i.id === template.id);
      if (item) {
        onInsertTemplates([item]);
      }
    },
    [libraryItems, onInsertTemplates],
  );

  return (
    <div className="layer-ui__shape-templates">
      <label className="shape-templates-menu__search">
        {searchIcon}
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("shapeTemplates.searchPlaceholder")}
          aria-label={t("shapeTemplates.searchPlaceholder")}
          data-testid="shape-templates-search"
        />
      </label>

      <div
        className="shape-templates-menu__tabs"
        role="tablist"
        aria-label={t("shapeTemplates.tabsLabel")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "recent"}
          className={clsx("shape-templates-menu__tab", {
            "shape-templates-menu__tab--active": activeTab === "recent",
          })}
          onClick={() => setActiveTab("recent")}
          data-testid="shape-templates-tab-recent"
        >
          {t("shapeTemplates.recent")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "favorites"}
          className={clsx("shape-templates-menu__tab", {
            "shape-templates-menu__tab--active": activeTab === "favorites",
          })}
          onClick={() => setActiveTab("favorites")}
          data-testid="shape-templates-tab-favorites"
        >
          {t("shapeTemplates.favorites")}
        </button>
      </div>

      <ShapeTemplatesMenuItems
        templates={displayedTemplates}
        onInsertTemplate={onInsertTemplate}
        emptyMessage={
          activeTab === "favorites"
            ? t("shapeTemplates.emptyFavorites")
            : searchQuery.trim()
              ? t("shapeTemplates.emptySearch")
              : t("shapeTemplates.empty")
        }
        onFavoritesChange={() => setFavoritesRevision((n) => n + 1)}
      />
      <p className="shape-templates-menu__hint">{t("shapeTemplates.hint")}</p>
    </div>
  );
});

ShapeTemplatesMenu.displayName = "ShapeTemplatesMenu";

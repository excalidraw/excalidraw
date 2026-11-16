import clsx from "clsx";
import { useCallback, useMemo } from "react";

import { arrayToMap } from "@excalidraw/common";
import {
  getBoundTextElement,
  getFrameLikeTitle,
  isFrameLikeElement,
  isTextElement,
} from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";
import { navigateToBookmark } from "../bookmarkNavigation";

import { useApp, useExcalidrawElements, useExcalidrawSetAppState } from "./App";
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  EmbedIcon,
  FreedrawIcon,
  ImageIcon,
  LineIcon,
  RectangleIcon,
  SelectionIcon,
  TextIcon,
  bookmarkIcon,
  frameToolIcon,
  stickyNoteToolIcon,
} from "./icons";

import "./BookmarksMenu.scss";

export const getElementBookmarkLabel = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): string => {
  if (isFrameLikeElement(element)) {
    return getFrameLikeTitle(element);
  }

  if (isTextElement(element)) {
    const text = element.text?.trim();
    if (text) {
      return text.split("\n")[0].trim();
    }
    return t("element.text");
  }

  const boundText = getBoundTextElement(element, elementsMap);
  if (boundText) {
    const text = boundText.text?.trim();
    if (text) {
      return text.split("\n")[0].trim();
    }
  }

  const typeKey = `element.${element.type}` as const;
  const translated = t(typeKey as any);
  if (translated && translated !== typeKey) {
    return translated;
  }

  return element.type;
};

export const getElementIcon = (element: ExcalidrawElement) => {
  switch (element.type) {
    case "rectangle":
      return RectangleIcon;
    case "diamond":
      return DiamondIcon;
    case "ellipse":
      return EllipseIcon;
    case "arrow":
      return ArrowIcon;
    case "line":
      return LineIcon;
    case "freedraw":
      return FreedrawIcon;
    case "text":
      return TextIcon;
    case "image":
      return ImageIcon;
    case "frame":
    case "magicframe":
      return frameToolIcon;
    case "stickynote":
      return stickyNoteToolIcon;
    case "embeddable":
    case "iframe":
      return EmbedIcon;
    default:
      return SelectionIcon;
  }
};

export const BookmarksMenu = () => {
  const app = useApp();
  const appState = useUIAppState();
  const elements = useExcalidrawElements();
  const setAppState = useExcalidrawSetAppState();

  const elementsMap = useMemo(() => arrayToMap(elements), [elements]);

  const bookmarkedElements = useMemo(() => {
    const result: NonDeletedExcalidrawElement[] = [];
    for (const id of appState.bookmarkedElementIds) {
      const element = elementsMap.get(id);
      if (element && !element.isDeleted) {
        result.push(element);
      }
    }
    return result;
  }, [appState.bookmarkedElementIds, elementsMap]);

  const bookmarkLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const element of bookmarkedElements) {
      const label = getElementBookmarkLabel(element, elementsMap);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }, [bookmarkedElements, elementsMap]);

  const handleBookmarkClick = useCallback(
    (element: NonDeletedExcalidrawElement) => {
      navigateToBookmark(element, app, setAppState);
    },
    [app, setAppState],
  );

  return (
    <div className="layer-ui__bookmarks">
      {bookmarkedElements.length > 0 ? (
        <div className="layer-ui__bookmarks-list">
          {bookmarkedElements.map((element, index) => {
            const label = getElementBookmarkLabel(element, elementsMap);
            const icon = getElementIcon(element);
            const isSelected = !!appState.selectedElementIds[element.id];
            const accessibleLabel =
              (bookmarkLabelCounts.get(label) ?? 0) > 1
                ? `${label} (${index + 1} of ${bookmarkedElements.length})`
                : label;

            return (
              <button
                type="button"
                key={element.id}
                className={clsx("layer-ui__bookmarks-item", {
                  active: isSelected,
                })}
                title={label}
                aria-label={accessibleLabel}
                aria-current={isSelected ? "location" : undefined}
                onClick={() => handleBookmarkClick(element)}
              >
                <div className="layer-ui__bookmarks-item-icon">{icon}</div>
                <span
                  className="layer-ui__bookmarks-item-label"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="layer-ui__bookmarks-empty">
          <div className="layer-ui__bookmarks-empty-icon">{bookmarkIcon}</div>
          <div className="layer-ui__bookmarks-empty-title">
            {t("bookmarks.empty")}
          </div>
          <div className="layer-ui__bookmarks-empty-hint">
            {t("bookmarks.emptyHint")}
          </div>
        </div>
      )}
    </div>
  );
};

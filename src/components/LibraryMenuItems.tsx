import React, { useState } from "react";
import { serializeLibraryAsJSON } from "../data/json";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { t } from "../i18n";
import {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";
import { arrayToMap, chunk } from "../utils";
import { LibraryUnit } from "./LibraryUnit";
import Stack from "./Stack";
import { MIME_TYPES } from "../constants";
import Spinner from "./Spinner";
import { duplicateElements } from "../element/newElement";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";

import "./LibraryMenuItems.scss";
import LibraryMenuSection from "./LibraryMenuSection";

const CELLS_PER_ROW = 4;

const LibraryMenuItems = ({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  selectedItems,
  onSelectItems,
  theme,
  id,
  libraryReturnUrl,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
}) => {
  const unpublishedItems = libraryItems.filter(
    (item) => item.status !== "published",
  );
  const publishedItems = libraryItems.filter(
    (item) => item.status === "published",
  );

  const showBtn = !libraryItems.length && !pendingElements.length;

  const isLibraryEmpty =
    !pendingElements.length &&
    !unpublishedItems.length &&
    !publishedItems.length;

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length ||
        unpublishedItems.length ||
        publishedItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      {!isLibraryEmpty && (
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      )}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          flex: publishedItems.length > 0 ? 1 : "0 1 auto",
          marginBottom: 0,
        }}
      >
        <>
          {!isLibraryEmpty && (
            <div className="library-menu-items-container__header">
              {t("labels.personalLib")}
            </div>
          )}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: "var(--container-padding-y)",
                right: "var(--container-padding-x)",
                transform: "translateY(50%)",
              }}
            >
              <Spinner />
            </div>
          )}
          <div className="library-menu-items-private-library-container">
            {!pendingElements.length && !unpublishedItems.length ? (
              <div className="library-menu-items__no-items">
                <div className="library-menu-items__no-items__label">
                  {t("library.noItems")}
                </div>
                <div className="library-menu-items__no-items__hint">
                  {publishedItems.length > 0
                    ? t("library.hint_emptyPrivateLibrary")
                    : t("library.hint_emptyLibrary")}
                </div>
              </div>
            ) : (
              <LibraryMenuSection
                items={[
                  // append pending library item
                  ...(pendingElements.length
                    ? [{ id: null, elements: pendingElements }]
                    : []),
                  ...unpublishedItems,
                ]}
                itemsPerRow={4}
              />
            )}
          </div>
        </>

        <>
          {(publishedItems.length > 0 ||
            pendingElements.length > 0 ||
            unpublishedItems.length > 0) && (
            <div className="library-menu-items-container__header library-menu-items-container__header--excal">
              {t("labels.excalidrawLib")}
            </div>
          )}
          {publishedItems.length > 0 ? (
            <LibraryMenuSection items={publishedItems} itemsPerRow={4} />
          ) : unpublishedItems.length > 0 ? (
            <div
              style={{
                margin: "1rem 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                fontSize: ".9rem",
              }}
            >
              {t("library.noItems")}
            </div>
          ) : null}
        </>

        {showBtn && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          >
            <LibraryDropdownMenu
              selectedItems={selectedItems}
              onSelectItems={onSelectItems}
            />
          </LibraryMenuControlButtons>
        )}
      </Stack.Col>
    </div>
  );
};

export default LibraryMenuItems;

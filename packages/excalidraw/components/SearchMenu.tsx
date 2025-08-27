import { round } from "@excalidraw/math";
import clsx from "clsx";
import debounce from "lodash.debounce";
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CLASSES,
  EVENT,
  FONT_FAMILY,
  FRAME_STYLE,
  getLineHeight,
} from "@excalidraw/common";
import { isElementCompletelyInViewport } from "@excalidraw/element";
import { measureText } from "@excalidraw/element";
import {
  KEYS,
  randomInteger,
  addEventListener,
  getFontString,
} from "@excalidraw/common";
import { newTextElement } from "@excalidraw/element";
import { isTextElement, isFrameLikeElement } from "@excalidraw/element";
import { getDefaultFrameName } from "@excalidraw/element/frame";
import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import { atom, useAtom } from "../editor-jotai";
import { useStable } from "../hooks/useStable";
import { t } from "../i18n";
import { useApp, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { TextField } from "./TextField";
import {
  collapseDownIcon,
  upIcon,
  searchIcon,
  frameToolIcon,
  TextIcon,
} from "./icons";
import "./SearchMenu.scss";
import type { AppClassProperties, SearchMatch } from "../types";

const searchQueryAtom = atom<string>("");
export const searchItemInFocusAtom = atom<number | null>(null);

const SEARCH_DEBOUNCE = 350;

type SearchMatchItem = {
  element: ExcalidrawTextElement | ExcalidrawFrameLikeElement;
  searchQuery: SearchQuery;
  index: number;
  preview: {
    indexInSearchQuery: number;
    previewText: string;
    moreBefore: boolean;
    moreAfter: boolean;
  };
  matchedLines: SearchMatch["matchedLines"];
};

type SearchMatches = {
  nonce: number | null;
  items: SearchMatchItem[];
};

type SearchQuery = string & { _brand: "SearchQuery" };

export const SearchMenu = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useAtom(searchQueryAtom);
  const searchQuery = inputValue.trim() as SearchQuery;

  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatches>({
    nonce: null,
    items: [],
  });

  const searchedQueryRef = useRef<SearchQuery | null>(null);
  const lastSceneNonceRef = useRef<number | undefined>(undefined);

  const [focusIndex, setFocusIndex] = useAtom(searchItemInFocusAtom);

  const elementsMap = app.scene.getNonDeletedElementsMap();

  useEffect(() => {
    if (isSearching) {
      return;
    }

    if (
      searchQuery !== searchedQueryRef.current ||
      app.scene.getSceneNonce() !== lastSceneNonceRef.current
    ) {
      searchedQueryRef.current = null;
      handleSearch(searchQuery, app, (matchItems, index) => {
        setSearchMatches({
          nonce: randomInteger(),
          items: matchItems,
        });
        searchedQueryRef.current = searchQuery;
        lastSceneNonceRef.current = app.scene.getSceneNonce();
        setAppState({
          searchMatches: matchItems.length
            ? {
                focusedId: null,
                matches: matchItems.map((searchMatch) => ({
                  id: searchMatch.element.id,
                  focus: false,
                  matchedLines: searchMatch.matchedLines,
                })),
              }
            : null,
        });
      });
    }
  }, [
    isSearching,
    searchQuery,
    elementsMap,
    app,
    setAppState,
    setFocusIndex,
    lastSceneNonceRef,
  ]);

  const goToNextItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }
        return (focusIndex + 1) % searchMatches.items.length;
      });
    }
  };

  const goToPreviousItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }
        return focusIndex - 1 < 0
          ? searchMatches.items.length - 1
          : focusIndex - 1;
      });
    }
  };

  useEffect(() => {
    setAppState((state) => {
      if (!state.searchMatches) {
        return null;
      }
      const focusedId =
        focusIndex !== null
          ? state.searchMatches?.matches[focusIndex]?.id || null
          : null;

      return {
        searchMatches: {
          focusedId,
          matches: state.searchMatches.matches.map((match, index) => {
            if (index === focusIndex) {
              return { ...match, focus: true };
            }
            return { ...match, focus: false };
          }),
        },
      };
    });
  }, [focusIndex, setAppState]);

  useEffect(() => {
    if (searchMatches.items.length > 0 && focusIndex !== null) {
      const match = searchMatches.items[focusIndex];
      if (match) {
        const zoomValue = app.state.zoom.value;

        const matchAsElement = newTextElement({
          text: match.searchQuery,
          x: match.element.x + (match.matchedLines[0]?.offsetX ?? 0),
          y: match.element.y + (match.matchedLines[0]?.offsetY ?? 0),
          width: match.matchedLines[0]?.width,
          height: match.matchedLines[0]?.height,
          fontSize: isFrameLikeElement(match.element)
            ? FRAME_STYLE.nameFontSize
            : match.element.fontSize,
          fontFamily: isFrameLikeElement(match.element)
            ? FONT_FAMILY.Assistant
            : match.element.fontFamily,
        });

        const FONT_SIZE_LEGIBILITY_THRESHOLD = 14;
        const fontSize = matchAsElement.fontSize;
        const isTextTiny =
          fontSize * zoomValue < FONT_SIZE_LEGIBILITY_THRESHOLD;

        if (
          !isElementCompletelyInViewport(
            [matchAsElement],
            app.canvas.width / window.devicePixelRatio,
            app.canvas.height / window.devicePixelRatio,
            {
              offsetLeft: app.state.offsetLeft,
              offsetTop: app.state.offsetTop,
              scrollX: app.state.scrollX,
              scrollY: app.state.scrollY,
              zoom: app.state.zoom,
            },
            app.scene.getNonDeletedElementsMap(),
            app.getEditorUIOffsets(),
          ) ||
          isTextTiny
        ) {
          let zoomOptions: Parameters<AppClassProperties["scrollToContent"]>[1];
          if (isTextTiny) {
            if (fontSize >= FONT_SIZE_LEGIBILITY_THRESHOLD) {
              zoomOptions = { fitToContent: true };
            } else {
              zoomOptions = {
                fitToViewport: true,
                maxZoom: round(FONT_SIZE_LEGIBILITY_THRESHOLD / fontSize, 1),
              };
            }
          } else {
            zoomOptions = { fitToContent: true };
          }

          app.scrollToContent(matchAsElement, {
            animate: true,
            duration: 300,
            ...zoomOptions,
            canvasOffsets: app.getEditorUIOffsets(),
          });
        }
      }
    }
  }, [focusIndex, searchMatches, app]);

  useEffect(() => {
    return () => {
      setFocusIndex(null);
      searchedQueryRef.current = null;
      lastSceneNonceRef.current = undefined;
      setAppState({
        searchMatches: null,
      });
      setIsSearching(false);
    };
  }, [setAppState, setFocusIndex]);

  const stableState = useStable({
    goToNextItem,
    goToPreviousItem,
    searchMatches,
  });

  useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      if (
        event.key === KEYS.ESCAPE &&
        !app.state.openDialog &&
        !app.state.openPopup
      ) {
        event.preventDefault();
        event.stopPropagation();
        setAppState({
          openSidebar: null,
        });
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F) {
        event.preventDefault();
        event.stopPropagation();
        if (app.state.openDialog) {
          return;
        }

        if (!searchInputRef.current?.matches(":focus")) {
          if (app.state.openDialog) {
            setAppState({
              openDialog: null,
            });
          }
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }

      if (
        event.target instanceof HTMLElement &&
        event.target.closest(".layer-ui__search")
      ) {
        if (stableState.searchMatches.items.length) {
          if (event.key === KEYS.ENTER) {
            event.stopPropagation();
            stableState.goToNextItem();
          }

          if (event.key === KEYS.ARROW_UP) {
            event.stopPropagation();
            stableState.goToPreviousItem();
          } else if (event.key === KEYS.ARROW_DOWN) {
            event.stopPropagation();
            stableState.goToNextItem();
          }
        }
      }
    };

    return addEventListener(window, EVENT.KEYDOWN, eventHandler, {
      capture: true,
      passive: false,
    });
  }, [setAppState, stableState, app]);

  const matchCount = `${searchMatches.items.length} ${
    searchMatches.items.length === 1
      ? t("search.singleResult")
      : t("search.multipleResults")
  }`;

  return (
    <div className="layer-ui__search">
      <div className="layer-ui__search-header">
        <TextField
          className={CLASSES.SEARCH_MENU_INPUT_WRAPPER}
          value={inputValue}
          ref={searchInputRef}
          placeholder={t("search.placeholder")}
          icon={searchIcon}
          onChange={(value) => {
            setInputValue(value);
            setIsSearching(true);
            const searchQuery = value.trim() as SearchQuery;
            handleSearch(searchQuery, app, (matchItems, index) => {
              setSearchMatches({
                nonce: randomInteger(),
                items: matchItems,
              });
              setFocusIndex(index);
              searchedQueryRef.current = searchQuery;
              lastSceneNonceRef.current = app.scene.getSceneNonce();
              setAppState({
                searchMatches: matchItems.length
                  ? {
                      focusedId: null,
                      matches: matchItems.map((searchMatch) => ({
                        id: searchMatch.element.id,
                        focus: false,
                        matchedLines: searchMatch.matchedLines,
                      })),
                    }
                  : null,
              });
              setIsSearching(false);
            });
          }}
          selectOnRender
        />
      </div>
      <div className="layer-ui__search-count">
        {searchMatches.items.length > 0 && (
          <>
            {focusIndex !== null && focusIndex > -1 ? (
              <div>
                {focusIndex + 1} / {matchCount}
              </div>
            ) : (
              {matchCount}
            )}
            <div className="result-nav">
              <Button
                onSelect={() => {
                  goToNextItem();
                }}
                className="result-nav-btn"
              >
                {collapseDownIcon}
              </Button>
              <Button
                onSelect={() => {
                  goToPreviousItem();
                }}
                className="result-nav-btn"
              >
                {upIcon}
              </Button>
            </div>
          </>
        )}
        {searchMatches.items.length === 0 &&
          searchQuery &&
          searchedQueryRef.current && (
            <div style={{ margin: "auto" }}>{t("search.noMatch")}</div>
          )}
      </div>
      <MatchList
        matches={searchMatches}
        onItemClick={setFocusIndex}
        

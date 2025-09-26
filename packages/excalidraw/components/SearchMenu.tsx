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
                // calculate zoom level to make the fontSize ~equal to FONT_SIZE_THRESHOLD, rounded to nearest 10%
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

    // `capture` needed to prevent firing on initial open from App.tsx,
    // as well as to handle events before App ones
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
              <div>{matchCount}</div>
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
            <div style={{ margin: "1rem auto" }}>{t("search.noMatch")}</div>
          )}
      </div>

      <MatchList
        matches={searchMatches}
        onItemClick={setFocusIndex}
        focusIndex={focusIndex}
        searchQuery={searchQuery}
      />
    </div>
  );
};

const ListItem = (props: {
  preview: SearchMatchItem["preview"];
  searchQuery: SearchQuery;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  const preview = [
    props.preview.moreBefore ? "..." : "",
    props.preview.previewText.slice(0, props.preview.indexInSearchQuery),
    props.preview.previewText.slice(
      props.preview.indexInSearchQuery,
      props.preview.indexInSearchQuery + props.searchQuery.length,
    ),
    props.preview.previewText.slice(
      props.preview.indexInSearchQuery + props.searchQuery.length,
    ),
    props.preview.moreAfter ? "..." : "",
  ];

  return (
    <div
      tabIndex={-1}
      className={clsx("layer-ui__result-item", {
        active: props.highlighted,
      })}
      onClick={props.onClick}
      ref={(ref) => {
        if (props.highlighted) {
          ref?.scrollIntoView({ behavior: "auto", block: "nearest" });
        }
      }}
    >
      <div className="preview-text">
        {preview.flatMap((text, idx) => (
          <Fragment key={idx}>{idx === 2 ? <b>{text}</b> : text}</Fragment>
        ))}
      </div>
    </div>
  );
};

interface MatchListProps {
  matches: SearchMatches;
  onItemClick: (index: number) => void;
  focusIndex: number | null;
  searchQuery: SearchQuery;
}

const MatchListBase = (props: MatchListProps) => {
  const frameNameMatches = useMemo(
    () =>
      props.matches.items.filter((match) => isFrameLikeElement(match.element)),
    [props.matches],
  );

  const textMatches = useMemo(
    () => props.matches.items.filter((match) => isTextElement(match.element)),
    [props.matches],
  );

  return (
    <div>
      {frameNameMatches.length > 0 && (
        <div className="layer-ui__search-result-container">
          <div className="layer-ui__search-result-title">
            <div className="title-icon">{frameToolIcon}</div>
            <div>{t("search.frames")}</div>
          </div>
          {frameNameMatches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.element.id + searchMatch.index}
              searchQuery={props.searchQuery}
              preview={searchMatch.preview}
              highlighted={index === props.focusIndex}
              onClick={() => props.onItemClick(index)}
            />
          ))}

          {textMatches.length > 0 && <div className="layer-ui__divider" />}
        </div>
      )}

      {textMatches.length > 0 && (
        <div className="layer-ui__search-result-container">
          <div className="layer-ui__search-result-title">
            <div className="title-icon">{TextIcon}</div>
            <div>{t("search.texts")}</div>
          </div>
          {textMatches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.element.id + searchMatch.index}
              searchQuery={props.searchQuery}
              preview={searchMatch.preview}
              highlighted={index + frameNameMatches.length === props.focusIndex}
              onClick={() => props.onItemClick(index + frameNameMatches.length)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const areEqual = (prevProps: MatchListProps, nextProps: MatchListProps) => {
  return (
    prevProps.matches.nonce === nextProps.matches.nonce &&
    prevProps.focusIndex === nextProps.focusIndex
  );
};

const MatchList = memo(MatchListBase, areEqual);

const getMatchPreview = (
  text: string,
  index: number,
  searchQuery: SearchQuery,
) => {
  const WORDS_BEFORE = 2;
  const WORDS_AFTER = 5;

  const substrBeforeQuery = text.slice(0, index);
  const wordsBeforeQuery = substrBeforeQuery.split(/\s+/);
  // text = "small", query = "mall", not complete before
  // text = "small", query = "smal", complete before
  const isQueryCompleteBefore = substrBeforeQuery.endsWith(" ");
  const startWordIndex =
    wordsBeforeQuery.length -
    WORDS_BEFORE -
    1 -
    (isQueryCompleteBefore ? 0 : 1);
  let wordsBeforeAsString =
    wordsBeforeQuery.slice(startWordIndex <= 0 ? 0 : startWordIndex).join(" ") +
    (isQueryCompleteBefore ? " " : "");

  const MAX_ALLOWED_CHARS = 20;

  wordsBeforeAsString =
    wordsBeforeAsString.length > MAX_ALLOWED_CHARS
      ? wordsBeforeAsString.slice(-MAX_ALLOWED_CHARS)
      : wordsBeforeAsString;

  const substrAfterQuery = text.slice(index + searchQuery.length);
  const wordsAfter = substrAfterQuery.split(/\s+/);
  // text = "small", query = "mall", complete after
  // text = "small", query = "smal", not complete after
  const isQueryCompleteAfter = !substrAfterQuery.startsWith(" ");
  const numberOfWordsToTake = isQueryCompleteAfter
    ? WORDS_AFTER + 1
    : WORDS_AFTER;
  const wordsAfterAsString =
    (isQueryCompleteAfter ? "" : " ") +
    wordsAfter.slice(0, numberOfWordsToTake).join(" ");

  return {
    indexInSearchQuery: wordsBeforeAsString.length,
    previewText: wordsBeforeAsString + searchQuery + wordsAfterAsString,
    moreBefore: startWordIndex > 0,
    moreAfter: wordsAfter.length > numberOfWordsToTake,
  };
};

const normalizeWrappedText = (
  wrappedText: string,
  originalText: string,
): string => {
  const wrappedLines = wrappedText.split("\n");
  const normalizedLines: string[] = [];
  let originalIndex = 0;

  for (let i = 0; i < wrappedLines.length; i++) {
    let currentLine = wrappedLines[i];
    const nextLine = wrappedLines[i + 1];

    if (nextLine) {
      const nextLineIndexInOriginal = originalText.indexOf(
        nextLine,
        originalIndex,
      );

      if (nextLineIndexInOriginal > currentLine.length + originalIndex) {
        let j = nextLineIndexInOriginal - (currentLine.length + originalIndex);

        while (j > 0) {
          currentLine += " ";
          j--;
        }
      }
    }

    normalizedLines.push(currentLine);
    originalIndex = originalIndex + currentLine.length;
  }

  return normalizedLines.join("\n");
};

const getMatchedLines = (
  textElement: ExcalidrawTextElement,
  searchQuery: SearchQuery,
  index: number,
) => {
  const normalizedText = normalizeWrappedText(
    textElement.text,
    textElement.originalText,
  );

  const lines = normalizedText.split("\n");

  const lineIndexRanges = [];
  let currentIndex = 0;
  let lineNumber = 0;

  for (const line of lines) {
    const startIndex = currentIndex;
    const endIndex = startIndex + line.length - 1;

    lineIndexRanges.push({
      line,
      startIndex,
      endIndex,
      lineNumber,
    });

    // Move to the next line's start index
    currentIndex = endIndex + 1;
    lineNumber++;
  }

  let startIndex = index;
  let remainingQuery = textElement.originalText.slice(
    index,
    index + searchQuery.length,
  );
  const matchedLines: SearchMatch["matchedLines"] = [];

  for (const lineIndexRange of lineIndexRanges) {
    if (remainingQuery === "") {
      break;
    }

    if (
      startIndex >= lineIndexRange.startIndex &&
      startIndex <= lineIndexRange.endIndex
    ) {
      const matchCapacity = lineIndexRange.endIndex + 1 - startIndex;
      const textToStart = lineIndexRange.line.slice(
        0,
        startIndex - lineIndexRange.startIndex,
      );

      const matchedWord = remainingQuery.slice(0, matchCapacity);
      remainingQuery = remainingQuery.slice(matchCapacity);

      const offset = measureText(
        textToStart,
        getFontString(textElement),
        textElement.lineHeight,
      );

      // measureText returns a non-zero width for the empty string
      // which is not what we're after here, hence the check and the correction
      if (textToStart === "") {
        offset.width = 0;
      }

      if (textElement.textAlign !== "left" && lineIndexRange.line.length > 0) {
        const lineLength = measureText(
          lineIndexRange.line,
          getFontString(textElement),
          textElement.lineHeight,
        );

        const spaceToStart =
          textElement.textAlign === "center"
            ? (textElement.width - lineLength.width) / 2
            : textElement.width - lineLength.width;
        offset.width += spaceToStart;
      }

      const { width, height } = measureText(
        matchedWord,
        getFontString(textElement),
        textElement.lineHeight,
      );

      const offsetX = offset.width;
      const offsetY = lineIndexRange.lineNumber * offset.height;

      matchedLines.push({
        offsetX,
        offsetY,
        width,
        height,
        showOnCanvas: true,
      });

      startIndex += matchCapacity;
    }
  }

  return matchedLines;
};

const getMatchInFrame = (
  frame: ExcalidrawFrameLikeElement,
  searchQuery: SearchQuery,
  index: number,
  zoomValue: number,
): SearchMatch["matchedLines"] => {
  const text = frame.name ?? getDefaultFrameName(frame);
  const matchedText = text.slice(index, index + searchQuery.length);

  const prefixText = text.slice(0, index);
  const font = getFontString({
    fontSize: FRAME_STYLE.nameFontSize,
    fontFamily: FONT_FAMILY.Assistant,
  });

  const lineHeight = getLineHeight(FONT_FAMILY.Assistant);

  const offset = measureText(prefixText, font, lineHeight);

  // Correct non-zero width for empty string
  if (prefixText === "") {
    offset.width = 0;
  }

  const matchedMetrics = measureText(matchedText, font, lineHeight);

  const offsetX = offset.width;
  const offsetY = -offset.height - FRAME_STYLE.strokeWidth;
  const width = matchedMetrics.width;

  return [
    {
      offsetX,
      offsetY,
      width,
      height: matchedMetrics.height,
      showOnCanvas: offsetX + width <= frame.width * zoomValue,
    },
  ];
};

const escapeSpecialCharacters = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
};

const handleSearch = debounce(
  (
    searchQuery: SearchQuery,
    app: AppClassProperties,
    cb: (matchItems: SearchMatchItem[], focusIndex: number | null) => void,
  ) => {
    if (!searchQuery || searchQuery === "") {
      cb([], null);
      return;
    }

    const elements = app.scene.getNonDeletedElements();
    const texts = elements.filter((el) =>
      isTextElement(el),
    ) as ExcalidrawTextElement[];

    const frames = elements.filter((el) =>
      isFrameLikeElement(el),
    ) as ExcalidrawFrameLikeElement[];

    texts.sort((a, b) => a.y - b.y);
    frames.sort((a, b) => a.y - b.y);

    const textMatches: SearchMatchItem[] = [];

    const regex = new RegExp(escapeSpecialCharacters(searchQuery), "gi");

    for (const textEl of texts) {
      let match = null;
      const text = textEl.originalText;

      while ((match = regex.exec(text)) !== null) {
        const preview = getMatchPreview(text, match.index, searchQuery);
        const matchedLines = getMatchedLines(textEl, searchQuery, match.index);

        if (matchedLines.length > 0) {
          textMatches.push({
            element: textEl,
            searchQuery,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    const frameMatches: SearchMatchItem[] = [];

    for (const frame of frames) {
      let match = null;
      const name = frame.name ?? getDefaultFrameName(frame);

      while ((match = regex.exec(name)) !== null) {
        const preview = getMatchPreview(name, match.index, searchQuery);
        const matchedLines = getMatchInFrame(
          frame,
          searchQuery,
          match.index,
          app.state.zoom.value,
        );

        if (matchedLines.length > 0) {
          frameMatches.push({
            element: frame,
            searchQuery,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    const visibleIds = new Set(
      app.visibleElements.map((visibleElement) => visibleElement.id),
    );

    // putting frame matches first
    const matchItems: SearchMatchItem[] = [...frameMatches, ...textMatches];

    const focusIndex =
      matchItems.findIndex((matchItem) =>
        visibleIds.has(matchItem.element.id),
      ) ?? null;

    cb(matchItems, focusIndex);
  },
  SEARCH_DEBOUNCE,
);

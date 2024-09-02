import { useEffect, useRef, useState } from "react";
import { CloseIcon, TextIcon, collapseDownIcon, upIcon } from "./icons";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { useApp, useExcalidrawSetAppState } from "./App";
import { debounce } from "lodash";
import type { AppClassProperties } from "../types";
import { isTextElement, newTextElement } from "../element";
import type { ExcalidrawTextElement } from "../element/types";
import { measureText } from "../element/textElement";
import { getFontString } from "../utils";
import { KEYS } from "../keys";

import "./SearchMenu.scss";
import clsx from "clsx";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import { t } from "../i18n";
import { isElementCompletelyInViewport } from "../element/sizeHelpers";

export const searchItemInFocusAtom = atom<number | null>(null);

const SEARCH_DEBOUNCE = 250;

type SearchMatch = {
  textElement: ExcalidrawTextElement;
  keyword: string;
  index: number;
  preview: {
    indexInKeyword: number;
    previewText: string;
    moreBefore: boolean;
    moreAfter: boolean;
  };
  matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[];
};

export const SearchMenu = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [keyword, setKeyword] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const searchedKeywordRef = useRef<string | null>();
  const lastSceneNonceRef = useRef<number | undefined>();

  const [focusIndex, setFocusIndex] = useAtom(
    searchItemInFocusAtom,
    jotaiScope,
  );
  const elementsMap = app.scene.getNonDeletedElementsMap();

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (
      trimmedKeyword !== searchedKeywordRef.current ||
      app.scene.getSceneNonce() !== lastSceneNonceRef.current
    ) {
      searchedKeywordRef.current = null;
      handleSearch(trimmedKeyword, app, (matches) => {
        setMatches(matches);
        setFocusIndex(null);
        searchedKeywordRef.current = trimmedKeyword;
        lastSceneNonceRef.current = app.scene.getSceneNonce();
        setAppState({
          searchMatches: matches.map((searchMatch) => ({
            id: searchMatch.textElement.id,
            focus: false,
            matchedLines: searchMatch.matchedLines,
          })),
        });
      });
    }
  }, [
    keyword,
    elementsMap,
    app,
    setAppState,
    setFocusIndex,
    lastSceneNonceRef,
  ]);

  const goToNextItem = () => {
    if (matches.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return (focusIndex + 1) % matches.length;
      });
    }
  };

  const goToPreviousItem = () => {
    if (matches.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return focusIndex - 1 < 0 ? matches.length - 1 : focusIndex - 1;
      });
    }
  };

  useEffect(() => {
    if (matches.length > 0 && focusIndex !== null) {
      const match = matches[focusIndex];

      if (match) {
        const matchAsElement = newTextElement({
          text: match.keyword,
          x: match.textElement.x + (match.matchedLines[0]?.offsetX ?? 0),
          y: match.textElement.y + (match.matchedLines[0]?.offsetY ?? 0),
          width: match.matchedLines[0]?.width,
          height: match.matchedLines[0]?.height,
        });

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
          )
        ) {
          app.scrollToContent(matchAsElement, {
            fitToContent: true,
            animate: true,
            duration: 300,
          });
        }

        const nextMatches = matches.map((match, index) => {
          if (index === focusIndex) {
            return {
              id: match.textElement.id,
              focus: true,
              matchedLines: match.matchedLines,
            };
          }
          return {
            id: match.textElement.id,
            focus: false,
            matchedLines: match.matchedLines,
          };
        });

        setAppState({
          searchMatches: nextMatches,
        });
      }
    }
  }, [app, focusIndex, matches, setAppState]);

  useEffect(() => {
    return () => {
      setKeyword("");
      setFocusIndex(null);
      searchedKeywordRef.current = null;
      lastSceneNonceRef.current = undefined;
      setAppState({
        searchMatches: [],
      });
    };
  }, [setAppState, setFocusIndex]);

  const matchCount =
    matches.length === 1
      ? t("search.singleResult")
      : `${matches.length} ${t("search.multipleResults")}`;

  return (
    <div className="layer-ui__search">
      <div className="layer-ui__search-header">
        <div className="search-input">
          <TextField
            value={keyword}
            placeholder={t("search.placeholder")}
            onChange={(value) => {
              setKeyword(value);
            }}
            selectOnRender
            onKeyDown={(event) => {
              if (matches.length) {
                if (event.key === KEYS.ENTER) {
                  goToNextItem();
                }

                if (event.key === KEYS.ARROW_UP) {
                  goToPreviousItem();
                } else if (event.key === KEYS.ARROW_DOWN) {
                  goToNextItem();
                }
              }
            }}
          />
        </div>
        <Button
          onSelect={() => {
            setKeyword("");
          }}
          className="clear-btn"
        >
          {CloseIcon}
        </Button>
      </div>

      <div className="layer-ui__search-count">
        {matches.length > 0 && (
          <>
            <div>{matchCount}</div>
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

        {matches.length === 0 && keyword && searchedKeywordRef.current && (
          <div>{t("search.noMatch")}</div>
        )}
      </div>

      <div className="layer-ui__search-result-container">
        <ul>
          {matches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.textElement.id + searchMatch.index}
              trimmedKeyword={keyword.trim()}
              preview={searchMatch.preview}
              highlighted={index === focusIndex}
              onClick={() => {
                setFocusIndex(index);
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

const ListItem = (props: {
  preview: SearchMatch["preview"];
  trimmedKeyword: string;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  const preview = [
    props.preview.moreBefore ? "..." : "",
    props.preview.previewText.slice(0, props.preview.indexInKeyword),
    props.preview.previewText.slice(
      props.preview.indexInKeyword,
      props.preview.indexInKeyword + props.trimmedKeyword.length,
    ),
    props.preview.previewText.slice(
      props.preview.indexInKeyword + props.trimmedKeyword.length,
    ),
    props.preview.moreAfter ? "..." : "",
  ];

  return (
    <li
      className={clsx("layer-ui__result-item", {
        active: props.highlighted,
      })}
      onClick={props.onClick}
      ref={(ref) => {
        if (props.highlighted) {
          ref?.scrollIntoView({
            block: "nearest",
          });
        }
      }}
    >
      <div className="text-icon">{TextIcon}</div>
      <div
        className="preview-text"
        dangerouslySetInnerHTML={{
          __html: preview
            .map((text, index) => (index === 2 ? `<b>${text}</b>` : text))
            .join(""),
        }}
      ></div>
    </li>
  );
};

const getMatchPreview = (text: string, index: number, keyword: string) => {
  const WORDS_BEFORE = 2;
  const WORDS_AFTER = 5;

  const substrBeforeKeyword = text.slice(0, index);
  const wordsBeforeKeyword = substrBeforeKeyword.split(/\s+/);
  // text = "small", keyword = "mall", not complete before
  // text = "small", keyword = "smal", complete before
  const isKeywordCompleteBefore = substrBeforeKeyword.endsWith(" ");
  const startWordIndex =
    wordsBeforeKeyword.length -
    WORDS_BEFORE -
    1 -
    (isKeywordCompleteBefore ? 0 : 1);
  let wordsBeforeAsString =
    wordsBeforeKeyword
      .slice(startWordIndex <= 0 ? 0 : startWordIndex)
      .join(" ") + (isKeywordCompleteBefore ? " " : "");

  const MAX_ALLOWED_CHARS = 20;

  wordsBeforeAsString =
    wordsBeforeAsString.length > MAX_ALLOWED_CHARS
      ? wordsBeforeAsString.slice(-MAX_ALLOWED_CHARS)
      : wordsBeforeAsString;

  const substrAfterKeyword = text.slice(index + keyword.length);
  const wordsAfter = substrAfterKeyword.split(/\s+/);
  // text = "small", keyword = "mall", complete after
  // text = "small", keyword = "smal", not complete after
  const isKeywordCompleteAfter = !substrAfterKeyword.startsWith(" ");
  const numberOfWordsToTake = isKeywordCompleteAfter
    ? WORDS_AFTER + 1
    : WORDS_AFTER;
  const wordsAfterAsString =
    (isKeywordCompleteAfter ? "" : " ") +
    wordsAfter.slice(0, numberOfWordsToTake).join(" ");

  return {
    indexInKeyword: wordsBeforeAsString.length,
    previewText: wordsBeforeAsString + keyword + wordsAfterAsString,
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
  keyword: string,
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
  let remainingKeyword = textElement.originalText.slice(
    index,
    index + keyword.length,
  );
  const matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[] = [];

  for (const lineIndexRange of lineIndexRanges) {
    if (remainingKeyword === "") {
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

      const matchedWord = remainingKeyword.slice(0, matchCapacity);
      remainingKeyword = remainingKeyword.slice(matchCapacity);

      const offset = measureText(
        textToStart,
        getFontString(textElement),
        textElement.lineHeight,
        true,
      );

      if (textElement.textAlign !== "left") {
        const lineLength = measureText(
          lineIndexRange.line,
          getFontString(textElement),
          textElement.lineHeight,
          true,
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
      });

      startIndex += matchCapacity;
    }
  }

  return matchedLines;
};

const sanitizeKeyword = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const handleSearch = debounce(
  (
    keyword: string,
    app: AppClassProperties,
    cb: (matches: SearchMatch[]) => void,
  ) => {
    if (!keyword || keyword === "") {
      cb([]);
      return;
    }

    const scene = app.scene;
    const elements = scene.getNonDeletedElements();
    const textElements = elements.filter((e) =>
      isTextElement(e),
    ) as ExcalidrawTextElement[];

    const matches: SearchMatch[] = [];

    const safeKeyword = sanitizeKeyword(keyword);
    const regex = new RegExp(safeKeyword, "gi");

    for (const textEl of textElements) {
      let match = null;
      const text = textEl.originalText;

      while ((match = regex.exec(text)) !== null) {
        const preview = getMatchPreview(text, match.index, keyword);
        const matchedLines = getMatchedLines(textEl, keyword, match.index);

        if (matchedLines.length > 0) {
          matches.push({
            textElement: textEl,
            keyword,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    cb(matches);
  },
  SEARCH_DEBOUNCE,
);

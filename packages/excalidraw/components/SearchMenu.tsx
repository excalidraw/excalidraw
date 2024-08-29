import { useEffect, useState } from "react";
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
    startIndex: number;
    keywordIndex: number;
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
  const [searchedKeyword, setSearchedKeyword] = useState<string | null>("");
  const [focusIndex, setFocusIndex] = useAtom(
    searchItemInFocusAtom,
    jotaiScope,
  );
  const elementsMap = app.scene.getNonDeletedElementsMap();

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword !== searchedKeyword) {
      setSearchedKeyword(null);
      handleSearch(trimmedKeyword, app, (matches) => {
        setMatches(matches);
        setFocusIndex(null);
        setSearchedKeyword(trimmedKeyword);
        setAppState({
          searchMatches: matches.map((searchMatch) => ({
            id: searchMatch.textElement.id,
            focus: false,
            matchedLines: searchMatch.matchedLines,
          })),
        });
      });
    }
  }, [keyword, searchedKeyword, app, elementsMap, setAppState, setFocusIndex]);

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
      setSearchedKeyword(null);
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

        {matches.length === 0 && keyword && searchedKeyword && (
          <div>{t("search.noMatch")}</div>
        )}
      </div>

      <div className="layer-ui__search-result-container">
        <ul>
          {matches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.textElement.id + searchMatch.index}
              keyword={keyword}
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
  keyword: string;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  const keywordStartIndex =
    props.preview.keywordIndex - props.preview.startIndex;
  const previewWords = props.preview.previewText.split(/\s+/);

  const preview = [
    `${previewWords.slice(0, keywordStartIndex).join(" ")} `,
    `${previewWords.slice(keywordStartIndex, keywordStartIndex + 1)} `,
    previewWords.slice(keywordStartIndex + 1).join(" "),
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
      <div className="preview-text">
        {props.preview.moreBefore ? "..." : ""}
        {preview.map((text, index) => (
          <span key={index}>
            {index === 1 ? (
              <b
                style={{
                  fontWeight: 700,
                }}
              >
                {text}
              </b>
            ) : (
              text
            )}
          </span>
        ))}
        {props.preview.moreAfter ? "..." : ""}
      </div>
    </li>
  );
};

const getMatchPreview = (text: string, index: number) => {
  const words = text.split(/\s+/);

  let currentWordIndex = 0;
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1; // +1 for the space
    if (charCount > index) {
      currentWordIndex = i;
      break;
    }
  }

  const WORDS_BEFORE = 2;
  const WORDS_AFTER = 5;

  const start = Math.max(0, currentWordIndex - WORDS_BEFORE);
  const end = Math.min(words.length, currentWordIndex + WORDS_AFTER + 1); // +1 to include the current word

  const surroundingWords = words.slice(start, end);

  return {
    startIndex: start,
    keywordIndex: currentWordIndex,
    previewText: surroundingWords.join(" "),
    moreBefore: start !== 0,
    moreAfter: end !== words.length,
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
        const preview = getMatchPreview(text, match.index);
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

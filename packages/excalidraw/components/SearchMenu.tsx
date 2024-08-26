import { useEffect, useState } from "react";
import { CloseIcon, TextIcon, collapseDownIcon, upIcon } from "./icons";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { useApp, useExcalidrawSetAppState } from "./App";
import { debounce } from "lodash";
import { AppClassProperties } from "../types";
import { isTextElement } from "../element";
import { ExcalidrawTextElement } from "../element/types";
import { measureText } from "../element/textElement";
import { getFontString } from "../utils";
import { EVENT } from "../constants";
import { KEYS } from "../keys";

import "./SearchMenu.scss";
import clsx from "clsx";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";

export const searchItemInFocusAtom = atom<number | null>(null);

export const SearchMenu = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [keyWord, setKeyWord] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [focusIndex, setFocusIndex] = useAtom(
    searchItemInFocusAtom,
    jotaiScope,
  );
  const elementsMap = app.scene.getNonDeletedElementsMap();

  console.log("focusIndex", focusIndex);

  useEffect(() => {
    handleSearch(keyWord, app, (matches) => {
      setMatches(matches);
      setFocusIndex(null);
      setAppState({
        searchMatches: matches.map((searchMatch) => ({
          id: searchMatch.textElement.id,
          focus: false,
          matchedLines: searchMatch.matchedLines,
        })),
      });
    });
  }, [keyWord, app, elementsMap]);

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
        app.scrollToContent(match.textElement, {
          fitToContent: true,
          animate: true,
          duration: 300,
        });

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
  }, [focusIndex, matches]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (matches.length) {
        if (event.key === KEYS.ARROW_UP) {
          goToPreviousItem();
        } else if (event.key === KEYS.ARROW_DOWN) {
          goToNextItem();
        }
      }
    };

    window.addEventListener(EVENT.KEYDOWN, handler);

    return () => window.removeEventListener(EVENT.KEYDOWN, handler);
  }, [matches]);

  return (
    <div className="layer-ui__search">
      <div className="layer-ui__search-header">
        <div className="search-input">
          <TextField
            value={keyWord}
            placeholder="Find..."
            onChange={(value) => {
              setKeyWord(value);
            }}
            selectOnRender
            onKeyDown={(event) => {
              if (event.key === KEYS.ENTER) {
                if (matches.length) {
                  goToNextItem();
                }
              }
            }}
          />
        </div>
        <Button
          onSelect={() => {
            setKeyWord("");
          }}
          className="clear-btn"
        >
          {CloseIcon}
        </Button>
      </div>

      <div className="layer-ui__search-count">
        {matches.length > 0 && (
          <>
            <div>
              {matches.length === 1 ? "1 result" : `${matches.length} results`}
            </div>
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

        {matches.length === 0 && keyWord && (
          <div>No results in this scene...</div>
        )}
      </div>

      <div className="layer-ui__search-result-container">
        <ul>
          {matches.map((searchMatch, index) => (
            <ListItem
              key={searchMatch.textElement.id + searchMatch.index}
              textElement={searchMatch.textElement}
              previewText={searchMatch.previewText}
              index={searchMatch.index}
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
  previewText: string;
  textElement: ExcalidrawTextElement;
  index: number;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  return (
    <li
      className={clsx("layer-ui__result-item", {
        active: props.highlighted,
      })}
      onClick={props.onClick}
    >
      <div className="text-icon">{TextIcon}</div>
      <div className="preview-text">{props.previewText}</div>
    </li>
  );
};

function normalizeWrappedText(
  wrappedText: string,
  originalText: string,
): string {
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
}

type SearchMatch = {
  textElement: ExcalidrawTextElement;
  keyword: string;
  index: number;
  previewText: string;
  matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[];
};

const getSurroundingWords = (text: string, index: number): string => {
  // Extracting words from the string
  const words = text.split(/\s+/);

  // Find the word corresponding to the given index
  let currentWordIndex = 0;
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1; // +1 for the space
    if (charCount > index) {
      currentWordIndex = i;
      break;
    }
  }

  // Determine the start and end indices of the surrounding words
  const start = Math.max(0, currentWordIndex - 2);
  const end = Math.min(words.length, currentWordIndex + 5 + 1); // +1 to include the current word

  // Extract the substring from the words array
  const surroundingWords = words.slice(start, end);

  // Join the words back into a single string
  return surroundingWords.join(" ");
};

const getKeywordOffsetsInText = (
  textElement: ExcalidrawTextElement,
  keyword: string,
  index: number,
) => {
  const normalizedText = normalizeWrappedText(
    textElement.text,
    textElement.originalText,
  );

  const lines = normalizedText.split("\n");

  const indexRanges = [];
  let currentIndex = 0;
  let lineNumber = 0;

  for (let line of lines) {
    let startIndex = currentIndex;
    let endIndex = startIndex + line.length - 1;

    // Store the line and its character index range
    indexRanges.push({
      line: line,
      startIndex: startIndex,
      endIndex: endIndex,
      lineNumber,
    });

    // Move to the next line's start index
    currentIndex = endIndex + 1;
    lineNumber++;
  }

  // then find out which line the given keyword (index) is
  // use the line and the line height to find out the correct offset

  let startIndex = index;
  let remainingKeyword = keyword;
  const offsets: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[] = [];

  for (const indexRange of indexRanges) {
    if (remainingKeyword === "") {
      break;
    }

    if (
      startIndex >= indexRange.startIndex &&
      startIndex <= indexRange.endIndex
    ) {
      // how many characters can actually fit in this line?
      const matchCapacity = indexRange.endIndex + 1 - startIndex;

      const textToStart = indexRange.line.slice(
        0,
        startIndex - indexRange.startIndex,
      );

      const matchedWord = remainingKeyword.slice(0, matchCapacity);

      remainingKeyword = remainingKeyword.slice(matchCapacity);

      const offset = measureText(
        textToStart,
        getFontString(textElement),
        textElement.lineHeight,
        true,
      );

      // let's look the text alignment
      if (textElement.textAlign !== "left") {
        const lineLength = measureText(
          indexRange.line,
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

      // const offsetX = textToStart === "" && textElement.textAlign ? 0 : offset.width;
      const offsetX = offset.width;
      const offsetY = indexRange.lineNumber * offset.height;

      offsets.push({
        offsetX,
        offsetY,
        width,
        height,
      });

      startIndex += matchCapacity;
    }
  }

  return offsets;
};

// #region handleSearch
const handleSearch = debounce(
  (
    keyword: string,
    app: AppClassProperties,
    // string: preview
    // number: index
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

    const regex = new RegExp(keyword, "gi");

    for (const textEl of textElements) {
      let match = null;
      const text = textEl.originalText;

      while ((match = regex.exec(text)) !== null) {
        const previewText = getSurroundingWords(text, match.index);

        const matchedLines = getKeywordOffsetsInText(
          textEl,
          keyword,
          match.index,
        );

        if (matchedLines.length > 0) {
          matches.push({
            textElement: textEl,
            keyword,
            previewText,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    cb(matches);
  },
  0,
);

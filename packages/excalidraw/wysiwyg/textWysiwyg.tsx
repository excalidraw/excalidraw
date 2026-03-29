import {
  CODES,
  KEYS,
  CLASSES,
  POINTER_BUTTON,
  isWritableElement,
  getFontString,
  getFontFamilyString,
  randomId,
  isTestEnv,
  isSafari,
  MIME_TYPES,
} from "@excalidraw/common";

import {
  getTextFromElements,
  originalContainerCache,
  updateBoundElements,
  updateOriginalContainerCache,
  charWidth,
  forEachWrappedLine,
} from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";
import { bumpVersion } from "@excalidraw/element";
import {
  getBoundTextElementId,
  getContainerElement,
  getTextElementAngle,
  redrawTextBoundingBox,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  computeContainerDimensionForBoundText,
  computeBoundTextPosition,
  getBoundTextElement,
} from "@excalidraw/element";
import { getTextWidth } from "@excalidraw/element";
import { normalizeText } from "@excalidraw/element";
import { wrapText } from "@excalidraw/element";
import {
  isArrowElement,
  isBoundToContainer,
  isTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextElement,
  FontString,
} from "@excalidraw/element/types";

import { actionSaveToActiveFile } from "../actions";

import {
  parseClipboard,
  parseDataTransferEvent,
  parseDataTransferEventMimeTypes,
  copyTextToSystemClipboard,
} from "../clipboard";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
  actionToggleTextSelectionUnderline,
} from "../actions/actionProperties";
import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
} from "../actions/actionCanvas";
import { extractSyncLineTagFromLine } from "../summaryTool/summaryTool";

import type { ParsedDataTranferList } from "../clipboard";

import type App from "../components/App";
import type { AppState } from "../types";

const getTransform = (
  width: number,
  height: number,
  angle: number,
  appState: AppState,
  maxWidth: number,
  maxHeight: number,
) => {
  const { zoom } = appState;
  const degree = (180 * angle) / Math.PI;
  let translateX = (width * (zoom.value - 1)) / 2;
  let translateY = (height * (zoom.value - 1)) / 2;
  if (width > maxWidth && zoom.value !== 1) {
    translateX = (maxWidth * (zoom.value - 1)) / 2;
  }
  if (height > maxHeight && zoom.value !== 1) {
    translateY = (maxHeight * (zoom.value - 1)) / 2;
  }
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
};

type SubmitHandler = () => void;

const getDblClickSelectWordIntervalMs = () => {
  const stored = Number(
    localStorage.getItem("excalidraw.dblClickSelectWordIntervalMs"),
  );
  const raw = Number.isFinite(stored) ? stored : 200;
  return Math.max(1, Math.min(2000, Math.floor(raw)));
};

const getTripleClickSelectLineIntervalMs = () => {
  const stored = Number(
    localStorage.getItem("excalidraw.tripleClickSelectLineIntervalMs"),
  );
  const raw = Number.isFinite(stored) ? stored : 150;
  return Math.max(1, Math.min(2000, Math.floor(raw)));
};

const getTripleClickTotalIntervalMs = () =>
  getDblClickSelectWordIntervalMs() + getTripleClickSelectLineIntervalMs();

const WORD_COUNTDOWN_EVENT = "excalidraw:selectWordCountdown";
const LINE_COUNTDOWN_EVENT = "excalidraw:selectLineCountdown";

const emitCountdown = (
  eventName: string,
  detail: {
    kind: "word" | "line";
    remainingMs: number;
    durationMs: number;
    active: boolean;
  },
) => {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

export const textWysiwyg = ({
  id,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
  excalidrawContainer,
  app,
  autoSelect = true,
  initialPointerDownSceneCoords,
  initialPointerDownClientCoords,
}: {
  id: ExcalidrawElement["id"];
  /**
   * textWysiwyg only deals with `originalText`
   *
   * Note: `text`, which can be wrapped and therefore different from `originalText`,
   *       is derived from `originalText`
   */
  onChange?: (nextOriginalText: string) => void;
  onSubmit: (data: { viaKeyboard: boolean; nextOriginalText: string }) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  excalidrawContainer: HTMLDivElement | null;
  app: App;
  autoSelect?: boolean;
  initialPointerDownSceneCoords?: { x: number; y: number };
  initialPointerDownClientCoords?: { x: number; y: number };
}): SubmitHandler => {
  // 需求说明.txt#L30-33: 空格/换行符可视化（类似 VSCode "Render Whitespace: all"）
  //
  // 目标：
  // - 用半透明 #a8a8a8 的点来表示空格
  // - 用半透明 #a8a8a8 的点来表示换行符
  //
  // 设计选择（更稳、更少副作用）：
  // - 不修改 textarea 的真实 value（避免影响复制/粘贴/光标/选择等行为）
  // - 在 textarea 下方加一层“只绘制空白符点”的 overlay
  //   - overlay 文字颜色为 transparent（保留排版宽度与换行）
  //   - 空格/换行符用特殊 span（CSS 伪元素画点）来可视化
  //
  // 旧思路（不采用，但保留说明）：将空格替换成 "·" 或插入特殊字符
  // 会改变文本宽度/字体渲染差异，导致排版与 textarea 不一致，从而出现错位。

  const textPropertiesUpdated = (
    updatedTextElement: ExcalidrawTextElement,
    editable: HTMLTextAreaElement,
  ) => {
    if (!editable.style.fontFamily || !editable.style.fontSize) {
      return false;
    }
    const currentFont = editable.style.fontFamily.replace(/"/g, "");
    if (
      getFontFamilyString({ fontFamily: updatedTextElement.fontFamily }) !==
      currentFont
    ) {
      return true;
    }
    if (`${updatedTextElement.fontSize}px` !== editable.style.fontSize) {
      return true;
    }
    return false;
  };

  const isSelectionInsideValidSynclist = (
    value: string,
    selectionMin: number,
  ) => {
    const normalizedValue = value.replace(/\r\n?/g, "\n");
    const lines = normalizedValue.split("\n");
    const lineIndex =
      normalizedValue.slice(0, selectionMin).split("\n").length - 1;
    const isStart = (line: string) =>
      /^\s*\/\/synclist\(([^)]+)\)\s*\{\s*$/.test(line);
    const isEnd = (line: string) => /^\s*\/\/\}\s*$/.test(line);
    let startIndex = -1;
    for (let i = lineIndex; i >= 0; i--) {
      if (isStart(lines[i] ?? "")) {
        startIndex = i;
        break;
      }
      if (isEnd(lines[i] ?? "")) {
        break;
      }
    }
    if (startIndex < 0) {
      return false;
    }
    let endIndex = -1;
    for (let i = lineIndex; i < lines.length; i++) {
      if (isEnd(lines[i] ?? "")) {
        endIndex = i;
        break;
      }
      if (i > lineIndex && isStart(lines[i] ?? "")) {
        break;
      }
    }
    if (endIndex < 0) {
      return false;
    }
    return lineIndex > startIndex && lineIndex < endIndex;
  };

  const whitespaceOverlay = document.createElement("div");
  whitespaceOverlay.classList.add("excalidraw-wysiwyg__whitespaceOverlay");

  const whitespaceOverlayContent = document.createElement("div");
  Object.assign(whitespaceOverlayContent.style, {
    display: "inline-block",
    whiteSpace: "inherit",
  });
  whitespaceOverlay.appendChild(whitespaceOverlayContent);

  const caret = document.createElement("div");
  caret.classList.add("excalidraw-wysiwyg__caret");
  Object.assign(caret.style, {
    position: "absolute",
    display: "none",
    left: "0px",
    top: "0px",
    width: "2px",
    height: "1em",
    background: "currentcolor",
    pointerEvents: "none",
  });
  whitespaceOverlay.appendChild(caret);

  const highlightOverlay = document.createElement("div");
  highlightOverlay.classList.add("excalidraw-wysiwyg__highlightOverlay");
  Object.assign(highlightOverlay.style, {
    position: "absolute",
    display: "inline-block",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    zIndex: "calc(var(--zIndex-wysiwyg) - 2)",
    wordBreak: "normal",
    whiteSpace: "pre",
    overflowWrap: "break-word",
    boxSizing: "content-box",
    pointerEvents: "none",
    color: "transparent",
  });

  let lastWhitespaceOverlayValue = "";
  let whitespaceOverlayLineNodes: Text[] = [];
  let whitespaceOverlayLineStarts: number[] = [];
  const whitespaceOverlayNodeToLineIndex = new WeakMap<Text, number>();
  let lastBeforeInputState: {
    value: string;
    selectionStart: number;
    selectionEnd: number;
  } | null = null;
  let pendingInputRaf: number | null = null;
  let suppressHighlightOnInput = false;
  //文本框增量换行,逐行渲染2026.3.28
  const highlightTextThreshold = 20000;
  let highlightUpdateRaf: number | null = null;

  //文本框增量换行,逐行渲染2026.3.28
  const buildOverlayLines = (value: string) => {
    const rawLines = value.split("\n");
    const lines =
      rawLines.length === 0
        ? [""]
        : rawLines.map((line, idx) =>
            idx < rawLines.length - 1 ? `${line}\n` : line,
          );
    return lines.length === 0 ? [""] : lines;
  };

  //文本框增量换行,逐行渲染2026.3.28
  const rebuildWhitespaceOverlay = (value: string) => {
    whitespaceOverlayContent.textContent = "";
    whitespaceOverlayLineNodes = [];
    whitespaceOverlayLineStarts = [];
    const lines = buildOverlayLines(value);
    let cursor = 0;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? "";
      const node = document.createTextNode(lineText);
      fragment.appendChild(node);
      whitespaceOverlayLineNodes.push(node);
      whitespaceOverlayLineStarts.push(cursor);
      whitespaceOverlayNodeToLineIndex.set(node, i);
      cursor += lineText.length;
    }
    whitespaceOverlayContent.appendChild(fragment);
    lastWhitespaceOverlayValue = value;
  };

  //文本框增量换行,逐行渲染2026.3.28
  const getOverlayLineIndexAt = (index: number) => {
    if (whitespaceOverlayLineStarts.length === 0) {
      return 0;
    }
    const clamped = Math.max(
      0,
      Math.min(lastWhitespaceOverlayValue.length, index),
    );
    let lo = 0;
    let hi = whitespaceOverlayLineStarts.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const start = whitespaceOverlayLineStarts[mid] ?? 0;
      const nextStart =
        whitespaceOverlayLineStarts[mid + 1] ??
        lastWhitespaceOverlayValue.length + 1;
      if (clamped < start) {
        hi = mid - 1;
      } else if (clamped >= nextStart) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }
    return Math.max(0, Math.min(whitespaceOverlayLineStarts.length - 1, lo));
  };

  //文本框增量换行,逐行渲染2026.3.28
  const getOverlayNodeAtIndex = (index: number) => {
    const clamped = Math.max(
      0,
      Math.min(lastWhitespaceOverlayValue.length, index),
    );
    const lineIndex = getOverlayLineIndexAt(clamped);
    const lineStart = whitespaceOverlayLineStarts[lineIndex] ?? 0;
    const node = whitespaceOverlayLineNodes[lineIndex];
    const maxOffset = node?.data.length ?? 0;
    const offset = Math.max(0, Math.min(maxOffset, clamped - lineStart));
    return { node, offset, lineIndex, lineStart };
  };

  //文本框增量换行,逐行渲染2026.3.28
  const getOverlayIndexFromNodeOffset = (
    node: Node | null,
    offset: number | null | undefined,
  ) => {
    if (!node || !Number.isFinite(offset)) {
      return null;
    }
    if (node.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    const lineIndex = whitespaceOverlayNodeToLineIndex.get(node as Text);
    if (lineIndex == null) {
      return null;
    }
    const lineStart = whitespaceOverlayLineStarts[lineIndex] ?? 0;
    const lineLength = whitespaceOverlayLineNodes[lineIndex]?.data.length ?? 0;
    const clampedOffset = Math.max(0, Math.min(lineLength, Number(offset)));
    return Math.max(
      0,
      Math.min(lastWhitespaceOverlayValue.length, lineStart + clampedOffset),
    );
  };

  const updateWhitespaceOverlayContent = () => {
    const nextValue = editable.value;
    if (lastWhitespaceOverlayValue === nextValue) {
      return;
    }

    const prevValue = lastWhitespaceOverlayValue;
    if (whitespaceOverlayLineNodes.length === 0) {
      rebuildWhitespaceOverlay(nextValue);
      return;
    }
    const prevLen = prevValue.length;
    const nextLen = nextValue.length;

    let prefixLen = 0;
    let suffixLen = 0;
    if (lastBeforeInputState && lastBeforeInputState.value === prevValue) {
      const selStart = Math.max(
        0,
        Math.min(prevLen, lastBeforeInputState.selectionStart),
      );
      const selEnd = Math.max(
        selStart,
        Math.min(prevLen, lastBeforeInputState.selectionEnd),
      );
      const removedLen = selEnd - selStart;
      const insertedLen = nextLen - (prevLen - removedLen);
      if (insertedLen >= 0) {
        prefixLen = selStart;
        suffixLen = Math.max(0, prevLen - prefixLen - removedLen);
        const expectedNextLen = prevLen - removedLen + insertedLen;
        if (expectedNextLen !== nextLen) {
          prefixLen = 0;
          suffixLen = 0;
        }
      }
    }
    if (prefixLen === 0 && suffixLen === 0) {
      while (
        prefixLen < prevLen &&
        prefixLen < nextLen &&
        prevValue[prefixLen] === nextValue[prefixLen]
      ) {
        prefixLen += 1;
      }

      while (
        suffixLen < prevLen - prefixLen &&
        suffixLen < nextLen - prefixLen &&
        prevValue[prevLen - 1 - suffixLen] === nextValue[nextLen - 1 - suffixLen]
      ) {
        suffixLen += 1;
      }
    }
    lastBeforeInputState = null;

    const prevChangeEnd = prevLen - suffixLen;
    const nextChangeEnd = nextLen - suffixLen;
    const startLineIndex = getOverlayLineIndexAt(prefixLen);
    const endLineIndex = getOverlayLineIndexAt(
      Math.max(prefixLen, prevChangeEnd - 1),
    );
    const nextLineStartIndex =
      nextValue.lastIndexOf("\n", Math.max(0, prefixLen - 1)) + 1;
    const nextLineEndIndex = (() => {
      const searchStart = Math.max(0, nextChangeEnd - 1);
      const idx = nextValue.indexOf("\n", searchStart);
      return idx === -1 ? nextLen : idx + 1;
    })();
    const slice = nextValue.slice(nextLineStartIndex, nextLineEndIndex);
    const newLines = buildOverlayLines(slice);
    const newNodes = newLines.map((lineText) =>
      document.createTextNode(lineText),
    );

    const removeCount = Math.max(0, endLineIndex - startLineIndex + 1);
    const afterNode = whitespaceOverlayLineNodes[endLineIndex + 1] ?? null;
    for (let i = 0; i < removeCount; i++) {
      whitespaceOverlayLineNodes[startLineIndex + i]?.remove();
    }
    const fragment = document.createDocumentFragment();
    for (const node of newNodes) {
      fragment.appendChild(node);
    }
    if (afterNode) {
      whitespaceOverlayContent.insertBefore(fragment, afterNode);
    } else {
      whitespaceOverlayContent.appendChild(fragment);
    }

    const prevLineStartIndex = whitespaceOverlayLineStarts[startLineIndex] ?? 0;
    const prevLineEndIndex =
      whitespaceOverlayLineStarts[endLineIndex + 1] ?? prevLen;
    const prevSegmentLength = prevLineEndIndex - prevLineStartIndex;
    const nextSegmentLength = nextLineEndIndex - nextLineStartIndex;
    const shift = nextSegmentLength - prevSegmentLength;
    const newLineStarts: number[] = [];
    let cursor = nextLineStartIndex;
    for (const lineText of newLines) {
      newLineStarts.push(cursor);
      cursor += lineText.length;
    }
    whitespaceOverlayLineNodes.splice(startLineIndex, removeCount, ...newNodes);
    whitespaceOverlayLineStarts = [
      ...whitespaceOverlayLineStarts.slice(0, startLineIndex),
      ...newLineStarts,
      ...whitespaceOverlayLineStarts
        .slice(endLineIndex + 1)
        .map((start) => start + shift),
    ];
    for (let i = startLineIndex; i < whitespaceOverlayLineNodes.length; i++) {
      const node = whitespaceOverlayLineNodes[i];
      if (node) {
        whitespaceOverlayNodeToLineIndex.set(node, i);
      }
    }
    lastWhitespaceOverlayValue = nextValue;
  };

  const updateHighlightOverlay = () => {
    if (!app.state.highlightWord) {
      highlightOverlay.innerHTML = "";
      return;
    }

    const value = editable.value;
    if (value.length > highlightTextThreshold) {
      highlightOverlay.innerHTML = "";
      return;
    }
    const selectionStart = editable.selectionStart;
    const selectionEnd = editable.selectionEnd;

    let word = "";
    if (selectionStart === selectionEnd) {
      // Cursor is at a position, find the word
      let start = selectionStart;
      let end = selectionEnd;

      // Find start of word - support both English and Chinese
      while (
        start > 0 &&
        (/\w/.test(value[start - 1]) ||
          /[\u4e00-\u9fa5]/.test(value[start - 1]))
      ) {
        start--;
      }

      // Find end of word - support both English and Chinese
      while (
        end < value.length &&
        (/\w/.test(value[end]) || /[\u4e00-\u9fa5]/.test(value[end]))
      ) {
        end++;
      }

      word = value.slice(start, end);
    } else if (selectionStart < selectionEnd) {
      // Text is selected, use the selected text as the word
      word = value.slice(selectionStart, selectionEnd);
    }

    if (!word || word.length === 0) {
      highlightOverlay.innerHTML = "";
      return;
    }

    // Create highlighted content
    let highlightedContent = "";
    let lastIndex = 0;

    // Escape regex special characters
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Create regex that works for both English and Chinese
    // For Chinese, we don't use word boundaries since they don't work well
    let regex;
    if (/[\u4e00-\u9fa5]/.test(word)) {
      // If word contains Chinese characters, use simple match
      regex = new RegExp(escapedWord, "gi");
    } else {
      // If word is only English, use word boundaries
      regex = new RegExp(`\\b${escapedWord}\\b`, "gi");
    }

    let match;

    while ((match = regex.exec(value)) !== null) {
      highlightedContent += value.slice(lastIndex, match.index);
      highlightedContent += `<span style="background-color: rgba(168, 168, 168, 0.3);">${match[0]}</span>`;
      lastIndex = match.index + match[0].length;
    }

    highlightedContent += value.slice(lastIndex);
    highlightOverlay.innerHTML = highlightedContent;
  };

  let LAST_THEME = app.state.theme;

  let caretUpdateRaf: number | null = null;
  let keepCaretVisibleWhilePointerDown = false;
  let lastSummaryLineNumber: number | null = null;
  let lastSummarySelectionKey = "";
  //文本框增量换行,逐行渲染2026.3.28
  let caretMeasurementCache: {
    normalizedValue: string;
    font: FontString;
    editorWidth: number;
    shouldWrap: boolean;
    caretIndex: number;
    lineInfo: {
      lineText: string;
      lineIndex: number;
      lineStartIndex: number;
    };
    cumulativeWidths: number[];
  } | null = null;
  const scheduleCaretUpdate = () => {
    if (caretUpdateRaf != null) {
      cancelAnimationFrame(caretUpdateRaf);
    }
    caretUpdateRaf = requestAnimationFrame(() => {
      caretUpdateRaf = null;
      updateCaret();
    });
  };

  //文本框增量换行,逐行渲染2026.3.28
  const getWrappedLineByVisualIndex = (
    normalizedValue: string,
    font: FontString,
    editorWidth: number,
    shouldWrap: boolean,
    targetLineIndex: number,
  ) => {
    let found: {
      lineText: string;
      lineIndex: number;
      lineStartIndex: number;
    } | null = null;
    let last: {
      lineText: string;
      lineIndex: number;
      lineStartIndex: number;
    } | null = null;
    forEachWrappedLine(
      normalizedValue,
      font,
      editorWidth,
      shouldWrap,
      ({ lineText, lineIndex, lineStartIndex }) => {
        const info = { lineText, lineIndex, lineStartIndex };
        last = info;
        if (lineIndex === targetLineIndex) {
          found = info;
          return true;
        }
        return false;
      },
    );
    return found ?? last ?? { lineText: "", lineIndex: 0, lineStartIndex: 0 };
  };

  //文本框增量换行,逐行渲染2026.3.28
  const getWrappedLineByCaretIndex = (
    normalizedValue: string,
    font: FontString,
    editorWidth: number,
    shouldWrap: boolean,
    caretIndex: number,
  ) => {
    let found: {
      lineText: string;
      lineIndex: number;
      lineStartIndex: number;
    } | null = null;
    let last: {
      lineText: string;
      lineIndex: number;
      lineStartIndex: number;
    } | null = null;
    forEachWrappedLine(
      normalizedValue,
      font,
      editorWidth,
      shouldWrap,
      ({ lineText, lineIndex, lineStartIndex }) => {
        const info = { lineText, lineIndex, lineStartIndex };
        last = info;
        const lineEndIndex = lineStartIndex + lineText.length;
        if (caretIndex <= lineEndIndex) {
          found = info;
          return true;
        }
        return false;
      },
    );
    return found ?? last ?? { lineText: "", lineIndex: 0, lineStartIndex: 0 };
  };

  //文本框增量换行,逐行渲染2026.3.28
  const buildCumulativeCharWidths = (lineText: string, font: FontString) => {
    const widths = new Array(lineText.length + 1);
    widths[0] = 0;
    let codeUnitIndex = 0;
    for (const ch of lineText) {
      const next = (widths[codeUnitIndex] ?? 0) + charWidth.calculate(ch, font);
      const units = ch.length;
      for (let i = 1; i <= units; i++) {
        widths[codeUnitIndex + i] = next;
      }
      codeUnitIndex += units;
      if (codeUnitIndex >= lineText.length) {
        break;
      }
    }
    for (let i = 1; i <= lineText.length; i++) {
      if (widths[i] == null) {
        widths[i] = widths[i - 1] ?? 0;
      }
    }
    return widths as number[];
  };

  const updateSummaryLineLinkSelection = (
    updatedTextElement: ExcalidrawTextElement,
    lineNumber: number,
  ) => {
    const summaryTool = (updatedTextElement.customData as any)?.summaryTool;
    if (summaryTool?.role !== "summaryRoot") {
      if (lastSummarySelectionKey) {
        lastSummarySelectionKey = "";
        lastSummaryLineNumber = null;
        if (Object.keys(app.state.selectedTextLineLinkIds).length) {
          app.setState({ selectedTextLineLinkIds: {} });
        }
      }
      return;
    }

    if (lastSummaryLineNumber === lineNumber && lastSummarySelectionKey) {
      return;
    }

    const rawLines = editable.value.replace(/\r\n?/g, "\n").split("\n");
    const rawLine = rawLines[lineNumber - 1] ?? "";
    const extracted = extractSyncLineTagFromLine(rawLine);
    const tag = extracted.tag;
    if (!tag) {
      if (lastSummarySelectionKey) {
        lastSummarySelectionKey = "";
        lastSummaryLineNumber = null;
        if (Object.keys(app.state.selectedTextLineLinkIds).length) {
          app.setState({ selectedTextLineLinkIds: {} });
        }
      }
      return;
    }

    const prefix = `summaryTool:${tag.listName}:${tag.lineId}:`;
    const linkIds = app.state.textLineLinks
      .filter((link) => String(link.id).startsWith(prefix))
      .map((link) => String(link.id));

    if (!linkIds.length) {
      if (lastSummarySelectionKey) {
        lastSummarySelectionKey = "";
        lastSummaryLineNumber = null;
        if (Object.keys(app.state.selectedTextLineLinkIds).length) {
          app.setState({ selectedTextLineLinkIds: {} });
        }
      }
      return;
    }

    const nextKey = linkIds.join("|");
    if (nextKey === lastSummarySelectionKey) {
      lastSummaryLineNumber = lineNumber;
      return;
    }

    const selectedTextLineLinkIds = Object.fromEntries(
      linkIds.map((id) => [id, true as const]),
    ) as Record<string, true>;
    lastSummarySelectionKey = nextKey;
    lastSummaryLineNumber = lineNumber;
    app.setState({ selectedTextLineLinkIds });
  };

  const updateCaret = () => {
    if (document.activeElement !== editable) {
      if (keepCaretVisibleWhilePointerDown) {
        return;
      }
      caret.style.display = "none";
      return;
    }

    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);
    if (!updatedTextElement || !isTextElement(updatedTextElement)) {
      caret.style.display = "none";
      return;
    }

    const summaryTool = (updatedTextElement.customData as any)?.summaryTool;
    if (summaryTool?.role === "summaryRoot") {
      const selectionStart = editable.selectionStart ?? 0;
      const selectionEnd = editable.selectionEnd ?? selectionStart;
      if (selectionStart === selectionEnd) {
        const value = editable.value.replace(/\r\n?/g, "\n");
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const lineEndIdx = value.indexOf("\n", selectionStart);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const line = value.slice(lineStart, lineEnd);
        const tagIndex = line.indexOf("\u2063\u2063");
        if (tagIndex >= 0) {
          const absoluteTagStart = lineStart + tagIndex;
          if (selectionStart > absoluteTagStart) {
            editable.selectionStart = absoluteTagStart;
            editable.selectionEnd = absoluteTagStart;
          }
        }
      }
    }

    const lineHeightPx =
      updatedTextElement.fontSize * updatedTextElement.lineHeight;
    if (lineHeightPx <= 0) {
      caret.style.display = "none";
      return;
    }

    const editorWidth =
      parseFloat(editable.style.width) || updatedTextElement.width;
    const overlayValue = lastWhitespaceOverlayValue;
    const caretIndex = Math.max(
      0,
      Math.min(overlayValue.length, editable.selectionEnd ?? 0),
    );
    const caretLineNumber = editable.value
      .slice(0, caretIndex)
      .split("\n").length;
    updateSummaryLineLinkSelection(updatedTextElement, caretLineNumber);

    const overlayStyle = window.getComputedStyle(whitespaceOverlay);
    const transformStr = overlayStyle.transform;
    const DOMMatrixReadOnlyCtor: any = (window as any).DOMMatrixReadOnly;
    const matrix: any = DOMMatrixReadOnlyCtor
      ? transformStr && transformStr !== "none"
        ? new DOMMatrixReadOnlyCtor(transformStr)
        : new DOMMatrixReadOnlyCtor()
      : null;
    const hasRotationOrSkew = matrix
      ? Math.abs(matrix.b) > 1e-6 || Math.abs(matrix.c) > 1e-6
      : false;

    const shouldUseMeasuredCaret =
      hasRotationOrSkew || overlayValue.length > 8000;
    if (shouldUseMeasuredCaret) {
      const normalizedValue = editable.value.replace(/\r\n?/g, "\n");
      const font = getFontString(updatedTextElement);
      const shouldWrap =
        whitespaceOverlay.style.whiteSpace === "pre-wrap" ||
        whitespaceOverlay.style.whiteSpace === "break-spaces";
      const normalizedCaretIndex = Math.max(
        0,
        Math.min(normalizedValue.length, editable.selectionEnd ?? 0),
      );
      let lineInfo: {
        lineText: string;
        lineIndex: number;
        lineStartIndex: number;
      };
      let cumulativeWidths: number[];
      if (
        caretMeasurementCache &&
        caretMeasurementCache.normalizedValue === normalizedValue &&
        caretMeasurementCache.font === font &&
        caretMeasurementCache.editorWidth === editorWidth &&
        caretMeasurementCache.shouldWrap === shouldWrap &&
        caretMeasurementCache.caretIndex === normalizedCaretIndex
      ) {
        lineInfo = caretMeasurementCache.lineInfo;
        cumulativeWidths = caretMeasurementCache.cumulativeWidths;
      } else {
        lineInfo = getWrappedLineByCaretIndex(
          normalizedValue,
          font,
          editorWidth,
          shouldWrap,
          normalizedCaretIndex,
        );
        cumulativeWidths = buildCumulativeCharWidths(lineInfo.lineText, font);
        caretMeasurementCache = {
          normalizedValue,
          font,
          editorWidth,
          shouldWrap,
          caretIndex: normalizedCaretIndex,
          lineInfo,
          cumulativeWidths,
        };
      }
      const lineText = lineInfo.lineText;
      const lineStartIndex = lineInfo.lineStartIndex;
      const lineIndex = lineInfo.lineIndex;
      const col = Math.max(
        0,
        Math.min(lineText.length, normalizedCaretIndex - lineStartIndex),
      );

      const lineWidth = cumulativeWidths[lineText.length] ?? 0;

      let lineOffsetX = 0;
      if (updatedTextElement.textAlign === "center") {
        lineOffsetX = (editorWidth - lineWidth) / 2;
      } else if (updatedTextElement.textAlign === "right") {
        lineOffsetX = editorWidth - lineWidth;
      }
      lineOffsetX = Math.max(0, lineOffsetX);

      const prefixWidth = cumulativeWidths[col] ?? 0;

      caret.style.display = "block";
      caret.style.left = `${lineOffsetX + prefixWidth}px`;
      caret.style.top = `${lineIndex * lineHeightPx}px`;
      caret.style.height = `${lineHeightPx}px`;
      return;
    }

    const parsePx = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    const originParts = overlayStyle.transformOrigin.split(" ");
    const originX = parsePx(originParts[0] ?? "0");
    const originY = parsePx(originParts[1] ?? "0");
    const invMatrix = matrix ? matrix.inverse() : null;

    const offsetParent =
      (whitespaceOverlay.offsetParent as HTMLElement | null) ??
      whitespaceOverlay.parentElement;
    const parentRect = offsetParent?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
    };
    const baseLeft = parentRect.left + parsePx(whitespaceOverlay.style.left);
    const baseTop = parentRect.top + parsePx(whitespaceOverlay.style.top);

    const viewportToLocal = (clientX: number, clientY: number) => {
      if (!invMatrix || typeof DOMPoint === "undefined") {
        return { x: clientX - baseLeft, y: clientY - baseTop };
      }
      const relX = clientX - baseLeft - originX;
      const relY = clientY - baseTop - originY;
      const p = new DOMPoint(relX, relY).matrixTransform(invMatrix);
      return { x: p.x + originX, y: p.y + originY };
    };

    const range = document.createRange();
    const getCharRect = (idx: number): DOMRect | null => {
      if (idx < 0 || idx >= overlayValue.length) {
        return null;
      }
      const { node, offset } = getOverlayNodeAtIndex(idx);
      if (!node) {
        return null;
      }
      const nextOffset = Math.min(node.data.length, offset + 1);
      range.setStart(node, offset);
      range.setEnd(node, nextOffset);
      const rects =
        "getClientRects" in range && typeof range.getClientRects === "function"
          ? range.getClientRects()
          : [];
      if (rects.length > 0) {
        return rects[0]!;
      }
      const r =
        "getBoundingClientRect" in range &&
        typeof (range as any).getBoundingClientRect === "function"
          ? (range as any).getBoundingClientRect()
          : null;
      if (r && (r.width > 0 || r.height > 0)) {
        return r as DOMRect;
      }
      return null;
    };

    const getAlignedX = () => {
      if (updatedTextElement.textAlign === "center") {
        return editorWidth / 2;
      }
      if (updatedTextElement.textAlign === "right") {
        return editorWidth;
      }
      return 0;
    };

    let caretLocalX = 0;
    let caretLocalY = 0;

    if (overlayValue.length === 0) {
      caretLocalX = getAlignedX();
      caretLocalY = 0;
    } else if (caretIndex > 0 && overlayValue[caretIndex - 1] === "\n") {
      const nextRect = getCharRect(caretIndex);
      if (nextRect) {
        const p = viewportToLocal(nextRect.left, nextRect.top);
        caretLocalX = p.x;
        caretLocalY = p.y;
      } else {
        let nlCount = 0;
        let prevIdx = caretIndex - 1;
        while (prevIdx >= 0 && overlayValue[prevIdx] === "\n") {
          nlCount += 1;
          prevIdx -= 1;
        }
        const prevRect = getCharRect(prevIdx);
        caretLocalX = getAlignedX();
        if (prevRect) {
          const scaledLineAdvance = lineHeightPx * matrix.d * nlCount;
          const p = viewportToLocal(
            prevRect.left,
            prevRect.top + scaledLineAdvance,
          );
          caretLocalY = p.y;
        } else {
          caretLocalY = lineHeightPx * nlCount;
        }
      }
    } else if (
      caretIndex >= overlayValue.length ||
      overlayValue[caretIndex] === "\n"
    ) {
      const prevIdx = Math.min(overlayValue.length - 1, caretIndex - 1);
      const prevRect = getCharRect(prevIdx);
      if (prevRect) {
        const p = viewportToLocal(prevRect.right, prevRect.top);
        caretLocalX = p.x;
        caretLocalY = p.y;
      } else {
        caretLocalX = getAlignedX();
        caretLocalY = 0;
      }
    } else {
      const rect = getCharRect(caretIndex);
      if (rect) {
        const p = viewportToLocal(rect.left, rect.top);
        caretLocalX = p.x;
        caretLocalY = p.y;
      } else {
        caretLocalX = getAlignedX();
        caretLocalY = 0;
      }
    }

    caret.style.display = "block";
    caret.style.left = `${caretLocalX}px`;
    caret.style.top = `${caretLocalY}px`;
    caret.style.height = `${lineHeightPx}px`;
  };

  const updateWysiwygStyle = () => {
    LAST_THEME = app.state.theme;

    const appState = app.state;
    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);

    if (!updatedTextElement) {
      return;
    }
    const { textAlign, verticalAlign } = updatedTextElement;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    if (updatedTextElement && isTextElement(updatedTextElement)) {
      let coordX = updatedTextElement.x;
      let coordY = updatedTextElement.y;
      const container = getContainerElement(
        updatedTextElement,
        app.scene.getNonDeletedElementsMap(),
      );

      const width = updatedTextElement.width;

      // set to element height by default since that's
      // what is going to be used for unbounded text
      const height = updatedTextElement.height;

      let maxWidth = updatedTextElement.width;
      let maxHeight = updatedTextElement.height;

      if (container && updatedTextElement.containerId) {
        if (isArrowElement(container)) {
          const boundTextCoords =
            LinearElementEditor.getBoundTextElementPosition(
              container,
              updatedTextElement as ExcalidrawTextElementWithContainer,
              elementsMap,
            );
          coordX = boundTextCoords.x;
          coordY = boundTextCoords.y;
        }
        const propertiesUpdated = textPropertiesUpdated(
          updatedTextElement,
          editable,
        );

        let originalContainerData;
        if (propertiesUpdated) {
          originalContainerData = updateOriginalContainerCache(
            container.id,
            container.height,
          );
        } else {
          originalContainerData = originalContainerCache[container.id];
          if (!originalContainerData) {
            originalContainerData = updateOriginalContainerCache(
              container.id,
              container.height,
            );
          }
        }

        maxWidth = getBoundTextMaxWidth(container, updatedTextElement);
        maxHeight = getBoundTextMaxHeight(
          container,
          updatedTextElement as ExcalidrawTextElementWithContainer,
        );

        // autogrow container height if text exceeds
        if (!isArrowElement(container) && height > maxHeight) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );

          app.scene.mutateElement(container, { height: targetContainerHeight });
          updateBoundElements(container, app.scene);
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          !isArrowElement(container) &&
          container.height > originalContainerData.height &&
          height < maxHeight
        ) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );
          app.scene.mutateElement(container, { height: targetContainerHeight });
          updateBoundElements(container, app.scene);
        } else {
          const { x, y } = computeBoundTextPosition(
            container,
            updatedTextElement as ExcalidrawTextElementWithContainer,
            elementsMap,
          );
          coordX = x;
          coordY = y;
        }
      }
      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);

      const font = getFontString(updatedTextElement);

      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;
      Object.assign(editable.style, {
        font,
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: updatedTextElement.lineHeight,
        width: `${width}px`,
        height: `${height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          width,
          height,
          getTextElementAngle(updatedTextElement, container),
          appState,
          maxWidth,
          editorMaxHeight,
        ),
        textAlign,
        verticalAlign,
        color: "transparent",
        caretColor: "transparent",
        opacity: updatedTextElement.opacity / 100,
        maxHeight: `${editorMaxHeight}px`,
      });
      caret.style.background = appState.textEditorCaretColor;

      // overlay 必须与 textarea 完全同样的几何与排版参数，否则点会错位
      Object.assign(whitespaceOverlay.style, {
        font: editable.style.font,
        lineHeight: editable.style.lineHeight,
        width: editable.style.width,
        height: editable.style.height,
        left: editable.style.left,
        top: editable.style.top,
        transform: editable.style.transform,
        textAlign: editable.style.textAlign,
        verticalAlign: editable.style.verticalAlign,
        opacity: editable.style.opacity,
        maxHeight: editable.style.maxHeight,
      });

      // highlight overlay 也需要与 textarea 保持同样的几何与排版参数
      Object.assign(highlightOverlay.style, {
        font: editable.style.font,
        lineHeight: editable.style.lineHeight,
        width: editable.style.width,
        height: editable.style.height,
        left: editable.style.left,
        top: editable.style.top,
        transform: editable.style.transform,
        textAlign: editable.style.textAlign,
        verticalAlign: editable.style.verticalAlign,
        opacity: editable.style.opacity,
        maxHeight: editable.style.maxHeight,
      });
      editable.scrollTop = 0;
      // For some reason updating font attribute doesn't set font family
      // hence updating font family explicitly for test environment
      if (isTestEnv()) {
        editable.style.fontFamily = getFontFamilyString(updatedTextElement);
        whitespaceOverlay.style.fontFamily = editable.style.fontFamily;
      }

      app.scene.mutateElement(updatedTextElement, { x: coordX, y: coordY });
      scheduleCaretUpdate();
    }
  };

  const editable = document.createElement("textarea");

  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.dataset.type = "wysiwyg";
  editable.classList.add("excalidraw-wysiwyg");

  const supportsBreakSpaces =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("white-space", "break-spaces");

  let whiteSpace = "pre";
  let wordBreak = "normal";

  const shouldWrap = isBoundToContainer(element) || !element.autoResize;

  editable.wrap = shouldWrap && !isSafari ? "soft" : "off";

  if (shouldWrap) {
    whiteSpace = supportsBreakSpaces ? "break-spaces" : "pre-wrap";
    wordBreak = "break-word";
  }
  Object.assign(editable.style, {
    position: "absolute",
    display: "inline-block",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
    wordBreak,
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    overflowWrap: "break-word",
    boxSizing: "content-box",
  });

  // overlay 的基础样式必须与 textarea 保持一致（同样的布局/换行规则），
  // 同时：
  // - 指针事件关闭，避免影响编辑交互
  // - 自身文字透明，仅绘制空白符点
  // - 层级在 textarea 下方（通过 DOM 顺序 + zIndex 微调）
  Object.assign(whitespaceOverlay.style, {
    position: "absolute",
    display: "inline-block",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    // textarea 的 zIndex 为 --zIndex-wysiwyg；overlay 在其下方
    zIndex: "calc(var(--zIndex-wysiwyg) - 1)",
    wordBreak,
    whiteSpace,
    overflowWrap: "break-word",
    boxSizing: "content-box",
    pointerEvents: "none",
    color: "transparent",
  });
  editable.value = element.originalText;
  updateWysiwygStyle();
  updateWhitespaceOverlayContent();
  updateHighlightOverlay();
  scheduleCaretUpdate();

  const handleBeforeInput = () => {
    lastBeforeInputState = {
      value: editable.value,
      selectionStart: editable.selectionStart ?? 0,
      selectionEnd: editable.selectionEnd ?? editable.selectionStart ?? 0,
    };
  };
  const scheduleHighlightUpdate = () => {
    if (highlightUpdateRaf != null) {
      return;
    }
    highlightUpdateRaf = requestAnimationFrame(() => {
      highlightUpdateRaf = null;
      updateHighlightOverlay();
    });
  };
  const handleInputHighlight = () => {
    if (suppressHighlightOnInput) {
      return;
    }
    scheduleHighlightUpdate();
  };

  // 添加事件监听器来触发高亮更新
  editable.addEventListener("input", handleInputHighlight);
  editable.addEventListener("beforeinput", handleBeforeInput);
  editable.addEventListener("selectionchange", scheduleHighlightUpdate);

  // 将highlightOverlay添加到DOM中
  if (excalidrawContainer) {
    excalidrawContainer.appendChild(highlightOverlay);
  }

  const getSelectionIndexFromPointerDown = () => {
    // 二次单击进入编辑时，根据点击位置计算 textarea selectionStart/End：
    // - 将点击点从旋转后的坐标系“反旋转”回元素本地坐标
    // - 用与编辑器一致的软换行（pre-wrap）拆分为行，并保留真实换行符位置
    // - 结合 textAlign 计算每行起始偏移，再用二分查找定位字符索引
    if (!initialPointerDownSceneCoords && !initialPointerDownClientCoords) {
      return null;
    }

    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);
    if (!updatedTextElement || !isTextElement(updatedTextElement)) {
      return null;
    }

    const elementsMap = app.scene.getNonDeletedElementsMap();
    const container = getContainerElement(updatedTextElement, elementsMap);
    const angle = getTextElementAngle(updatedTextElement, container);

    if (angle !== 0) {
      return null;
    }

    const centerX = updatedTextElement.x + updatedTextElement.width / 2;
    const centerY = updatedTextElement.y + updatedTextElement.height / 2;

    const rotateAround = (
      x: number,
      y: number,
      cx: number,
      cy: number,
      angle: number,
    ) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = x - cx;
      const dy = y - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    };

    const unrotatedPointer = initialPointerDownSceneCoords
      ? rotateAround(
          initialPointerDownSceneCoords.x,
          initialPointerDownSceneCoords.y,
          centerX,
          centerY,
          -angle,
        )
      : null;

    const lineHeightPx =
      updatedTextElement.fontSize * updatedTextElement.lineHeight;
    if (lineHeightPx <= 0) {
      return 0;
    }

    if (unrotatedPointer) {
      const localX = unrotatedPointer.x - updatedTextElement.x;
      const localY = unrotatedPointer.y - updatedTextElement.y;

      const editorWidth =
        parseFloat(editable.style.width) || updatedTextElement.width;

      const normalizedValue = editable.value.replace(/\r\n?/g, "\n");
      const font = getFontString(updatedTextElement);
      const shouldWrap =
        whitespaceOverlay.style.whiteSpace === "pre-wrap" ||
        whitespaceOverlay.style.whiteSpace === "break-spaces";
      const targetLineIndex = Math.max(
        0,
        Math.floor((localY + 1e-6) / lineHeightPx),
      );
      const lineInfo = getWrappedLineByVisualIndex(
        normalizedValue,
        font,
        editorWidth,
        shouldWrap,
        targetLineIndex,
      );
      const lineText = lineInfo.lineText;
      const clampedLineIndex = lineInfo.lineIndex;
      const lineStartIndex = lineInfo.lineStartIndex;
      //文本框增量换行,逐行渲染2026.3.28
      const cumulativeWidths = buildCumulativeCharWidths(lineText, font);
      const lineWidth = cumulativeWidths[lineText.length] ?? 0;

      let lineOffsetX = 0;
      if (updatedTextElement.textAlign === "center") {
        lineOffsetX = (editorWidth - lineWidth) / 2;
      } else if (updatedTextElement.textAlign === "right") {
        lineOffsetX = editorWidth - lineWidth;
      }
      lineOffsetX = Math.max(0, lineOffsetX);
      const xWithinLine = localX - lineOffsetX;

      const getPrefixWidth = (length: number) =>
        cumulativeWidths[Math.max(0, Math.min(lineText.length, length))] ?? 0;

      let charIndex = 0;
      if (xWithinLine <= 0) {
        charIndex = 0;
      } else if (xWithinLine >= lineWidth) {
        charIndex = lineText.length;
      } else {
        let lo = 0;
        let hi = lineText.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (getPrefixWidth(mid) < xWithinLine) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }

        const right = Math.max(0, Math.min(lineText.length, lo));
        const left = Math.max(0, right - 1);
        const leftX = getPrefixWidth(left);
        const rightX = getPrefixWidth(right);
        charIndex =
          xWithinLine - leftX <= rightX - xWithinLine
            ? left
            : Math.max(left, right);
      }

      const resolved =
        lineStartIndex + Math.max(0, Math.min(lineText.length, charIndex));

      if (
        (window as any).__e2eOverlay ||
        (window as any).EXCALIDRAW_WYSIWYG_DEBUG
      ) {
        const canvasRect = canvas.getBoundingClientRect();
        (window as any).__e2eWysiwygPointerDebug = {
          method: "scene",
          inputClientX: initialPointerDownClientCoords?.x ?? null,
          inputClientY: initialPointerDownClientCoords?.y ?? null,
          inputSceneX: initialPointerDownSceneCoords?.x ?? null,
          inputSceneY: initialPointerDownSceneCoords?.y ?? null,
          localX,
          localY,
          lineHeightPx,
          editorWidth,
          clampedLineIndex,
          resolvedIndex: resolved,
          offsetLeft: app.state.offsetLeft,
          offsetTop: app.state.offsetTop,
          canvasRectLeft: canvasRect.left,
          canvasRectTop: canvasRect.top,
        };
      }

      return resolved;
    }

    const overlayValue = lastWhitespaceOverlayValue;
    const len = overlayValue.length;
    if (len === 0) {
      return 0;
    }

    const zoom = app.state.zoom.value;
    const pointerClientX = initialPointerDownClientCoords
      ? initialPointerDownClientCoords.x
      : (unrotatedPointer!.x + app.state.scrollX) * zoom + app.state.offsetLeft;
    const pointerClientY = initialPointerDownClientCoords
      ? initialPointerDownClientCoords.y
      : (unrotatedPointer!.y + app.state.scrollY) * zoom + app.state.offsetTop;

    const lineHeightClientPx = lineHeightPx * zoom;
    if (lineHeightClientPx <= 0) {
      return 0;
    }

    const range = document.createRange();
    const getCharRect = (idx: number): DOMRect | null => {
      if (idx < 0 || idx >= len) {
        return null;
      }
      if (overlayValue[idx] === "\n") {
        return null;
      }
      const { node, offset } = getOverlayNodeAtIndex(idx);
      if (!node) {
        return null;
      }
      const nextOffset = Math.min(node.data.length, offset + 1);
      range.setStart(node, offset);
      range.setEnd(node, nextOffset);
      const rects =
        "getClientRects" in range && typeof range.getClientRects === "function"
          ? range.getClientRects()
          : [];
      if (rects.length > 0) {
        return rects[0]!;
      }
      const r =
        "getBoundingClientRect" in range &&
        typeof (range as any).getBoundingClientRect === "function"
          ? (range as any).getBoundingClientRect()
          : null;
      if (r && (r.width > 0 || r.height > 0)) {
        return r as DOMRect;
      }
      return null;
    };

    const firstRenderableCharIndex = (() => {
      for (let i = 0; i < len; i++) {
        if (overlayValue[i] !== "\n") {
          return i;
        }
      }
      return 0;
    })();

    const baseTextTopClientY = (() => {
      const rect = getCharRect(firstRenderableCharIndex);
      if (!rect) {
        return pointerClientY;
      }
      return rect.top;
    })();

    const getLineIndexFromClientY = (y: number) => {
      return Math.max(
        0,
        Math.floor((y - baseTextTopClientY + 1e-6) / lineHeightClientPx),
      );
    };

    const cache = new Map<number, { x: number; y: number; line: number }>();
    const getCaretPosForIndex = (caretIndex: number) => {
      const idx = Math.max(0, Math.min(len, caretIndex));
      const cached = cache.get(idx);
      if (cached) {
        return cached;
      }

      const editableRect = editable.getBoundingClientRect();
      let caretClientX = editableRect.left;
      let caretClientY = editableRect.top;

      if (idx > 0 && overlayValue[idx - 1] === "\n") {
        const nextRect = getCharRect(idx);
        if (nextRect) {
          caretClientX = nextRect.left;
          caretClientY = nextRect.top;
        } else {
          let nlCount = 0;
          let prevIdx = idx - 1;
          while (prevIdx >= 0 && overlayValue[prevIdx] === "\n") {
            nlCount += 1;
            prevIdx -= 1;
          }
          const prevRect = getCharRect(prevIdx);
          if (prevRect) {
            caretClientX = prevRect.left;
            caretClientY = prevRect.top + lineHeightClientPx * nlCount;
          } else {
            caretClientX = editableRect.left;
            caretClientY = baseTextTopClientY + lineHeightClientPx * nlCount;
          }
        }
      } else if (idx >= len || overlayValue[idx] === "\n") {
        let prevIdx = Math.min(len - 1, idx - 1);
        while (prevIdx >= 0 && overlayValue[prevIdx] === "\n") {
          prevIdx -= 1;
        }
        const prevRect = getCharRect(prevIdx);
        if (prevRect) {
          caretClientX = prevRect.right;
          caretClientY = prevRect.top;
        }
      } else {
        const rect = getCharRect(idx);
        if (rect) {
          caretClientX = rect.left;
          caretClientY = rect.top;
        }
      }

      const line = getLineIndexFromClientY(caretClientY);
      const result = { x: caretClientX, y: caretClientY, line };
      cache.set(idx, result);
      return result;
    };

    const nativeSelectionIndex = (() => {
      const doc: any = document as any;
      if (typeof doc.caretPositionFromPoint === "function") {
        const pos = doc.caretPositionFromPoint(pointerClientX, pointerClientY);
        const node = pos?.offsetNode;
        const offset = pos?.offset;
        const resolved = getOverlayIndexFromNodeOffset(node, offset);
        if (resolved != null) {
          return Math.max(0, Math.min(len, resolved));
        }
      }
      if (typeof doc.caretRangeFromPoint === "function") {
        const r = doc.caretRangeFromPoint(pointerClientX, pointerClientY);
        const node = r?.startContainer;
        const offset = r?.startOffset;
        const resolved = getOverlayIndexFromNodeOffset(node, offset);
        if (resolved != null) {
          return Math.max(0, Math.min(len, resolved));
        }
      }
      return null;
    })();

    if (nativeSelectionIndex !== null) {
      if (
        (window as any).__e2eOverlay ||
        (window as any).EXCALIDRAW_WYSIWYG_DEBUG
      ) {
        const canvasRect = canvas.getBoundingClientRect();
        (window as any).__e2eWysiwygPointerDebug = {
          method: "native",
          inputClientX: initialPointerDownClientCoords?.x ?? null,
          inputClientY: initialPointerDownClientCoords?.y ?? null,
          inputSceneX: initialPointerDownSceneCoords?.x ?? null,
          inputSceneY: initialPointerDownSceneCoords?.y ?? null,
          pointerClientX,
          pointerClientY,
          baseTextTopClientY,
          lineHeightClientPx,
          targetLine: getLineIndexFromClientY(pointerClientY),
          resolvedIndex: nativeSelectionIndex,
          offsetLeft: app.state.offsetLeft,
          offsetTop: app.state.offsetTop,
          canvasRectLeft: canvasRect.left,
          canvasRectTop: canvasRect.top,
        };
      }
      return nativeSelectionIndex;
    }

    const targetLine = getLineIndexFromClientY(pointerClientY);

    let lo = 0;
    let hi = len;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const { line } = getCaretPosForIndex(mid);
      if (line < targetLine) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    let idx = lo;
    if (idx > len) {
      idx = len;
    }

    const { line: lineAtIdx } = getCaretPosForIndex(idx);

    let startLo = 0;
    let startHi = idx;
    while (startLo < startHi) {
      const mid = Math.floor((startLo + startHi) / 2);
      const { line } = getCaretPosForIndex(mid);
      if (line < lineAtIdx) {
        startLo = mid + 1;
      } else {
        startHi = mid;
      }
    }
    const lineStart = startLo;

    let endLo = idx;
    let endHi = len;
    while (endLo < endHi) {
      const mid = Math.floor((endLo + endHi) / 2);
      const { line } = getCaretPosForIndex(mid);
      if (line <= lineAtIdx) {
        endLo = mid + 1;
      } else {
        endHi = mid;
      }
    }
    const lineEnd = endLo;

    let xLo = lineStart;
    let xHi = lineEnd;
    while (xLo < xHi) {
      const mid = Math.floor((xLo + xHi) / 2);
      const { x } = getCaretPosForIndex(mid);
      if (x < pointerClientX) {
        xLo = mid + 1;
      } else {
        xHi = mid;
      }
    }

    const right = Math.max(
      lineStart,
      Math.min(Math.max(lineStart, lineEnd - 1), xLo),
    );
    const left = Math.max(lineStart, right - 1);
    const leftPos = getCaretPosForIndex(left);
    const rightPos = getCaretPosForIndex(right);

    if (right === left) {
      return right;
    }

    const resolved =
      Math.abs(rightPos.x - pointerClientX) <
      Math.abs(leftPos.x - pointerClientX)
        ? right
        : left;

    if (
      (window as any).__e2eOverlay ||
      (window as any).EXCALIDRAW_WYSIWYG_DEBUG
    ) {
      const canvasRect = canvas.getBoundingClientRect();
      (window as any).__e2eWysiwygPointerDebug = {
        method: "binary",
        inputClientX: initialPointerDownClientCoords?.x ?? null,
        inputClientY: initialPointerDownClientCoords?.y ?? null,
        inputSceneX: initialPointerDownSceneCoords?.x ?? null,
        inputSceneY: initialPointerDownSceneCoords?.y ?? null,
        pointerClientX,
        pointerClientY,
        baseTextTopClientY,
        lineHeightClientPx,
        targetLine,
        resolvedIndex: resolved,
        offsetLeft: app.state.offsetLeft,
        offsetTop: app.state.offsetTop,
        canvasRectLeft: canvasRect.left,
        canvasRectTop: canvasRect.top,
      };
    }

    return resolved;
  };

  if (onChange) {
    editable.onpaste = async (event) => {
      // we need to synchronously get the MIME types so we can preventDefault()
      // in the same tick (FF requires that)
      const mimeTypes = parseDataTransferEventMimeTypes(event);

      let dataList: ParsedDataTranferList | null = null;

      // when copy/pasting excalidraw elements, only paste the text content
      //
      // Note that these custom MIME types only work within the same family
      // of browsers, so won't work e.g. between chrome and firefox. We could
      // parse the text/plain for existence of excalidraw instead, but this
      // is an edge case
      if (
        mimeTypes.has(MIME_TYPES.excalidrawClipboard) ||
        mimeTypes.has(MIME_TYPES.excalidraw)
      ) {
        // must be called in the same tick
        event.preventDefault();

        dataList = await parseDataTransferEvent(event);

        try {
          const parsed = await parseClipboard(dataList);

          if (parsed.elements) {
            const text = getTextFromElements(parsed.elements);
            if (text) {
              const { selectionStart, selectionEnd, value } = editable;

              editable.value =
                value.slice(0, selectionStart) +
                text +
                value.slice(selectionEnd);

              const newPos = selectionStart + text.length;
              editable.selectionStart = editable.selectionEnd = newPos;

              editable.dispatchEvent(new Event("input"));
            }
          }

          // if excalidraw elements don't contain any text elements,
          // don't paste anything
          return;
        } catch {
          console.warn("failed to parse excalidraw clipboard data");
        }
      }

      dataList = dataList || (await parseDataTransferEvent(event));

      const textItem = dataList.findByType(MIME_TYPES.text);
      if (!textItem) {
        return;
      }
      const text = normalizeText(textItem.value);
      if (!text) {
        return;
      }
      const container = getContainerElement(
        element,
        app.scene.getNonDeletedElementsMap(),
      );

      const font = getFontString({
        fontSize: app.state.currentItemFontSize,
        fontFamily: app.state.currentItemFontFamily,
      });
      if (container) {
        const boundTextElement = getBoundTextElement(
          container,
          app.scene.getNonDeletedElementsMap(),
        );
        const wrappedText = wrapText(
          `${editable.value}${text}`,
          font,
          getBoundTextMaxWidth(container, boundTextElement),
        );
        const width = getTextWidth(wrappedText, font);
        editable.style.width = `${width}px`;
      }
    };

    editable.oninput = () => {
      const normalized = normalizeText(editable.value);
      if (editable.value !== normalized) {
        const selectionStart = editable.selectionStart;
        editable.value = normalized;
        // put the cursor at some position close to where it was before
        // normalization (otherwise it'll end up at the end of the text)
        editable.selectionStart = selectionStart;
        editable.selectionEnd = selectionStart;
      }
      suppressHighlightOnInput = true;
      if (pendingInputRaf != null) {
        cancelAnimationFrame(pendingInputRaf);
      }
      //文本框增量换行,逐行渲染2026.3.28
      pendingInputRaf = requestAnimationFrame(() => {
        pendingInputRaf = null;
        updateWhitespaceOverlayContent();
        onChange(editable.value);
        scheduleCaretUpdate();
        suppressHighlightOnInput = false;
      });
    };

    const preventEditIfSyncedLine = (event: Event) => {
      const summaryTool = (element.customData as any)?.summaryTool;
      if (summaryTool?.role === "summaryRoot") {
        return;
      }
      const syncTagPrefix = "\u2063\u2063";
      const selectionStart = editable.selectionStart ?? 0;
      const selectionEnd = editable.selectionEnd ?? selectionStart;
      const selectionMin = Math.max(0, Math.min(selectionStart, selectionEnd));
      const selectionMax = Math.max(0, Math.max(selectionStart, selectionEnd));
      const value = editable.value;
      const startLineStart = value.lastIndexOf("\n", selectionMin - 1) + 1;
      const endLineEndIdx = value.indexOf("\n", selectionMax);
      const endLineEnd = endLineEndIdx === -1 ? value.length : endLineEndIdx;
      if (
        value.slice(startLineStart, endLineEnd).includes(syncTagPrefix) &&
        isSelectionInsideValidSynclist(value, selectionMin)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    editable.onpaste = preventEditIfSyncedLine;
    editable.oncut = preventEditIfSyncedLine;
  }

  editable.onkeydown = (event) => {
    const summaryTool = (element.customData as any)?.summaryTool;
    const syncTagPrefix = "\u2063\u2063";
    const selectionStart = editable.selectionStart ?? 0;
    const selectionEnd = editable.selectionEnd ?? selectionStart;
    const selectionMin = Math.max(0, Math.min(selectionStart, selectionEnd));
    const selectionMax = Math.max(0, Math.max(selectionStart, selectionEnd));
    const selectionIntersectsSyncedLine = (() => {
      const value = editable.value;
      const startLineStart = value.lastIndexOf("\n", selectionMin - 1) + 1;
      const endLineEndIdx = value.indexOf("\n", selectionMax);
      const endLineEnd = endLineEndIdx === -1 ? value.length : endLineEndIdx;
      const slice = value.slice(startLineStart, endLineEnd);
      return (
        slice.includes(syncTagPrefix) &&
        isSelectionInsideValidSynclist(value, selectionMin)
      );
    })();

    if (
      selectionIntersectsSyncedLine &&
      summaryTool?.role !== "summaryRoot" &&
      !(
        (event.altKey &&
          !event[KEYS.CTRL_OR_CMD] &&
          event.key === KEYS.ENTER) ||
        (event.altKey &&
          !event.shiftKey &&
          !event[KEYS.CTRL_OR_CMD] &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")) ||
        (event.altKey &&
          !event[KEYS.CTRL_OR_CMD] &&
          event.key.toLowerCase() === "l") ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Escape" ||
        event.key === "Shift" ||
        event.key === "Alt" ||
        event.key === "Control" ||
        event.key === "Meta" ||
        (event[KEYS.CTRL_OR_CMD] &&
          ["a", "c", "x"].includes(event.key.toLowerCase()))
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.altKey && !event[KEYS.CTRL_OR_CMD] && event.key === KEYS.ENTER) {
      const handled = (app as any).handleSummaryToolAltEnter?.(
        element.id,
        editable.selectionEnd ?? 0,
      );
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const direction = event.shiftKey ? "up" : "down";
      remapTextLineLinksForMoveLines(direction);
      moveLines(direction);
      editable.dispatchEvent(new Event("input"));
      scheduleCaretUpdate();
    } else if (
      event.altKey &&
      event[KEYS.CTRL_OR_CMD] &&
      !event.shiftKey &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      const handled = (app as any).handleSummaryToolCycleComment?.(
        element.id,
        editable.selectionEnd ?? 0,
        event.key === "ArrowRight" ? "next" : "prev",
      );
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    } else if (
      event.altKey &&
      !event.shiftKey &&
      !event[KEYS.CTRL_OR_CMD] &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      event.stopPropagation();
      remapTextLineLinksForMoveLines(event.key === "ArrowUp" ? "up" : "down");
      moveLines(event.key === "ArrowUp" ? "up" : "down");
      editable.dispatchEvent(new Event("input"));
      scheduleCaretUpdate();
    } else if (
      event.altKey &&
      !event[KEYS.CTRL_OR_CMD] &&
      event.key.toLowerCase() === "l"
    ) {
      event.preventDefault();
      event.stopPropagation();
      const caretIndex = editable.selectionEnd ?? 0;
      const lineNumber = editable.value.slice(0, caretIndex).split("\n").length;
      const side = event.shiftKey ? "left" : "right";
      const endpoint = { elementId: element.id, lineNumber, side } as const;
      const draft = app.state.textLineLinkDraft;
      if (!draft) {
        app.setState({ textLineLinkDraft: endpoint });
      } else {
        app.setState({
          textLineLinks: app.state.textLineLinks.concat({
            id: randomId(),
            from: draft,
            to: endpoint,
          }),
          textLineLinkDraft: null,
        });
      }
      scheduleCaretUpdate();
    } else if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
      scheduleCaretUpdate();
    } else if (!event.shiftKey && actionZoomOut.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomOut);
      updateWysiwygStyle();
      scheduleCaretUpdate();
    } else if (!event.shiftKey && actionResetZoom.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionResetZoom);
      updateWysiwygStyle();
      scheduleCaretUpdate();
    } else if (
      event[KEYS.CTRL_OR_CMD] &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "u"
    ) {
      event.preventDefault();
      event.stopPropagation();

      const start = editable.selectionStart ?? 0;
      const end = editable.selectionEnd ?? 0;
      if (start === end) {
        return;
      }

      app.actionManager.executeAction(
        actionToggleTextSelectionUnderline,
        "ui",
        {
          start,
          end,
          color: app.state.textSelectionUnderlineColor,
        },
      );
      scheduleCaretUpdate();
    } else if (
      event[KEYS.CTRL_OR_CMD] &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "c"
    ) {
      const { selectionStart, selectionEnd } = editable;
      if (selectionStart !== selectionEnd) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const caretIndex = selectionEnd ?? 0;
      const value = editable.value;
      const lineStart =
        value.lastIndexOf("\n", Math.max(0, caretIndex - 1)) + 1;
      const nextNewline = value.indexOf("\n", caretIndex);
      const lineEnd = nextNewline === -1 ? value.length : nextNewline;
      const lineText = value.slice(lineStart, lineEnd);
      void copyTextToSystemClipboard(lineText);
    } else if (actionDecreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionDecreaseFontSize);
    } else if (actionIncreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionIncreaseFontSize);
    } else if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      event.stopPropagation();
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (actionSaveToActiveFile.keyTest(event)) {
      event.preventDefault();
      handleSubmit();
      app.actionManager.executeAction(actionSaveToActiveFile);
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (
      event.key === KEYS.TAB ||
      (event[KEYS.CTRL_OR_CMD] &&
        (event.code === CODES.BRACKET_LEFT ||
          event.code === CODES.BRACKET_RIGHT))
    ) {
      event.preventDefault();
      if (event.isComposing) {
        return;
      } else if (event.shiftKey || event.code === CODES.BRACKET_LEFT) {
        outdent();
      } else {
        indent();
      }
      // We must send an input event to resize the element
      editable.dispatchEvent(new Event("input"));
    }
  };

  editable.addEventListener("keyup", scheduleCaretUpdate);
  editable.addEventListener("mouseup", scheduleCaretUpdate);
  editable.addEventListener("focus", scheduleCaretUpdate);

  const onSelectionChange = () => {
    if (document.activeElement === editable) {
      scheduleCaretUpdate();
    }
  };
  document.addEventListener("selectionchange", onSelectionChange);

  const TAB_SIZE = 4;
  const TAB = " ".repeat(TAB_SIZE);
  const RE_LEADING_TAB = new RegExp(`^ {1,${TAB_SIZE}}`);
  const indent = () => {
    const { selectionStart, selectionEnd } = editable;
    const linesStartIndices = getSelectedLinesStartIndices();

    let value = editable.value;
    linesStartIndices.forEach((startIndex: number) => {
      const startValue = value.slice(0, startIndex);
      const endValue = value.slice(startIndex);

      value = `${startValue}${TAB}${endValue}`;
    });

    editable.value = value;

    editable.selectionStart = selectionStart + TAB_SIZE;
    editable.selectionEnd = selectionEnd + TAB_SIZE * linesStartIndices.length;
  };

  const outdent = () => {
    const { selectionStart, selectionEnd } = editable;
    const linesStartIndices = getSelectedLinesStartIndices();
    const removedTabs: number[] = [];

    let value = editable.value;
    linesStartIndices.forEach((startIndex) => {
      const tabMatch = value
        .slice(startIndex, startIndex + TAB_SIZE)
        .match(RE_LEADING_TAB);

      if (tabMatch) {
        const startValue = value.slice(0, startIndex);
        const endValue = value.slice(startIndex + tabMatch[0].length);

        // Delete a tab from the line
        value = `${startValue}${endValue}`;
        removedTabs.push(startIndex);
      }
    });

    editable.value = value;

    if (removedTabs.length) {
      if (selectionStart > removedTabs[removedTabs.length - 1]) {
        editable.selectionStart = Math.max(
          selectionStart - TAB_SIZE,
          removedTabs[removedTabs.length - 1],
        );
      } else {
        // If the cursor is before the first tab removed, ex:
        // Line| #1
        //     Line #2
        // Lin|e #3
        // we should reset the selectionStart to his initial value.
        editable.selectionStart = selectionStart;
      }
      editable.selectionEnd = Math.max(
        editable.selectionStart,
        selectionEnd - TAB_SIZE * removedTabs.length,
      );
    }
  };

  const moveLines = (direction: "up" | "down") => {
    const { selectionStart, selectionEnd } = editable;
    const value = editable.value;
    const endForLine =
      selectionStart === selectionEnd
        ? selectionEnd
        : Math.max(selectionStart, selectionEnd - 1);

    const blockStart =
      value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const blockEndNewlineIndex = value.indexOf("\n", endForLine);
    const blockEnd =
      blockEndNewlineIndex === -1 ? value.length : blockEndNewlineIndex + 1;

    if (direction === "up") {
      if (blockStart === 0) {
        return;
      }
      const prevLineStart =
        value.lastIndexOf("\n", Math.max(0, blockStart - 2)) + 1;
      const prevLineOriginal = value.slice(prevLineStart, blockStart);
      const prevLineLength = prevLineOriginal.length;
      let prevLine = prevLineOriginal;
      let block = value.slice(blockStart, blockEnd);

      if (blockEnd === value.length && !value.endsWith("\n")) {
        if (!block.endsWith("\n")) {
          block = `${block}\n`;
        }
        if (prevLine.endsWith("\n")) {
          prevLine = prevLine.slice(0, -1);
        }
      }
      editable.value =
        value.slice(0, prevLineStart) +
        block +
        prevLine +
        value.slice(blockEnd);
      const shift = -prevLineLength;
      editable.selectionStart = selectionStart + shift;
      editable.selectionEnd = selectionEnd + shift;
      return;
    }

    if (blockEnd === value.length) {
      return;
    }
    const nextLineEndNewlineIndex = value.indexOf("\n", blockEnd);
    const nextLineEnd =
      nextLineEndNewlineIndex === -1
        ? value.length
        : nextLineEndNewlineIndex + 1;
    const nextLineOriginal = value.slice(blockEnd, nextLineEnd);
    const nextLineHasNewline = nextLineOriginal.endsWith("\n");
    let nextLine = nextLineOriginal;
    let block = value.slice(blockStart, blockEnd);

    if (!nextLineHasNewline) {
      if (block.endsWith("\n")) {
        block = block.slice(0, -1);
      }
      nextLine = `${nextLine}\n`;
    }
    editable.value =
      value.slice(0, blockStart) + nextLine + block + value.slice(nextLineEnd);
    const shift = nextLineHasNewline
      ? nextLineOriginal.length
      : nextLine.length;
    editable.selectionStart = selectionStart + shift;
    editable.selectionEnd = selectionEnd + shift;
  };

  const remapTextLineLinksForMoveLines = (direction: "up" | "down") => {
    const hasLinks = app.state.textLineLinks.length > 0;
    const draft = app.state.textLineLinkDraft;
    const shouldUpdateDraft = draft?.elementId === element.id;
    if (!hasLinks && !shouldUpdateDraft) {
      return;
    }

    const { selectionStart, selectionEnd } = editable;
    const value = editable.value;
    const endForLine =
      selectionStart === selectionEnd
        ? selectionEnd
        : Math.max(selectionStart, selectionEnd - 1);

    const blockStart =
      value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const blockEndNewlineIndex = value.indexOf("\n", endForLine);
    const blockEnd =
      blockEndNewlineIndex === -1 ? value.length : blockEndNewlineIndex + 1;

    if (direction === "up" && blockStart === 0) {
      return;
    }
    if (direction === "down" && blockEnd === value.length) {
      return;
    }

    const getLineNumberAtIndex = (index: number) => {
      return value.slice(0, Math.max(0, index)).split("\n").length;
    };

    const startLineNumber = getLineNumberAtIndex(blockStart);
    const endLineNumber = getLineNumberAtIndex(
      Math.max(blockStart, blockEnd - 1),
    );
    const blockLineCount = Math.max(1, endLineNumber - startLineNumber + 1);

    const remapLineNumber = (lineNumber: number) => {
      if (direction === "up") {
        const prevLineNumber = startLineNumber - 1;
        if (lineNumber === prevLineNumber) {
          return prevLineNumber + blockLineCount;
        }
        if (lineNumber >= startLineNumber && lineNumber <= endLineNumber) {
          return lineNumber - 1;
        }
        return lineNumber;
      }

      const nextLineNumber = endLineNumber + 1;
      if (lineNumber === nextLineNumber) {
        return nextLineNumber - blockLineCount;
      }
      if (lineNumber >= startLineNumber && lineNumber <= endLineNumber) {
        return lineNumber + 1;
      }
      return lineNumber;
    };

    const remapEndpoint = <T extends { elementId: string; lineNumber: number }>(
      endpoint: T,
    ): T => {
      if (endpoint.elementId !== element.id) {
        return endpoint;
      }
      return {
        ...endpoint,
        lineNumber: remapLineNumber(endpoint.lineNumber),
      };
    };

    const nextLinks = hasLinks
      ? app.state.textLineLinks.map((link) => ({
          ...link,
          from: remapEndpoint(link.from),
          to: remapEndpoint(link.to),
        }))
      : app.state.textLineLinks;

    const nextDraft = shouldUpdateDraft && draft ? remapEndpoint(draft) : draft;

    app.setState({
      textLineLinks: nextLinks,
      textLineLinkDraft: nextDraft ?? null,
    });
  };

  /**
   * @returns indices of start positions of selected lines, in reverse order
   */
  const getSelectedLinesStartIndices = () => {
    let { selectionStart, selectionEnd, value } = editable;

    // chars before selectionStart on the same line
    const startOffset = value.slice(0, selectionStart).match(/[^\n]*$/)![0]
      .length;
    // put caret at the start of the line
    selectionStart = selectionStart - startOffset;

    const selected = value.slice(selectionStart, selectionEnd);

    return selected
      .split("\n")
      .reduce(
        (startIndices, line, idx, lines) =>
          startIndices.concat(
            idx
              ? // curr line index is prev line's start + prev line's length + \n
                startIndices[idx - 1] + lines[idx - 1].length + 1
              : // first selected line
                selectionStart,
          ),
        [] as number[],
      )
      .reverse();
  };

  const stopEvent = (event: Event) => {
    if (event.target instanceof HTMLCanvasElement) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // using a state variable instead of passing it to the handleSubmit callback
  // so that we don't need to create separate a callback for event handlers
  let submittedViaKeyboard = false;
  const handleSubmit = () => {
    // prevent double submit
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    // cleanup must be run before onSubmit otherwise when app blurs the wysiwyg
    // it'd get stuck in an infinite loop of blur→onSubmit after we re-focus the
    // wysiwyg on update
    cleanup();
    const updateElement = app.scene.getElement(
      element.id,
    ) as ExcalidrawTextElement;
    if (!updateElement) {
      return;
    }
    const summaryTool = (updateElement.customData as any)?.summaryTool;
    if (summaryTool?.role === "summaryRoot") {
      lastSummarySelectionKey = "";
      lastSummaryLineNumber = null;
      if (Object.keys(app.state.selectedTextLineLinkIds).length) {
        app.setState({ selectedTextLineLinkIds: {} });
      }
    }
    const container = getContainerElement(
      updateElement,
      app.scene.getNonDeletedElementsMap(),
    );

    if (container) {
      if (editable.value.trim()) {
        const boundTextElementId = getBoundTextElementId(container);
        if (!boundTextElementId || boundTextElementId !== element.id) {
          app.scene.mutateElement(container, {
            boundElements: (container.boundElements || []).concat({
              type: "text",
              id: element.id,
            }),
          });
        } else if (isArrowElement(container)) {
          // updating an arrow label may change bounds, prevent stale cache:
          bumpVersion(container);
        }
      } else {
        app.scene.mutateElement(container, {
          boundElements: container.boundElements?.filter(
            (ele) =>
              !isTextElement(
                ele as ExcalidrawTextElement | ExcalidrawLinearElement,
              ),
          ),
        });
      }

      redrawTextBoundingBox(updateElement, container, app.scene);
    }

    onSubmit({
      viaKeyboard: submittedViaKeyboard,
      nextOriginalText: editable.value,
    });
  };

  const cleanup = () => {
    // remove events to ensure they don't late-fire
    keepCaretVisibleWhilePointerDown = false;
    editable.onblur = null;
    editable.oninput = null;
    editable.onkeydown = null;
    editable.removeEventListener("beforeinput", handleBeforeInput);
    editable.removeEventListener("input", handleInputHighlight);
    editable.removeEventListener("selectionchange", scheduleHighlightUpdate);
    editable.removeEventListener("keyup", scheduleCaretUpdate);
    editable.removeEventListener("mouseup", scheduleCaretUpdate);
    editable.removeEventListener("focus", scheduleCaretUpdate);
    document.removeEventListener("selectionchange", onSelectionChange);
    if (caretUpdateRaf != null) {
      cancelAnimationFrame(caretUpdateRaf);
      caretUpdateRaf = null;
    }
    if (highlightUpdateRaf != null) {
      cancelAnimationFrame(highlightUpdateRaf);
      highlightUpdateRaf = null;
    }

    if (dblClickCountdownRaf != null) {
      cancelAnimationFrame(dblClickCountdownRaf);
      dblClickCountdownRaf = null;
    }
    if (tripleClickCountdownRaf != null) {
      cancelAnimationFrame(tripleClickCountdownRaf);
      tripleClickCountdownRaf = null;
    }
    emitCountdown(WORD_COUNTDOWN_EVENT, {
      kind: "word",
      remainingMs: 0,
      durationMs: dblClickCountdownDurationMs,
      active: false,
    });
    emitCountdown(LINE_COUNTDOWN_EVENT, {
      kind: "line",
      remainingMs: 0,
      durationMs: tripleClickCountdownDurationMs,
      active: false,
    });

    if (observer) {
      observer.disconnect();
    }

    window.removeEventListener("resize", updateWysiwygStyle);
    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("pointerup", bindBlurEvent);
    window.removeEventListener("blur", handleSubmit);
    window.removeEventListener("beforeunload", handleSubmit);
    unbindUpdate();
    unsubOnChange();
    unbindOnScroll();

    editable.remove();
    whitespaceOverlay.remove();
    highlightOverlay.remove();
  };

  const bindBlurEvent = (event?: MouseEvent) => {
    window.removeEventListener("pointerup", bindBlurEvent);
    // Deferred so that the pointerdown that initiates the wysiwyg doesn't
    // trigger the blur on ensuing pointerup.
    // Also to handle cases such as picking a color which would trigger a blur
    // in that same tick.
    const target = event?.target;

    const isPropertiesTrigger =
      target instanceof HTMLElement &&
      target.classList.contains("properties-trigger");
    const isPropertiesContent =
      (target instanceof HTMLElement || target instanceof SVGElement) &&
      !!(target as Element).closest(".properties-content");
    const inShapeActionsMenu =
      (target instanceof HTMLElement || target instanceof SVGElement) &&
      (!!(target as Element).closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) ||
        !!(target as Element).closest(".compact-shape-actions-island"));

    setTimeout(() => {
      // If we interacted within shape actions menu or its popovers/triggers,
      // keep submit disabled and don't steal focus back to textarea.
      if (inShapeActionsMenu || isPropertiesTrigger || isPropertiesContent) {
        return;
      }

      // Otherwise, re-enable submit on blur and refocus the editor.
      editable.onblur = handleSubmit;
      editable.focus();
    });
  };

  const temporarilyDisableSubmit = () => {
    editable.onblur = null;
    window.addEventListener("pointerup", bindBlurEvent);
    // handle edge-case where pointerup doesn't fire e.g. due to user
    // alt-tabbing away
    window.addEventListener("blur", handleSubmit);
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    const target = event?.target;

    // panning canvas
    if (event.button === POINTER_BUTTON.WHEEL) {
      // trying to pan by clicking inside text area itself -> handle here
      if (target instanceof HTMLTextAreaElement) {
        event.preventDefault();
        app.handleCanvasPanUsingWheelOrSpaceDrag(event);
      }

      temporarilyDisableSubmit();
      return;
    }

    if (event.button === POINTER_BUTTON.SECONDARY) {
      keepCaretVisibleWhilePointerDown = true;
      scheduleCaretUpdate();
      if (target instanceof HTMLTextAreaElement) {
        event.preventDefault();
        app.handleCanvasPanUsingWheelOrSpaceDrag(event);
      }
      temporarilyDisableSubmit();
      return;
    }

    const isPropertiesTrigger =
      target instanceof HTMLElement &&
      target.classList.contains("properties-trigger");
    const isPropertiesContent =
      (target instanceof HTMLElement || target instanceof SVGElement) &&
      !!(target as Element).closest(".properties-content");

    if (
      ((event.target instanceof HTMLElement ||
        event.target instanceof SVGElement) &&
        (event.target.closest(
          `.${CLASSES.SHAPE_ACTIONS_MENU}, .${CLASSES.ZOOM_ACTIONS}`,
        ) ||
          event.target.closest(".compact-shape-actions-island")) &&
        !isWritableElement(event.target)) ||
      isPropertiesTrigger ||
      isPropertiesContent
    ) {
      temporarilyDisableSubmit();
    } else if (
      event.target instanceof HTMLCanvasElement &&
      event.button === POINTER_BUTTON.MAIN &&
      // Vitest simply ignores stopPropagation, capture-mode, or rAF
      // so without introducing crazier hacks, nothing we can do
      !isTestEnv()
    ) {
      // On mobile, blur event doesn't seem to always fire correctly,
      // so we want to also submit on pointerdown outside the wysiwyg.
      // Done in the next frame to prevent pointerdown from creating a new text
      // immediately (if tools locked) so that users on mobile have chance
      // to submit first (to hide virtual keyboard).
      // Note: revisit if we want to differ this behavior on Desktop
      requestAnimationFrame(() => {
        handleSubmit();
      });
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button === POINTER_BUTTON.SECONDARY) {
      keepCaretVisibleWhilePointerDown = false;
      scheduleCaretUpdate();
    }
  };

  const onContextMenu = (event: MouseEvent) => {
    const target = event.target;
    if (
      (target instanceof HTMLElement || target instanceof SVGElement) &&
      (target.closest(".excalidraw-textEditorContainer") ||
        target.closest(".excalidraw__canvas"))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // FIXME after we start emitting updates from Store for appState.theme
  const unsubOnChange = app.onChangeEmitter.on((elements) => {
    if (app.state.theme !== LAST_THEME) {
      updateWysiwygStyle();
    }
  });

  // handle updates of textElement properties of editing element
  const unbindUpdate = app.scene.onUpdate(() => {
    updateWysiwygStyle();
    const updatedElement = app.scene.getElement<ExcalidrawTextElement>(id);
    if (
      updatedElement &&
      isTextElement(updatedElement) &&
      document.activeElement === editable
    ) {
      const nextOriginalText =
        updatedElement.originalText ?? updatedElement.text;
      if (
        nextOriginalText !== editable.value &&
        nextOriginalText.includes("//synclist(")
      ) {
        const selectionStart = editable.selectionStart ?? 0;
        const selectionEnd = editable.selectionEnd ?? selectionStart;
        editable.value = nextOriginalText;
        const maxPos = nextOriginalText.length;
        editable.selectionStart = Math.min(selectionStart, maxPos);
        editable.selectionEnd = Math.min(selectionEnd, maxPos);
        updateWhitespaceOverlayContent();
        scheduleCaretUpdate();
      }
    }
    const isPopupOpened = !!document.activeElement?.closest(
      ".properties-content",
    );
    if (!isPopupOpened) {
      editable.focus();
    }
  });

  const unbindOnScroll = app.onScrollChangeEmitter.on(() => {
    updateWysiwygStyle();
  });

  // ---------------------------------------------------------------------------

  let isDestroyed = false;
  let lastPointerUpAt: number | null = null;
  let firstPointerUpAt: number | null = null;
  let lastWordSelectionAt: number | null = null;
  let lastNativeDblClickAt: number | null = null;
  let dblClickCountdownRaf: number | null = null;
  let dblClickCountdownStartAt = 0;
  let dblClickCountdownDurationMs = getDblClickSelectWordIntervalMs();
  let tripleClickCountdownRaf: number | null = null;
  let tripleClickCountdownStartAt = 0;
  let tripleClickCountdownDurationMs = getTripleClickSelectLineIntervalMs();

  const stopDblClickCountdown = () => {
    if (dblClickCountdownRaf != null) {
      cancelAnimationFrame(dblClickCountdownRaf);
      dblClickCountdownRaf = null;
    }
    emitCountdown(WORD_COUNTDOWN_EVENT, {
      kind: "word",
      remainingMs: 0,
      durationMs: dblClickCountdownDurationMs,
      active: false,
    });
  };

  const startDblClickCountdown = () => {
    stopDblClickCountdown();
    dblClickCountdownDurationMs = getDblClickSelectWordIntervalMs();
    dblClickCountdownStartAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - dblClickCountdownStartAt;
      const remaining = Math.max(0, dblClickCountdownDurationMs - elapsed);
      const active = remaining > 0;
      emitCountdown(WORD_COUNTDOWN_EVENT, {
        kind: "word",
        remainingMs: remaining,
        durationMs: dblClickCountdownDurationMs,
        active,
      });
      if (active) {
        dblClickCountdownRaf = requestAnimationFrame(tick);
      } else {
        dblClickCountdownRaf = null;
      }
    };

    tick();
  };

  const stopTripleClickCountdown = () => {
    if (tripleClickCountdownRaf != null) {
      cancelAnimationFrame(tripleClickCountdownRaf);
      tripleClickCountdownRaf = null;
    }
    emitCountdown(LINE_COUNTDOWN_EVENT, {
      kind: "line",
      remainingMs: 0,
      durationMs: tripleClickCountdownDurationMs,
      active: false,
    });
  };

  const startTripleClickCountdown = () => {
    stopTripleClickCountdown();
    tripleClickCountdownDurationMs = getTripleClickSelectLineIntervalMs();
    tripleClickCountdownStartAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - tripleClickCountdownStartAt;
      const remaining = Math.max(0, tripleClickCountdownDurationMs - elapsed);
      const active = remaining > 0;
      emitCountdown(LINE_COUNTDOWN_EVENT, {
        kind: "line",
        remainingMs: remaining,
        durationMs: tripleClickCountdownDurationMs,
        active,
      });
      if (active) {
        tripleClickCountdownRaf = requestAnimationFrame(tick);
      } else {
        tripleClickCountdownRaf = null;
      }
    };

    tick();
  };

  // reposition wysiwyg in case of canvas is resized. Using ResizeObserver
  // is preferred so we catch changes from host, where window may not resize.
  let observer: ResizeObserver | null = null;
  if (canvas && "ResizeObserver" in window) {
    observer = new window.ResizeObserver(() => {
      updateWysiwygStyle();
    });
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", updateWysiwygStyle);
  }

  editable.onpointerdown = (event) => {
    event.stopPropagation();
    if (event.button === POINTER_BUTTON.MAIN) {
      if (dblClickCountdownRaf == null) {
        startDblClickCountdown();
      }
    }
  };

  editable.addEventListener("dblclick", () => {
    lastNativeDblClickAt = performance.now();
    stopDblClickCountdown();
  });

  editable.addEventListener("pointerup", (event) => {
    if (event.button !== POINTER_BUTTON.MAIN) {
      return;
    }
    requestAnimationFrame(() => {
      if (document.activeElement !== editable) {
        return;
      }
      if (editable.selectionStart !== editable.selectionEnd) {
        return;
      }

      /*
      const text = whitespaceOverlayTextNode.nodeValue ?? "";
      if (text.length === 0) {
        return;
      }
      const clampedOffset = Math.max(
        0,
        Math.min(text.length, editable.selectionEnd ?? 0),
      );
      const range = document.createRange();
      const getCharRect = (idx: number): DOMRect | null => {
        if (idx < 0 || idx >= text.length || text[idx] === "\n") {
          return null;
        }
        range.setStart(whitespaceOverlayTextNode, idx);
        range.setEnd(whitespaceOverlayTextNode, idx + 1);
        const rects =
          "getClientRects" in range &&
          typeof range.getClientRects === "function"
            ? range.getClientRects()
            : [];
        if (rects.length > 0) {
          return rects[0]!;
        }
        const r = range.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          return r;
        }
        return null;
      };

      const contains = (rect: DOMRect) =>
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      const idxA = Math.max(0, Math.min(text.length - 1, clampedOffset));
      const idxB = Math.max(0, Math.min(text.length - 1, clampedOffset - 1));
      const rectA = getCharRect(idxA);
      const rectB = getCharRect(idxB);

      let nextIndex: number | null = null;
      if (rectA && contains(rectA)) {
        nextIndex = idxA + 1;
      } else if (rectB && contains(rectB)) {
        nextIndex = idxB + 1;
      }

      if (nextIndex != null) {
        const finalIndex = Math.max(0, Math.min(text.length, nextIndex));
        if (finalIndex !== editable.selectionEnd) {
          editable.selectionStart = editable.selectionEnd = finalIndex;
          scheduleCaretUpdate();
        }
      }
      */

      if (lastNativeDblClickAt != null) {
        const sinceNative = performance.now() - lastNativeDblClickAt;
        if (sinceNative >= 0 && sinceNative < 80) {
          lastPointerUpAt = null;
          firstPointerUpAt = null;
          lastWordSelectionAt = null;
          stopTripleClickCountdown();
          return;
        }
      }

      const now = performance.now();
      if (lastWordSelectionAt != null) {
        const sinceWord = now - lastWordSelectionAt;
        const tripleAfterWordMs = getTripleClickSelectLineIntervalMs();
        if (sinceWord >= 0 && sinceWord <= tripleAfterWordMs) {
          const value = editable.value;
          const start = Math.max(
            0,
            Math.min(value.length, editable.selectionStart ?? 0),
          );
          const end = Math.max(
            start,
            Math.min(value.length, editable.selectionEnd ?? start),
          );

          const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
          const nextNewline = value.indexOf("\n", Math.max(end, lineStart));
          const lineEnd = nextNewline === -1 ? value.length : nextNewline;

          editable.selectionStart = lineStart;
          editable.selectionEnd = lineEnd;
          scheduleCaretUpdate();

          lastPointerUpAt = null;
          firstPointerUpAt = null;
          lastWordSelectionAt = null;
          stopTripleClickCountdown();
          stopDblClickCountdown();
          return;
        }
        lastWordSelectionAt = null;
        stopTripleClickCountdown();
      }

      if (
        lastPointerUpAt != null &&
        now - lastPointerUpAt <= getDblClickSelectWordIntervalMs()
      ) {
        const value = editable.value;
        const caretIndex = Math.max(
          0,
          Math.min(value.length, editable.selectionEnd ?? 0),
        );

        const pivot =
          value.length === 0
            ? 0
            : Math.max(0, Math.min(value.length - 1, caretIndex - 1));
        const isWs = (ch: string) => /\s/.test(ch);
        const pivotIsWs = value[pivot] != null ? isWs(value[pivot]) : true;

        let start = pivotIsWs ? pivot : pivot;
        let end = pivotIsWs ? pivot + 1 : pivot + 1;

        while (start > 0 && isWs(value[start - 1]) === pivotIsWs) {
          start -= 1;
        }
        while (end < value.length && isWs(value[end]) === pivotIsWs) {
          end += 1;
        }

        const clampedStart = Math.max(0, Math.min(value.length, start));
        const clampedEnd = Math.max(clampedStart, Math.min(value.length, end));

        if (clampedStart !== clampedEnd) {
          editable.selectionStart = clampedStart;
          editable.selectionEnd = clampedEnd;
          scheduleCaretUpdate();
        }

        lastPointerUpAt = null;
        firstPointerUpAt = null;
        lastWordSelectionAt = now;
        startTripleClickCountdown();
        stopDblClickCountdown();
        return;
      }

      if (firstPointerUpAt == null) {
        firstPointerUpAt = now;
      } else if (now - firstPointerUpAt > getTripleClickTotalIntervalMs()) {
        firstPointerUpAt = now;
      }
      lastPointerUpAt = now;
    });
  });

  // rAF (+ capture to by doubly sure) so we don't catch te pointerdown that
  // triggered the wysiwyg
  requestAnimationFrame(() => {
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointerup", onPointerUp, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
  });
  window.addEventListener("beforeunload", handleSubmit);
  const textEditorContainer = excalidrawContainer?.querySelector(
    ".excalidraw-textEditorContainer",
  )!;

  // overlay 需要在 textarea 之前插入，确保 textarea（真实文本）始终在最上层可交互
  textEditorContainer.appendChild(whitespaceOverlay);
  textEditorContainer.appendChild(editable);

  const initialSelectionIndex = getSelectionIndexFromPointerDown();
  if (initialSelectionIndex !== null) {
    editable.selectionStart = editable.selectionEnd = initialSelectionIndex;
  } else if (autoSelect) {
    editable.select();
  }

  if (initialPointerDownSceneCoords || initialPointerDownClientCoords) {
    const initialStart = editable.selectionStart;
    const initialEnd = editable.selectionEnd;
    requestAnimationFrame(() => {
      if (!editable.isConnected) {
        return;
      }
      if (
        editable.selectionStart !== initialStart ||
        editable.selectionEnd !== initialEnd
      ) {
        return;
      }
      const recalculatedSelectionIndex = getSelectionIndexFromPointerDown();
      if (recalculatedSelectionIndex === null) {
        return;
      }
      editable.selectionStart = recalculatedSelectionIndex;
      editable.selectionEnd = recalculatedSelectionIndex;
      scheduleCaretUpdate();
    });
  }
  bindBlurEvent();

  return handleSubmit;
};

import {
  CODES,
  KEYS,
  CLASSES,
  POINTER_BUTTON,
  THEME,
  isWritableElement,
  getFontString,
  getFontFamilyString,
  isTestEnv,
  isSafari,
  MIME_TYPES,
  applyDarkModeFilter,
} from "@excalidraw/common";

import {
  getTextFromElements,
  originalContainerCache,
  updateBoundElements,
  updateOriginalContainerCache,
  measureText,
  wrapTextPreservingWhitespaceWithExplicitNewlineMarkers,
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
} from "@excalidraw/element/types";

import { actionSaveToActiveFile } from "../actions";

import {
  parseClipboard,
  parseDataTransferEvent,
  parseDataTransferEventMimeTypes,
} from "../clipboard";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
} from "../actions/actionCanvas";

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

  const whitespaceOverlay = document.createElement("div");
  whitespaceOverlay.classList.add("excalidraw-wysiwyg__whitespaceOverlay");

  let newlineMarkerPaddingPx = 0;

  const updateWhitespaceOverlayContent = () => {
    // overlay 内容与 textarea 同步，但 overlay 自身文字透明，仅通过 span 伪元素绘制点。
    // 这样既能 1:1 复用浏览器的换行/换页算法，又不会影响 textarea 的输入行为。
    whitespaceOverlay.replaceChildren();

    const text = editable.value;
    if (!text) {
      return;
    }

    let buffer = "";
    const flushBuffer = () => {
      if (buffer) {
        whitespaceOverlay.appendChild(document.createTextNode(buffer));
        buffer = "";
      }
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (ch === " ") {
        flushBuffer();
        const span = document.createElement("span");
        span.className = "excalidraw-wysiwyg__ws excalidraw-wysiwyg__ws--space";
        span.textContent = " ";
        whitespaceOverlay.appendChild(span);
        continue;
      }

      if (ch === "\n") {
        flushBuffer();
        const marker = document.createElement("span");
        marker.className =
          "excalidraw-wysiwyg__ws excalidraw-wysiwyg__ws--newline";
        marker.style.marginLeft = `${newlineMarkerPaddingPx}px`;
        whitespaceOverlay.appendChild(marker);
        whitespaceOverlay.appendChild(document.createTextNode("\n"));
        continue;
      }

      buffer += ch;
    }

    flushBuffer();
  };

  let LAST_THEME = app.state.theme;

  const updateWysiwygStyle = () => {
    LAST_THEME = app.state.theme;

    const appState = app.state;
    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);

    if (!updatedTextElement) {
      return;
    }
    const dotRadius = Math.max(0.5, updatedTextElement.fontSize * 0.09);
    newlineMarkerPaddingPx = Math.max(
      dotRadius * 4,
      updatedTextElement.fontSize * 0.4,
    );
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
        caretColor:
          appState.theme === THEME.DARK
            ? applyDarkModeFilter(updatedTextElement.strokeColor)
            : updatedTextElement.strokeColor,
        opacity: updatedTextElement.opacity / 100,
        maxHeight: `${editorMaxHeight}px`,
      });

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
      editable.scrollTop = 0;
      // For some reason updating font attribute doesn't set font family
      // hence updating font family explicitly for test environment
      if (isTestEnv()) {
        editable.style.fontFamily = getFontFamilyString(updatedTextElement);
        whitespaceOverlay.style.fontFamily = editable.style.fontFamily;
      }

      app.scene.mutateElement(updatedTextElement, { x: coordX, y: coordY });
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

  const getSelectionIndexFromPointerDown = () => {
    // 二次单击进入编辑时，根据点击位置计算 textarea selectionStart/End：
    // - 将点击点从旋转后的坐标系“反旋转”回元素本地坐标
    // - 用与编辑器一致的软换行（pre-wrap）拆分为行，并保留真实换行符位置
    // - 结合 textAlign 计算每行起始偏移，再用二分查找定位字符索引
    if (!initialPointerDownSceneCoords) {
      return null;
    }

    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);
    if (!updatedTextElement || !isTextElement(updatedTextElement)) {
      return null;
    }

    const elementsMap = app.scene.getNonDeletedElementsMap();
    const container = getContainerElement(updatedTextElement, elementsMap);
    const angle = getTextElementAngle(updatedTextElement, container);

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

    const unrotatedPointer = rotateAround(
      initialPointerDownSceneCoords.x,
      initialPointerDownSceneCoords.y,
      centerX,
      centerY,
      -angle,
    );

    const lineHeightPx =
      updatedTextElement.fontSize * updatedTextElement.lineHeight;
    if (lineHeightPx <= 0) {
      return 0;
    }

    const editorWidth =
      parseFloat(editable.style.width) || updatedTextElement.width;

    const normalizedValue = editable.value.replace(/\r\n?/g, "\n");
    const font = getFontString(updatedTextElement);

    const { lines, explicitNewlineAfterLine } =
      whitespaceOverlay.style.whiteSpace === "pre-wrap" ||
      whitespaceOverlay.style.whiteSpace === "break-spaces"
        ? wrapTextPreservingWhitespaceWithExplicitNewlineMarkers(
            normalizedValue,
            font,
            editorWidth,
          )
        : {
            lines: normalizedValue.split("\n"),
            explicitNewlineAfterLine: normalizedValue
              .split("\n")
              .map((_line, idx, arr) => idx < arr.length - 1),
          };

    const lineStartIndices: number[] = [];
    let currentIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      lineStartIndices.push(currentIndex);
      currentIndex += lines[i]?.length ?? 0;
      if (explicitNewlineAfterLine[i]) {
        currentIndex += 1;
      }
    }

    const localX = unrotatedPointer.x - updatedTextElement.x;
    const localY = unrotatedPointer.y - updatedTextElement.y;

    const clampedLineIndex = Math.max(
      0,
      Math.min(lines.length - 1, Math.floor(localY / lineHeightPx)),
    );

    const lineText = lines[clampedLineIndex] ?? "";
    const lineWidth =
      lineText === ""
        ? 0
        : measureText(lineText, font, updatedTextElement.lineHeight).width;

    let lineOffsetX = 0;
    if (updatedTextElement.textAlign === "center") {
      lineOffsetX = (editorWidth - lineWidth) / 2;
    } else if (updatedTextElement.textAlign === "right") {
      lineOffsetX = editorWidth - lineWidth;
    }
    lineOffsetX = Math.max(0, lineOffsetX);

    const xWithinLine = localX - lineOffsetX;

    const getPrefixWidth = (length: number) => {
      if (length <= 0) {
        return 0;
      }
      const prefix = lineText.slice(0, length);
      return prefix === ""
        ? 0
        : measureText(prefix, font, updatedTextElement.lineHeight).width;
    };

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

      const a = Math.max(0, lo - 1);
      const b = lo;
      const da = Math.abs(getPrefixWidth(a) - xWithinLine);
      const db = Math.abs(getPrefixWidth(b) - xWithinLine);
      charIndex = db < da ? b : a;
    }

    return (lineStartIndices[clampedLineIndex] ?? 0) + charIndex;
  };

  const initialSelectionIndex = getSelectionIndexFromPointerDown();

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
      updateWhitespaceOverlayContent();
      onChange(editable.value);
    };
  }

  editable.onkeydown = (event) => {
    if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionZoomOut.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomOut);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionResetZoom.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionResetZoom);
      updateWysiwygStyle();
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
    editable.onblur = null;
    editable.oninput = null;
    editable.onkeydown = null;

    if (observer) {
      observer.disconnect();
    }

    window.removeEventListener("resize", updateWysiwygStyle);
    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", bindBlurEvent);
    window.removeEventListener("blur", handleSubmit);
    window.removeEventListener("beforeunload", handleSubmit);
    unbindUpdate();
    unsubOnChange();
    unbindOnScroll();

    editable.remove();
    whitespaceOverlay.remove();
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

  // FIXME after we start emitting updates from Store for appState.theme
  const unsubOnChange = app.onChangeEmitter.on((elements) => {
    if (app.state.theme !== LAST_THEME) {
      updateWysiwygStyle();
    }
  });

  // handle updates of textElement properties of editing element
  const unbindUpdate = app.scene.onUpdate(() => {
    updateWysiwygStyle();
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

  if (initialSelectionIndex !== null) {
    // 二次单击进入编辑时：将光标放到点击位置（与 textarea 的软换行保持一致）
    editable.selectionStart = editable.selectionEnd = initialSelectionIndex;
  } else if (autoSelect) {
    // select on init (focusing is done separately inside the bindBlurEvent()
    // because we need it to happen *after* the blur event from `pointerdown`)
    editable.select();
  }
  bindBlurEvent();

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

  editable.onpointerdown = (event) => event.stopPropagation();

  // rAF (+ capture to by doubly sure) so we don't catch te pointerdown that
  // triggered the wysiwyg
  requestAnimationFrame(() => {
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
  });
  window.addEventListener("beforeunload", handleSubmit);
  const textEditorContainer = excalidrawContainer?.querySelector(
    ".excalidraw-textEditorContainer",
  )!;

  // overlay 需要在 textarea 之前插入，确保 textarea（真实文本）始终在最上层可交互
  textEditorContainer.appendChild(whitespaceOverlay);
  textEditorContainer.appendChild(editable);

  return handleSubmit;
};

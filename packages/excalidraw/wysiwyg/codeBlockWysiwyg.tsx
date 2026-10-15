import { KEYS, CLASSES, sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getCodeBlockLayout,
  getCornerRadius,
  CODE_BLOCK_FONT_FAMILY,
  tokenizeCodeBlock,
  getCodeBlockCaretIndexAtCoords,
  getCodeBlockTheme,
} from "@excalidraw/element";

import type {
  ExcalidrawCodeBlockElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type App from "../components/App";

export type CodeBlockWysiwygSubmitHandler = () => void;

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

const CLOSING_BRACKETS = new Set([")", "]", "}", '"', "'", "`"]);

export const handleCodeBlockSmartBackspace = ({
  val,
  start,
  end,
}: {
  val: string;
  start: number;
  end: number;
}): { nextVal: string; nextStart: number; nextEnd: number } | null => {
  if (start !== end || start <= 0) {
    return null;
  }

  const prev = val[start - 1];
  const next = val[start];
  if (prev && BRACKET_PAIRS[prev] && BRACKET_PAIRS[prev] === next) {
    return {
      nextVal: val.slice(0, start - 1) + val.slice(start + 1),
      nextStart: start - 1,
      nextEnd: start - 1,
    };
  }

  const lineStart = val.lastIndexOf("\n", start - 1) + 1;
  const beforeInLine = val.slice(lineStart, start);

  if (beforeInLine.length > 0) {
    const tabSize = 2;
    if (/^\s+$/.test(beforeInLine)) {
      const remainder = beforeInLine.length % tabSize;
      const deleteCount = remainder === 0 ? tabSize : remainder;
      return {
        nextVal: val.slice(0, start - deleteCount) + val.slice(start),
        nextStart: start - deleteCount,
        nextEnd: start - deleteCount,
      };
    }

    if (beforeInLine.endsWith("  ")) {
      return {
        nextVal: val.slice(0, start - 2) + val.slice(start),
        nextStart: start - 2,
        nextEnd: start - 2,
      };
    }
  }

  return null;
};

export const handleCodeBlockTab = ({
  val,
  start,
  end,
  shiftKey,
}: {
  val: string;
  start: number;
  end: number;
  shiftKey: boolean;
}): { nextVal: string; nextStart: number; nextEnd: number } => {
  const isMultiLine = start !== end && val.slice(start, end).includes("\n");

  if (shiftKey) {
    const blockStart = val.lastIndexOf("\n", start - 1) + 1;
    let blockEnd = val.indexOf("\n", end);
    if (blockEnd === -1) {
      blockEnd = val.length;
    }

    const blockText = val.slice(blockStart, blockEnd);
    const lines = blockText.split("\n");
    let firstLineRemoved = 0;
    let totalRemoved = 0;

    const newLines = lines.map((line, idx) => {
      let removed = 0;
      if (line.startsWith("  ")) {
        removed = 2;
      } else if (line.startsWith(" ")) {
        removed = 1;
      }
      if (idx === 0) {
        firstLineRemoved = removed;
      }
      totalRemoved += removed;
      return line.slice(removed);
    });

    return {
      nextVal:
        val.slice(0, blockStart) + newLines.join("\n") + val.slice(blockEnd),
      nextStart: Math.max(blockStart, start - firstLineRemoved),
      nextEnd: Math.max(blockStart, end - totalRemoved),
    };
  }

  if (isMultiLine) {
    const blockStart = val.lastIndexOf("\n", start - 1) + 1;
    let blockEnd = val.indexOf("\n", end);
    if (blockEnd === -1) {
      blockEnd = val.length;
    }

    const blockText = val.slice(blockStart, blockEnd);
    const lines = blockText.split("\n");
    const newLines = lines.map((line) => `  ${line}`);

    return {
      nextVal:
        val.slice(0, blockStart) + newLines.join("\n") + val.slice(blockEnd),
      nextStart: start + 2,
      nextEnd: end + lines.length * 2,
    };
  }

  return {
    nextVal: `${val.substring(0, start)}  ${val.substring(end)}`,
    nextStart: start + 2,
    nextEnd: start + 2,
  };
};

export const codeBlockWysiwyg = ({
  element,
  excalidrawContainer,
  app,
  onChange,
  onSubmit,
  initialCaretSceneCoords = null,
}: {
  element: NonDeleted<ExcalidrawCodeBlockElement>;
  excalidrawContainer: HTMLDivElement | null;
  app: App;
  onChange?: (nextCode: string) => void;
  onSubmit: (data: { nextCode: string }) => void;
  initialCaretSceneCoords?: { x: number; y: number } | null;
}): CodeBlockWysiwygSubmitHandler => {
  const ownerDocument = app.ownerDocument;
  const ownerWindow = app.ownerWindow;

  let isDestroyed = false;
  let submitted = false;

  const editorBox =
    excalidrawContainer?.querySelector<HTMLDivElement>(
      ".excalidraw-textEditorContainer",
    ) ?? excalidrawContainer;

  const container = ownerDocument.createElement("div");
  container.classList.add("excalidraw-codeblock-wysiwyg");

  const gutter = ownerDocument.createElement("div");
  gutter.classList.add("excalidraw-codeblock-wysiwyg__gutter");

  const activeLineHighlight = ownerDocument.createElement("div");
  activeLineHighlight.classList.add(
    "excalidraw-codeblock-wysiwyg__active-line",
  );

  const editorWrapper = ownerDocument.createElement("div");
  editorWrapper.classList.add("excalidraw-codeblock-wysiwyg__editor-wrapper");
  Object.assign(editorWrapper.style, {
    position: "relative",
    flex: "1",
    height: "100%",
    overflow: "hidden",
  });

  const highlightPre = ownerDocument.createElement("pre");
  highlightPre.classList.add("excalidraw-codeblock-wysiwyg__highlight");
  highlightPre.setAttribute("aria-hidden", "true");

  const editable = ownerDocument.createElement("textarea");
  editable.dir = "ltr";
  editable.tabIndex = 0;
  editable.dataset.type = "codeblock-wysiwyg";
  editable.wrap = "soft";
  editable.spellcheck = false;
  editable.autocomplete = "off";
  editable.autocapitalize = "off";
  editable.value = element.code ?? "";

  editorWrapper.appendChild(highlightPre);
  editorWrapper.appendChild(editable);

  container.appendChild(activeLineHighlight);
  container.appendChild(gutter);
  container.appendChild(editorWrapper);

  const updateHighlight = () => {
    if (isDestroyed) {
      return;
    }
    const latestElement =
      app.scene.getElement<NonDeleted<ExcalidrawCodeBlockElement>>(
        element.id,
      ) ?? element;
    const theme = getCodeBlockTheme(latestElement.theme);
    const text = editable.value;
    const rawLines = text.split(/\r?\n/);
    const tokenizedLines = tokenizeCodeBlock(rawLines, latestElement.language);

    highlightPre.replaceChildren();

    tokenizedLines.forEach((tokens, idx) => {
      const lineSpan = ownerDocument.createElement("span");
      lineSpan.style.display = "inline";

      if (tokens.length === 0) {
        // preserve blank line height
        lineSpan.textContent = "\n";
      } else {
        tokens.forEach((token) => {
          const tokenSpan = ownerDocument.createElement("span");
          tokenSpan.textContent = token.text;
          tokenSpan.style.color =
            theme.tokenColors[token.type] || theme.tokenColors.plain;
          if (token.type === "comment" || token.type === "instance") {
            tokenSpan.style.fontStyle = "italic";
          }
          lineSpan.appendChild(tokenSpan);
        });
        if (idx < tokenizedLines.length - 1) {
          lineSpan.appendChild(ownerDocument.createTextNode("\n"));
        }
      }
      highlightPre.appendChild(lineSpan);
    });

    // keep trailing newline visible in pre
    if (text.endsWith("\n")) {
      highlightPre.appendChild(ownerDocument.createTextNode(" "));
    }
  };

  const updateActiveLine = () => {
    if (isDestroyed || !editable) {
      return;
    }
    const val = editable.value;
    const selStart = editable.selectionStart ?? 0;
    const activeLogicalLineNumber = val
      .slice(0, selStart)
      .split(/\r?\n/).length;
    const latestElement = app.scene.getElement<
      NonDeleted<ExcalidrawCodeBlockElement>
    >(element.id);
    if (!latestElement) {
      return;
    }
    const theme = getCodeBlockTheme(latestElement.theme);

    const layout = getCodeBlockLayout(latestElement);

    const firstVisualIndex = layout.visualLines.findIndex(
      (v) => v.logicalLineNumber === activeLogicalLineNumber,
    );
    const subLineCount =
      layout.visualLines.filter(
        (v) => v.logicalLineNumber === activeLogicalLineNumber,
      ).length || 1;

    editable.scrollTop = 0;
    editable.scrollLeft = 0;
    const visualIdx = firstVisualIndex >= 0 ? firstVisualIndex : 0;
    const lineTop = layout.padding + visualIdx * layout.lineHeightPx;
    const highlightHeight = subLineCount * layout.lineHeightPx;

    const gutterWidth = latestElement.showLineNumbers ? layout.gutterWidth : 0;

    Object.assign(activeLineHighlight.style, {
      position: "absolute",
      left: `${gutterWidth}px`,
      right: "0",
      top: `${lineTop}px`,
      height: `${highlightHeight}px`,
      backgroundColor: theme.activeLine,
      pointerEvents: "none",
      zIndex: "1",
      display:
        lineTop + highlightHeight > 0 && lineTop < container.clientHeight
          ? "block"
          : "none",
    });
  };

  const updateLayout = () => {
    if (isDestroyed) {
      return;
    }
    const latestElement = app.scene.getElement<
      NonDeleted<ExcalidrawCodeBlockElement>
    >(element.id);
    if (!latestElement) {
      return;
    }
    const theme = getCodeBlockTheme(latestElement.theme);

    const zoom = app.state.zoom.value;
    const { x: viewportCenterX, y: viewportCenterY } =
      sceneCoordsToViewportCoords(
        {
          sceneX: latestElement.x + latestElement.width / 2,
          sceneY: latestElement.y + latestElement.height / 2,
        },
        app.state,
      );

    const editorBoxOffsetLeft = editorBox ? editorBox.offsetLeft : 0;
    const editorBoxOffsetTop = editorBox ? editorBox.offsetTop : 0;

    const left = viewportCenterX - app.state.offsetLeft - editorBoxOffsetLeft;
    const top = viewportCenterY - app.state.offsetTop - editorBoxOffsetTop;

    const radius = latestElement.roundness
      ? getCornerRadius(
          Math.min(latestElement.width, latestElement.height),
          latestElement,
        )
      : 0;

    const layout = getCodeBlockLayout(latestElement);
    const gutterWidth = latestElement.showLineNumbers ? layout.gutterWidth : 0;
    const borderWidth = latestElement.strokeWidth || 1;
    const borderColor =
      latestElement.strokeColor && latestElement.strokeColor !== "transparent"
        ? latestElement.strokeColor
        : theme.border;
    const strokeStyle =
      latestElement.strokeStyle === "dashed"
        ? "dashed"
        : latestElement.strokeStyle === "dotted"
        ? "dotted"
        : "solid";
    const outlineOffset = -borderWidth / 2;

    Object.assign(container.style, {
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      width: `${latestElement.width}px`,
      height: `${latestElement.height}px`,
      transform: `translate(-50%, -50%) scale(${zoom}) rotate(${latestElement.angle}rad)`,
      transformOrigin: "center center",
      backgroundColor:
        latestElement.backgroundColor &&
        latestElement.backgroundColor !== "transparent"
          ? latestElement.backgroundColor
          : theme.background,
      borderRadius: `${radius}px`,
      border: "none",
      outline: `${borderWidth}px ${strokeStyle} ${borderColor}`,
      outlineOffset: `${outlineOffset}px`,
      boxSizing: "border-box",
      overflow: "hidden",
      contain: "paint",
      zIndex: "var(--zIndex-wysiwyg)",
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "row",
    });

    Object.assign(editorWrapper.style, {
      borderTopRightRadius: `${radius}px`,
      borderBottomRightRadius: `${radius}px`,
      borderTopLeftRadius:
        latestElement.showLineNumbers && gutterWidth > 0 ? "0" : `${radius}px`,
      borderBottomLeftRadius:
        latestElement.showLineNumbers && gutterWidth > 0 ? "0" : `${radius}px`,
    });

    if (latestElement.showLineNumbers && gutterWidth > 0) {
      gutter.style.display = "block";
      Object.assign(gutter.style, {
        width: `${gutterWidth}px`,
        minWidth: `${gutterWidth}px`,
        height: "100%",
        backgroundColor: theme.gutterBackground,
        borderTopLeftRadius: `${radius}px`,
        borderBottomLeftRadius: `${radius}px`,
        paddingTop: `${layout.padding}px`,
        paddingRight: `${Math.max(
          6,
          Math.round(12 * (latestElement.fontSize / 14)),
        )}px`,
        paddingBottom: `${layout.padding}px`,
        boxSizing: "border-box",
        textAlign: "right",
        color: theme.gutterText,
        fontFamily: CODE_BLOCK_FONT_FAMILY,
        fontSize: `${latestElement.fontSize}px`,
        lineHeight: `${layout.lineHeightPx}px`,
        userSelect: "none",
        overflow: "hidden",
      });

      gutter.replaceChildren(
        ...layout.visualLines.map((vLine) => {
          const lineEl = ownerDocument.createElement("div");
          lineEl.style.height = `${layout.lineHeightPx}px`;
          lineEl.style.lineHeight = `${layout.lineHeightPx}px`;
          lineEl.textContent = vLine.isFirstSubLine
            ? String(vLine.logicalLineNumber)
            : "\u00A0";
          return lineEl;
        }),
      );
    } else {
      gutter.style.display = "none";
    }

    const commonEditorStyles: Partial<CSSStyleDeclaration> = {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "calc(100% + 20px)",
      margin: "0",
      padding: `${layout.padding}px`,
      fontFamily: CODE_BLOCK_FONT_FAMILY,
      fontSize: `${latestElement.fontSize}px`,
      lineHeight: `${layout.lineHeightPx}px`,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      boxSizing: "border-box",
      tabSize: "2",
      fontVariantLigatures: "none",
      fontFeatureSettings: '"liga" 0, "calt" 0',
    };

    Object.assign(highlightPre.style, {
      ...commonEditorStyles,
      backgroundColor: "transparent",
      pointerEvents: "none",
      userSelect: "none",
      overflow: "hidden",
      zIndex: "1",
    });

    Object.assign(editable.style, {
      ...commonEditorStyles,
      backgroundColor: "transparent",
      color: "transparent",
      caretColor: theme.tokenColors.plain,
      border: "none",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      scrollbarWidth: "none",
      zIndex: "2",
    });

    editable.scrollTop = 0;
    editable.scrollLeft = 0;
    highlightPre.scrollTop = 0;
    highlightPre.scrollLeft = 0;
    gutter.scrollTop = 0;
    gutter.scrollLeft = 0;

    updateHighlight();
    updateActiveLine();
  };

  editable.oninput = () => {
    onChange?.(editable.value);
    updateHighlight();
    updateLayout();
  };

  editable.onscroll = () => {
    if (editable.scrollTop !== 0) {
      editable.scrollTop = 0;
    }
    if (editable.scrollLeft !== 0) {
      editable.scrollLeft = 0;
    }
  };

  editable.onselect = updateActiveLine;
  editable.onclick = updateActiveLine;
  editable.onkeyup = updateActiveLine;

  editable.onkeydown = (event) => {
    const start = editable.selectionStart ?? 0;
    const end = editable.selectionEnd ?? 0;
    const val = editable.value;

    if (
      start === end &&
      CLOSING_BRACKETS.has(event.key) &&
      val[start] === event.key
    ) {
      event.preventDefault();
      editable.selectionStart = editable.selectionEnd = start + 1;
      updateActiveLine();
      return;
    }

    if (BRACKET_PAIRS[event.key]) {
      const open = event.key;
      const close = BRACKET_PAIRS[open];

      if (start !== end) {
        event.preventDefault();
        const selected = val.slice(start, end);
        editable.value =
          val.slice(0, start) + open + selected + close + val.slice(end);
        editable.selectionStart = start + 1;
        editable.selectionEnd = end + 1;
        editable.oninput?.(event as any);
        updateActiveLine();
        return;
      }

      const prevChar = start > 0 ? val[start - 1] : "";
      const nextChar = val[start] || "";

      // don't auto-close apostrophe in contractions
      if (open === "'" && /\w/.test(prevChar)) {
        return;
      }

      // don't auto-close quote preceding a word char
      if (
        (open === '"' || open === "'" || open === "`") &&
        /\w/.test(nextChar)
      ) {
        return;
      }

      event.preventDefault();
      editable.value = val.slice(0, start) + open + close + val.slice(end);
      editable.selectionStart = editable.selectionEnd = start + 1;
      editable.oninput?.(event as any);
      updateActiveLine();
      return;
    }

    if (
      event.key === KEYS.BACKSPACE &&
      !event[KEYS.CTRL_OR_CMD] &&
      !event.altKey &&
      start === end &&
      start > 0
    ) {
      const backspaceResult = handleCodeBlockSmartBackspace({
        val,
        start,
        end,
      });
      if (backspaceResult) {
        event.preventDefault();
        editable.value = backspaceResult.nextVal;
        editable.selectionStart = backspaceResult.nextStart;
        editable.selectionEnd = backspaceResult.nextEnd;
        editable.oninput?.(event as any);
        updateActiveLine();
        return;
      }
    }

    if (event.key === KEYS.TAB && !event[KEYS.CTRL_OR_CMD] && !event.altKey) {
      event.preventDefault();
      const tabResult = handleCodeBlockTab({
        val,
        start,
        end,
        shiftKey: event.shiftKey,
      });
      editable.value = tabResult.nextVal;
      editable.selectionStart = tabResult.nextStart;
      editable.selectionEnd = tabResult.nextEnd;
      editable.oninput?.(event as any);
      updateActiveLine();
      return;
    }

    if (event.key === KEYS.ENTER && !event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      const beforeCaret = val.substring(0, start);
      const lastLine = beforeCaret.split("\n").pop() || "";
      const indentMatch = lastLine.match(/^(\s+)/);
      const indent = indentMatch ? indentMatch[1] : "";

      const prevChar = val[start - 1];
      const nextChar = val[start];

      if (
        (prevChar === "{" && nextChar === "}") ||
        (prevChar === "[" && nextChar === "]") ||
        (prevChar === "(" && nextChar === ")")
      ) {
        const expandedIndent = `${indent}  `;
        editable.value = `${val.substring(
          0,
          start,
        )}\n${expandedIndent}\n${indent}${val.substring(end)}`;
        editable.selectionStart = editable.selectionEnd =
          start + 1 + expandedIndent.length;
      } else {
        const trimmedLastLine = lastLine.trimEnd();
        const shouldAddIndent =
          trimmedLastLine.endsWith("{") ||
          trimmedLastLine.endsWith("(") ||
          trimmedLastLine.endsWith("[") ||
          trimmedLastLine.endsWith(":");
        const nextIndent = shouldAddIndent ? `${indent}  ` : indent;

        editable.value = `${val.substring(
          0,
          start,
        )}\n${nextIndent}${val.substring(end)}`;
        editable.selectionStart = editable.selectionEnd =
          start + 1 + nextIndent.length;
      }

      editable.oninput?.(event as any);
      updateActiveLine();
      return;
    }

    if (
      event.key === KEYS.ESCAPE ||
      (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD])
    ) {
      event.preventDefault();
      handleSubmit();
    }
  };

  editable.onpointerdown = (event) => {
    event.stopPropagation();
  };

  const bindBlurEvent = () => {
    ownerWindow.removeEventListener("pointerup", bindBlurEvent);
    ownerWindow.removeEventListener("blur", handleSubmit);
    ownerWindow.setTimeout(() => {
      if (!isDestroyed) {
        editable.onblur = handleSubmit;
        editable.focus({ preventScroll: true });
      }
    });
  };

  const temporarilyDisableSubmit = () => {
    editable.onblur = null;
    ownerWindow.addEventListener("pointerup", bindBlurEvent);
    ownerWindow.addEventListener("blur", handleSubmit);
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event?.target;
    if (
      target instanceof ownerWindow.HTMLElement ||
      target instanceof ownerWindow.SVGElement
    ) {
      if (
        target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) ||
        target.closest(".compact-shape-actions-island") ||
        target.closest(".properties-content") ||
        target.closest(".properties-trigger") ||
        target.closest(".dropdown-menu")
      ) {
        temporarilyDisableSubmit();
      }
    }
  };

  let observer: ResizeObserver | null = null;
  if (app.canvas && "ResizeObserver" in ownerWindow) {
    observer = new ownerWindow.ResizeObserver(() => {
      updateLayout();
    });
    observer.observe(app.canvas);
  } else {
    ownerWindow.addEventListener("resize", updateLayout);
  }

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    app.scene.triggerUpdate();
    container.remove();
    observer?.disconnect();
    ownerWindow.removeEventListener("resize", updateLayout);
    ownerWindow.removeEventListener("pointerdown", onPointerDown, {
      capture: true,
    });
    ownerWindow.removeEventListener("pointerup", bindBlurEvent);
    ownerWindow.removeEventListener("blur", handleSubmit);
    unbindUpdate();
    unbindOnScroll();
  };

  const handleSubmit = () => {
    if (submitted) {
      return;
    }
    submitted = true;
    cleanup();
    onSubmit({ nextCode: editable.value });
  };

  ownerWindow.requestAnimationFrame(() => {
    if (!isDestroyed) {
      editable.onblur = handleSubmit;
      ownerWindow.addEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
    }
  });

  const unbindUpdate = app.scene.onUpdate(updateLayout);
  const unbindOnScroll = app.onScrollChangeEmitter.on(updateLayout);

  if (editorBox) {
    editorBox.appendChild(container);
  } else {
    ownerDocument.body.appendChild(container);
  }

  updateLayout();

  editable.focus({ preventScroll: true });
  editable.scrollTop = 0;
  editable.scrollLeft = 0;
  if (initialCaretSceneCoords) {
    const caretIndex = getCodeBlockCaretIndexAtCoords(
      element,
      initialCaretSceneCoords,
    );
    editable.setSelectionRange(caretIndex, caretIndex);
    editable.scrollTop = 0;
    editable.scrollLeft = 0;
    ownerWindow.requestAnimationFrame(() => {
      if (!isDestroyed) {
        editable.setSelectionRange(caretIndex, caretIndex);
        editable.scrollTop = 0;
        editable.scrollLeft = 0;
      }
    });
  } else {
    const len = editable.value.length;
    editable.setSelectionRange(len, len);
    editable.scrollTop = 0;
    editable.scrollLeft = 0;
  }

  return handleSubmit;
};

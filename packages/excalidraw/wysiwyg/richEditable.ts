/**
 * The text editor's editable: a `contenteditable` element whose styled
 * portions are `<span>`s (see `element.spans`), exposing the slice of the
 * `<textarea>` API the editor is written against (`value`, `selectionStart`,
 * `selectionEnd`, `selectionDirection`, `setSelectionRange()`, `select()`).
 *
 * The model (`value` + `spans`) is the source of truth. The DOM is rendered
 * from it, and read back into it after the browser edits it (typing, IME,
 * deleting). Edits the browser would make in its own, rich way (line breaks,
 * pastes, drops, formatting) are made on the model instead.
 *
 * DOM layout, kept canonical: a flat run of text nodes (unstyled portions)
 * and `<span data-rt>` elements holding one text node (styled portions),
 * ended by a sentinel `<br>` so a trailing line break shows a line.
 */
import { applyDarkModeFilter, getFontFamilyString } from "@excalidraw/common";

import {
  adjustTextSpansForEdit,
  adjustTextSpansForTextChange,
  applyTextSpanStyle,
  getTextSegments,
  normalizeTextSpans,
  sanitizeTextSpanStyle,
  textSpansEqual,
} from "@excalidraw/element";

import type {
  TextSpanBaseStyle,
  TextSpanStylePatch,
} from "@excalidraw/element";

import type {
  FontFamilyValues,
  TextSpan,
  TextSpanStyle,
} from "@excalidraw/element/types";

export type SelectionDirection = "forward" | "backward" | "none";

export type RichEditableAPI = {
  value: string;
  /** the styled portions of `value` */
  readonly spans: TextSpan[] | null;
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: SelectionDirection;
  setSelectionRange: (
    start: number,
    end: number,
    direction?: SelectionDirection,
  ) => void;
  select: () => void;
  /** replaces the content, keeping the selection where it can */
  setContent: (text: string, spans: readonly TextSpan[] | null) => void;
  /** types `text` over the selection, as the browser would */
  insertText: (text: string) => void;
  /**
   * styles the selected portion; `false` when nothing is selected (the
   * caller then styles the whole text)
   */
  applyStyle: (
    patch: TextSpanStylePatch,
    base: TextSpanBaseStyle,
  ) => boolean;
  /** the last selection inside the editable, also once it lost focus */
  getSelectionRange: () => {
    start: number;
    end: number;
    direction: SelectionDirection;
  };
  /** re-applies the spans' styles (e.g. after a theme change) */
  refreshStyles: () => void;
  /** removes document listeners */
  dispose: () => void;
};

export type RichEditable = HTMLDivElement & RichEditableAPI;

const SENTINEL_ATTR = "data-rt-sentinel";
const SPAN_ATTR = "data-rt";

const isSpanElement = (node: Node): node is HTMLElement =>
  node.nodeType === 1 && (node as HTMLElement).hasAttribute(SPAN_ATTR);

const isSentinel = (node: Node) =>
  node.nodeType === 1 && (node as HTMLElement).hasAttribute(SENTINEL_ATTR);

const isBlockElement = (node: Node) =>
  node.nodeType === 1 &&
  ["DIV", "P", "LI"].includes((node as HTMLElement).tagName);

const readSpanStyle = (element: HTMLElement): TextSpanStyle => {
  try {
    return sanitizeTextSpanStyle(
      JSON.parse(element.getAttribute(SPAN_ATTR) || "{}"),
    );
  } catch {
    return {};
  }
};

/**
 * Serializes DOM content (the editable's, or a fragment of it) into text and
 * per-character styles. Tolerates what browsers put in on their own
 * (`<br>`s, `<div>` lines, nested elements).
 */
const serializeNodes = (root: Node) => {
  let text = "";
  const spans: TextSpan[] = [];

  const visit = (node: Node, style: TextSpanStyle | null) => {
    if (node.nodeType === 3) {
      const value = (node as Text).data;
      if (value) {
        if (style) {
          spans.push({
            start: text.length,
            end: text.length + value.length,
            ...style,
          });
        }
        text += value;
      }
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) {
      return;
    }
    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      if (element.tagName === "BR") {
        if (!isSentinel(element)) {
          text += "\n";
        }
        return;
      }
      if (isBlockElement(element) && text && !text.endsWith("\n")) {
        text += "\n";
      }
      if (isSpanElement(element)) {
        style = { ...(style ?? {}), ...readSpanStyle(element) };
      }
    }
    node.childNodes.forEach((child) => visit(child, style));
  };

  visit(root, null);
  return { text, spans };
};

/** whether the editable's DOM is in the canonical layout */
const isCanonical = (editable: HTMLElement) => {
  const children = Array.from(editable.childNodes);
  const last = children[children.length - 1];
  if (!last || !isSentinel(last)) {
    return false;
  }
  return children
    .slice(0, -1)
    .every(
      (child) =>
        child.nodeType === 3 ||
        (isSpanElement(child) &&
          Array.from(child.childNodes).every((node) => node.nodeType === 3)),
    );
};

export const createRichEditable = (
  ownerDocument: Document,
  {
    isDarkMode,
  }: {
    isDarkMode: () => boolean;
  },
): RichEditable => {
  const editable = ownerDocument.createElement("div") as RichEditable;
  const ownerWindow = ownerDocument.defaultView ?? window;

  // plain-text editing where supported (the browser then never inserts
  // markup of its own); elsewhere the model makes those edits instead
  editable.setAttribute("contenteditable", "true");
  try {
    editable.contentEditable = "plaintext-only";
  } catch {
    // unsupported value
  }
  if (editable.getAttribute("contenteditable") !== "plaintext-only") {
    editable.setAttribute("contenteditable", "true");
  }
  editable.setAttribute("role", "textbox");
  editable.setAttribute("aria-multiline", "true");
  editable.spellcheck = false;

  let text = "";
  let spans: TextSpan[] | null = null;
  let lastSelection: {
    start: number;
    end: number;
    direction: SelectionDirection;
  } = { start: 0, end: 0, direction: "none" };

  const applySpanCSS = (element: HTMLElement, style: TextSpanStyle) => {
    element.style.color = style.strokeColor
      ? applyDarkModeFilter(style.strokeColor, isDarkMode())
      : "";
    element.style.fontFamily = style.fontFamily
      ? getFontFamilyString({ fontFamily: style.fontFamily })
      : "";
    element.style.fontSize = style.fontSize ? `${style.fontSize}px` : "";
    // (highlights are drawn by the editor's overlay, in full-line bands as
    // on the canvas — a span's background is only as tall as its glyphs)
    // A span's own line box (sized by *its* font's ascent and descent) would
    // make lines taller than the canvas lays them out, and the editor's box
    // would cut the text off: let the editor's own font size every line, as
    // the canvas does — unless the span's text is larger, which then sets
    // the line's height (as on the canvas).
    const baseFontSize = parseFloat(editable.style.fontSize) || 0;
    element.style.lineHeight =
      style.fontSize && style.fontSize > baseFontSize ? "" : "0";
    element.style.fontWeight = style.bold ? "bold" : "";
    element.style.fontStyle = style.italic ? "italic" : "";
    element.style.textDecoration =
      [style.underline && "underline", style.strikethrough && "line-through"]
        .filter(Boolean)
        .join(" ") || "";
  };

  const render = () => {
    const fragment = ownerDocument.createDocumentFragment();
    for (const segment of getTextSegments(spans, 0, text.length)) {
      const value = text.slice(segment.start, segment.end);
      const textNode = ownerDocument.createTextNode(value);
      if (Object.keys(segment.style).length) {
        const span = ownerDocument.createElement("span");
        span.setAttribute(SPAN_ATTR, JSON.stringify(segment.style));
        applySpanCSS(span, segment.style);
        span.appendChild(textNode);
        fragment.appendChild(span);
      } else {
        fragment.appendChild(textNode);
      }
    }
    const sentinel = ownerDocument.createElement("br");
    sentinel.setAttribute(SENTINEL_ATTR, "");
    fragment.appendChild(sentinel);
    editable.replaceChildren(fragment);
  };

  // --- offsets <-> DOM points ------------------------------------------------

  const isInside = (node: Node | null) =>
    !!node && (node === editable || editable.contains(node));

  const pointToOffset = (node: Node, offset: number) => {
    try {
      const range = ownerDocument.createRange();
      range.setStart(editable, 0);
      range.setEnd(node, offset);
      return Math.min(
        text.length,
        serializeNodes(range.cloneContents()).text.length,
      );
    } catch {
      return text.length;
    }
  };

  /**
   * At a boundary between two nodes, the end of the earlier one: text typed
   * there takes the style of the text before it.
   */
  const offsetToPoint = (offset: number): [Node, number] => {
    let remaining = Math.max(0, Math.min(offset, text.length));
    const walker = ownerDocument.createTreeWalker(editable, 4 /* TEXT */);
    let node = walker.nextNode() as Text | null;
    let lastNode: Text | null = null;
    while (node) {
      if (remaining <= node.data.length) {
        return [node, remaining];
      }
      remaining -= node.data.length;
      lastNode = node;
      node = walker.nextNode() as Text | null;
    }
    if (lastNode) {
      return [lastNode, lastNode.data.length];
    }
    return [editable, 0];
  };

  const readSelection = () => {
    const selection = ownerWindow.getSelection();
    if (
      !selection ||
      !selection.rangeCount ||
      !isInside(selection.anchorNode) ||
      !isInside(selection.focusNode)
    ) {
      return null;
    }
    const anchor = pointToOffset(selection.anchorNode!, selection.anchorOffset);
    const focus = pointToOffset(selection.focusNode!, selection.focusOffset);
    return {
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
      direction: (anchor === focus
        ? "none"
        : anchor < focus
        ? "forward"
        : "backward") as SelectionDirection,
    };
  };

  const getSelectionRange = () => {
    const current = readSelection();
    if (current) {
      lastSelection = current;
    }
    return {
      start: Math.min(lastSelection.start, text.length),
      end: Math.min(lastSelection.end, text.length),
      direction: lastSelection.direction,
    };
  };

  const setSelectionRange = (
    start: number,
    end: number,
    direction: SelectionDirection = "none",
  ) => {
    const from = Math.max(0, Math.min(start, text.length));
    const to = Math.max(from, Math.min(end, text.length));
    lastSelection = { start: from, end: to, direction };
    const selection = ownerWindow.getSelection();
    if (!selection || !editable.isConnected) {
      return;
    }
    const [startNode, startOffset] = offsetToPoint(from);
    const [endNode, endOffset] = offsetToPoint(to);
    try {
      if (direction === "backward") {
        selection.setBaseAndExtent(endNode, endOffset, startNode, startOffset);
      } else {
        selection.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
      }
    } catch {
      // detached / unsupported
    }
  };

  /** re-renders keeping the selection (in model offsets) */
  const rerender = (selection = getSelectionRange()) => {
    const hadFocus = ownerDocument.activeElement === editable;
    // re-rendering removes the nodes a selection is in, collapsing it — even
    // while the focus is elsewhere (e.g. on a styles panel button), which
    // the selection tracking would then take for the user's
    const hadSelection = !!readSelection();
    render();
    if (hadFocus || hadSelection) {
      setSelectionRange(selection.start, selection.end, selection.direction);
    } else {
      lastSelection = selection;
    }
  };

  const dispatchInput = () => {
    editable.dispatchEvent(new ownerWindow.Event("input"));
  };

  const insertText = (inserted: string) => {
    const { start, end } = getSelectionRange();
    spans = adjustTextSpansForEdit(
      spans,
      text.length,
      start,
      end - start,
      inserted.length,
    );
    text = text.slice(0, start) + inserted + text.slice(end);
    rerender({
      start: start + inserted.length,
      end: start + inserted.length,
      direction: "none",
    });
    dispatchInput();
  };

  // --- syncing browser edits back into the model ----------------------------

  // runs before the editor's own `oninput` (registered as a property, which
  // fires after listeners added first)
  editable.addEventListener("input", (event) => {
    const fromDom = serializeNodes(editable);
    const nextSpans = normalizeTextSpans(fromDom.spans, fromDom.text.length);
    const changed = fromDom.text !== text || !textSpansEqual(nextSpans, spans);
    if (changed) {
      text = fromDom.text;
      spans = nextSpans;
    }
    if (!isCanonical(editable) && !(event as InputEvent).isComposing) {
      rerender();
    } else {
      getSelectionRange();
    }
  });

  editable.addEventListener("compositionend", () => {
    if (!isCanonical(editable)) {
      rerender();
    }
  });

  editable.addEventListener("beforeinput", (event) => {
    switch (event.inputType) {
      case "insertParagraph":
      case "insertLineBreak":
        event.preventDefault();
        insertText("\n");
        break;
      case "insertFromDrop":
      case "insertFromPasteAsQuotation":
      case "insertLink":
        event.preventDefault();
        break;
      default:
        if (event.inputType.startsWith("format")) {
          event.preventDefault();
        }
    }
  });

  // focusing back (e.g. after a click in the styles panel) brings back the
  // selection it had, rather than a caret at the start
  editable.addEventListener("focus", () => {
    // a click into the editor already put the caret where it was clicked:
    // keep that one
    if (readSelection()) {
      return;
    }
    const { start, end, direction } = lastSelection;
    setSelectionRange(start, end, direction);
  });

  const onSelectionChange = () => {
    if (editable.isConnected) {
      const current = readSelection();
      if (current) {
        lastSelection = current;
      }
    }
  };
  ownerDocument.addEventListener("selectionchange", onSelectionChange);

  // --- the textarea-like API -------------------------------------------------

  const api: RichEditableAPI = {
    get value() {
      return text;
    },
    set value(nextText: string) {
      nextText = String(nextText ?? "");
      if (nextText === text) {
        return;
      }
      spans = adjustTextSpansForTextChange(spans, text, nextText);
      text = nextText;
      // as a textarea: the caret goes to the end
      rerender({ start: text.length, end: text.length, direction: "none" });
    },
    get spans() {
      return spans;
    },
    get selectionStart() {
      return getSelectionRange().start;
    },
    set selectionStart(value: number) {
      const current = getSelectionRange();
      setSelectionRange(value, Math.max(value, current.end), current.direction);
    },
    get selectionEnd() {
      return getSelectionRange().end;
    },
    set selectionEnd(value: number) {
      const current = getSelectionRange();
      setSelectionRange(
        Math.min(current.start, value),
        value,
        current.direction,
      );
    },
    get selectionDirection() {
      return getSelectionRange().direction;
    },
    set selectionDirection(direction: SelectionDirection) {
      const current = getSelectionRange();
      setSelectionRange(current.start, current.end, direction);
    },
    setSelectionRange,
    select: () => setSelectionRange(0, text.length),
    setContent: (nextText, nextSpans) => {
      text = nextText;
      spans = normalizeTextSpans(nextSpans, nextText.length);
      rerender();
    },
    insertText,
    applyStyle: (patch, base) => {
      const selection = getSelectionRange();
      if (selection.start === selection.end) {
        return false;
      }
      spans = applyTextSpanStyle(
        spans,
        text.length,
        selection.start,
        selection.end,
        patch,
        base,
      );
      rerender(selection);
      dispatchInput();
      return true;
    },
    getSelectionRange,
    refreshStyles: () => {
      editable
        .querySelectorAll<HTMLElement>(`[${SPAN_ATTR}]`)
        .forEach((span) => applySpanCSS(span, readSpanStyle(span)));
    },
    dispose: () => {
      ownerDocument.removeEventListener("selectionchange", onSelectionChange);
    },
  };

  for (const key of Object.keys(api) as (keyof RichEditableAPI)[]) {
    const descriptor = Object.getOwnPropertyDescriptor(api, key)!;
    Object.defineProperty(editable, key, {
      ...descriptor,
      configurable: true,
      enumerable: true,
    });
  }

  render();
  return editable;
};

/** the editor currently open, for actions styling its selected portion */
let activeRichEditor: {
  elementId: string;
  editable: RichEditable;
} | null = null;

export const setActiveRichEditor = (value: typeof activeRichEditor) => {
  activeRichEditor = value;
};

/**
 * The open editor of `elementId` when a portion of its text is selected
 * (the part a style should go to, rather than the whole text).
 */
export const getRichEditorWithSelection = (elementId: string | undefined) => {
  if (!activeRichEditor || activeRichEditor.elementId !== elementId) {
    return null;
  }
  const { editable } = activeRichEditor;
  const { start, end } = editable.getSelectionRange();
  // all of it selected (as when the editor opens): a style for the whole text
  const isPortion = start !== end && (start > 0 || end < editable.value.length);
  return isPortion ? editable : null;
};

export const getActiveRichEditor = (elementId: string | undefined) => {
  const editor = activeRichEditor;
  return editor && editor.elementId === elementId ? editor.editable : null;
};

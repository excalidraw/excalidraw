import { KEYS } from "@excalidraw/common";

import "./textAutocomplete.scss";

/**
 * Word autocomplete for the text editor.
 *
 * As you type inside the wysiwyg textarea, this offers completions drawn from
 * the words already present on the canvas (and in the text being edited), so
 * labels stay consistent across a drawing without reaching for a dictionary or
 * the network. The suggestions show in a small popup anchored under the caret —
 * the same canvas-anchored, token-styled language as the rest of the editor
 * (see ConvertElementTypePopup) — and never appear on an empty canvas, since
 * there is nothing to complete from.
 *
 * Keyboard, only while the popup is open:
 * - ↑ / ↓  move the highlight (wrapping)
 * - Tab    accept the highlighted word
 * - Esc    dismiss (a second Esc then closes the editor, as usual)
 * Enter is never intercepted, so a new line always stays a new line.
 */

/** the shortest typed word that triggers suggestions */
const MIN_PREFIX_LENGTH = 2;
/** how many suggestions to show at once */
const MAX_SUGGESTIONS = 6;
/** gap between the caret and the popup, in screen px */
const POPUP_OFFSET = 4;

// a "word" is a run of letters, numbers or underscores — matched with Unicode
// property escapes so non-latin scripts complete too
const WORD_SPLIT_RE = /[^\p{L}\p{N}_]+/u;
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

// caret moves (that don't change the text) we want to re-evaluate on
const CARET_MOVE_KEYS = new Set<string>([
  KEYS.ARROW_LEFT,
  KEYS.ARROW_RIGHT,
  "Home",
  "End",
]);

export type CaretViewportBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type TextAutocomplete = {
  /** recompute suggestions for the current caret position */
  update: () => void;
  /**
   * handle a keydown while the editor is focused; returns true when the event
   * was consumed (so the editor should do nothing else with it)
   */
  handleKeyDown: (event: KeyboardEvent) => boolean;
  /** tear down the popup and all listeners */
  destroy: () => void;
};

export const setupTextAutocomplete = ({
  editable,
  container,
  ownerDocument,
  getCaretViewportBounds,
  getBoxLeftInset,
  getCandidateTexts,
}: {
  editable: HTMLTextAreaElement;
  /** the editor's box (`.excalidraw-textEditorContainer`) the popup lives in */
  container: HTMLElement;
  ownerDocument: Document;
  /**
   * Where a caret is on screen, in the container's viewport coords. Without an
   * argument it's the current caret; pass an offset into the text to measure
   * elsewhere (e.g. the start of the word being completed).
   */
  getCaretViewportBounds: (caretOffset?: number) => CaretViewportBounds | null;
  /** the editor box's left inset, which the popup is positioned relative to */
  getBoxLeftInset: () => number;
  /** texts to draw completion candidates from (other elements + live value) */
  getCandidateTexts: () => string[];
}): TextAutocomplete => {
  let popup: HTMLDivElement | null = null;
  let items: string[] = [];
  let selectedIndex = 0;
  let prefixStart = 0;
  let prefix = "";
  // Esc keeps the popup closed until the text changes again
  let dismissed = false;
  // don't interrupt IME composition with suggestions
  let composing = false;

  // tokenizing every candidate text on each keystroke is cheap, but we still
  // skip it when neither the set of texts nor their contents changed
  let cachedSignature: string | null = null;
  let cachedVocabulary = new Map<string, number>();

  const getVocabulary = () => {
    const texts = getCandidateTexts();
    const signature = `${texts.length} ${texts.join(" ")}`;
    if (signature !== cachedSignature) {
      const frequencies = new Map<string, number>();
      for (const text of texts) {
        for (const token of text.split(WORD_SPLIT_RE)) {
          if (token.length >= MIN_PREFIX_LENGTH) {
            frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
          }
        }
      }
      cachedSignature = signature;
      cachedVocabulary = frequencies;
    }
    return cachedVocabulary;
  };

  /**
   * The word being typed right before the caret, or null when there's nothing
   * to complete (a selection, mid-word caret, or too short a prefix).
   */
  const getCurrentContext = () => {
    const { selectionStart, selectionEnd, value } = editable;
    if (selectionStart !== selectionEnd) {
      return null;
    }
    const caret = selectionStart;
    // don't complete from the middle of a word
    const charAfter = value[caret];
    if (charAfter && WORD_CHAR_RE.test(charAfter)) {
      return null;
    }
    let start = caret;
    while (start > 0 && WORD_CHAR_RE.test(value[start - 1])) {
      start -= 1;
    }
    const typed = value.slice(start, caret);
    if (typed.length < MIN_PREFIX_LENGTH) {
      return null;
    }
    return { prefix: typed, start };
  };

  const getSuggestions = (typed: string) => {
    const vocabulary = getVocabulary();
    const typedLower = typed.toLowerCase();
    const matches: { word: string; count: number }[] = [];

    for (const [word, count] of vocabulary) {
      const lower = word.toLowerCase();
      // longer than, and a continuation of, what's been typed — but not an
      // exact (case-insensitive) match, so a fully typed word stops suggesting
      if (
        word.length > typed.length &&
        lower.startsWith(typedLower) &&
        lower !== typedLower
      ) {
        matches.push({ word, count });
      }
    }

    matches.sort(
      (a, b) =>
        // most-used first, then shortest, then alphabetical
        b.count - a.count ||
        a.word.length - b.word.length ||
        a.word.localeCompare(b.word),
    );

    const seen = new Set<string>();
    const words: string[] = [];
    for (const { word } of matches) {
      const key = word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        words.push(word);
      }
      if (words.length >= MAX_SUGGESTIONS) {
        break;
      }
    }
    return words;
  };

  const isVisible = () =>
    !!popup && popup.style.display !== "none" && items.length > 0;

  const hide = () => {
    items = [];
    selectedIndex = 0;
    if (popup) {
      popup.style.display = "none";
    }
  };

  const onItemPointerDown = (event: PointerEvent) => {
    // keep focus in the textarea so clicking a suggestion doesn't blur (and
    // thereby submit) the editor
    event.preventDefault();
  };

  const onItemClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const item = target?.closest<HTMLElement>("[data-index]");
    if (item) {
      accept(Number(item.dataset.index));
    }
  };

  const ensurePopup = () => {
    if (popup) {
      return popup;
    }
    popup = ownerDocument.createElement("div");
    popup.className = "excalidraw-textAutocomplete";
    popup.dataset.testid = "text-autocomplete";
    popup.setAttribute("role", "listbox");
    popup.addEventListener("pointerdown", onItemPointerDown);
    popup.addEventListener("click", onItemClick);
    container.appendChild(popup);
    return popup;
  };

  const renderItems = () => {
    const el = ensurePopup();
    el.replaceChildren();

    items.forEach((word, index) => {
      const item = ownerDocument.createElement("div");
      item.className = "excalidraw-textAutocomplete__item";
      item.dataset.index = `${index}`;
      item.setAttribute("role", "option");
      if (index === selectedIndex) {
        item.classList.add("excalidraw-textAutocomplete__item--selected");
        item.setAttribute("aria-selected", "true");
      }

      // the already-typed part, emphasized, then the completion
      const match = ownerDocument.createElement("span");
      match.className = "excalidraw-textAutocomplete__match";
      match.textContent = word.slice(0, prefix.length);
      const rest = ownerDocument.createElement("span");
      rest.textContent = word.slice(prefix.length);

      const label = ownerDocument.createElement("span");
      label.className = "excalidraw-textAutocomplete__label";
      label.append(match, rest);
      item.append(label);

      if (index === selectedIndex) {
        const hint = ownerDocument.createElement("span");
        hint.className = "excalidraw-textAutocomplete__hint";
        hint.textContent = "Tab";
        item.append(hint);
      }

      el.append(item);
    });
  };

  const position = () => {
    if (!popup) {
      return;
    }
    const caretBounds = getCaretViewportBounds();
    if (!caretBounds) {
      hide();
      return;
    }
    // anchor the popup's left edge under the start of the word being completed,
    // so each suggestion lines up under what was typed; the leftmost of the two
    // carets keeps it correct for RTL too (fall back to the caret)
    const startBounds = getCaretViewportBounds(prefixStart);
    const anchorLeft = startBounds
      ? Math.min(startBounds.left, caretBounds.left)
      : caretBounds.left;

    const leftInset = getBoxLeftInset();
    const { width, height } = popup.getBoundingClientRect();

    let left = anchorLeft - leftInset;
    let top = caretBounds.bottom + POPUP_OFFSET;

    // flip above the caret when it would overflow the box's bottom
    if (top + height > container.clientHeight && caretBounds.top - height > 0) {
      top = caretBounds.top - height - POPUP_OFFSET;
    }
    // keep it within the box horizontally
    const maxLeft = container.clientWidth - width;
    left = Math.max(0, Math.min(left, maxLeft));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  const setSelected = (index: number) => {
    selectedIndex = index;
    renderItems();
  };

  const accept = (index: number) => {
    const word = items[index];
    if (!word) {
      return;
    }
    const { value, selectionStart } = editable;
    editable.value =
      value.slice(0, prefixStart) + word + value.slice(selectionStart);
    const caret = prefixStart + word.length;
    editable.selectionStart = editable.selectionEnd = caret;
    hide();
    // resize the element and run onChange, as a normal edit would
    editable.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const update = () => {
    if (composing || dismissed) {
      hide();
      return;
    }
    const context = getCurrentContext();
    if (!context) {
      hide();
      return;
    }
    const suggestions = getSuggestions(context.prefix);
    if (!suggestions.length) {
      hide();
      return;
    }
    items = suggestions;
    prefix = context.prefix;
    prefixStart = context.start;
    selectedIndex = 0;
    const el = ensurePopup();
    el.style.display = "block";
    renderItems();
    position();
  };

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!isVisible()) {
      return false;
    }
    switch (event.key) {
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        setSelected((selectedIndex + 1) % items.length);
        return true;
      case KEYS.ARROW_UP:
        event.preventDefault();
        setSelected((selectedIndex - 1 + items.length) % items.length);
        return true;
      case KEYS.TAB:
        event.preventDefault();
        accept(selectedIndex);
        return true;
      case KEYS.ESCAPE:
        event.preventDefault();
        dismissed = true;
        hide();
        return true;
      default:
        return false;
    }
  };

  const onInput = () => {
    // a real edit re-arms suggestions after an Esc dismissal
    dismissed = false;
    update();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (composing) {
      return;
    }
    // ↑/↓/Tab while open are handled on keydown — don't re-evaluate
    if (
      isVisible() &&
      (event.key === KEYS.ARROW_UP ||
        event.key === KEYS.ARROW_DOWN ||
        event.key === KEYS.TAB)
    ) {
      return;
    }
    if (CARET_MOVE_KEYS.has(event.key)) {
      update();
    }
  };

  const onPointerUp = () => {
    // let the selection settle before re-evaluating
    ownerDocument.defaultView?.setTimeout(update);
  };

  const onCompositionStart = () => {
    composing = true;
    hide();
  };

  const onCompositionEnd = () => {
    composing = false;
    update();
  };

  editable.addEventListener("input", onInput);
  editable.addEventListener("keyup", onKeyUp);
  editable.addEventListener("pointerup", onPointerUp);
  editable.addEventListener("compositionstart", onCompositionStart);
  editable.addEventListener("compositionend", onCompositionEnd);

  const destroy = () => {
    editable.removeEventListener("input", onInput);
    editable.removeEventListener("keyup", onKeyUp);
    editable.removeEventListener("pointerup", onPointerUp);
    editable.removeEventListener("compositionstart", onCompositionStart);
    editable.removeEventListener("compositionend", onCompositionEnd);
    if (popup) {
      popup.removeEventListener("pointerdown", onItemPointerDown);
      popup.removeEventListener("click", onItemClick);
      popup.remove();
      popup = null;
    }
  };

  return { update, handleKeyDown, destroy };
};

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

/**
 * sdamex: a text editor supplied by the host (board formulas, SdamEx #5072).
 * For the elements the host takes, `textWysiwyg` creates a positioned root in
 * place of the `<textarea>` and lets the host mount its own editor into it.
 * The fork keeps what it owns for the textarea: the geometry and style of the
 * root (font, line height, color, size, transform), submit on a canvas
 * pointerdown and on page unload, submit on blur unless a properties popup
 * took the pointer, and Escape, Ctrl/Cmd+Enter, save, zoom and font size
 * shortcuts on the root. Without a registered editor, or when `shouldEdit`
 * returns `false`, text is edited in the textarea as upstream.
 *
 * Contract:
 * - text goes in and out in the element format (`originalText`);
 * - `mount` runs synchronously inside `textWysiwyg`, before the root is in the
 *   DOM. The host may render into the root later (a React portal) and must
 *   answer `getValue()` with the current text from the start;
 * - `onChange(text, { lineHeight })` is the textarea `input`: the element is
 *   updated and resized. `lineHeight` (unitless, as the element property)
 *   changes the element line height first, e.g. for a tall inline fragment;
 * - `onBlur()` tells the fork that focus left the editor. The fork does not
 *   watch focus inside the root itself: inner fields of the host may hold
 *   focus away from the editor for a moment. The fork submits unless blur
 *   submit is paused, as the textarea `onblur`;
 * - `submit(viaKeyboard)` ends editing now;
 * - `focus()` focuses the editor and may come before the host rendered it.
 *   The fork calls it after scene updates only when focus is not inside the
 *   root. The root keeps the `excalidraw-wysiwyg` class, and its `focus()`
 *   calls the host, so pickers that refocus the text editor keep working;
 * - `onLayout()` runs after the fork restyled the root (scroll, zoom, element
 *   change), so the host can place UI attached to the editor;
 * - `unmount()` runs once when editing ends, before the root leaves the DOM.
 *
 * Events from inside the root count as writable targets
 * (`isWritableElement`, `isInputLike`), so the app does not treat them as
 * shortcuts or element paste.
 */
export type HostTextEditorMountProps = {
  element: ExcalidrawTextElement;
  initialText: string;
  /** Client point to put the caret at (double click on text), or `null`. */
  initialCaretClientPoint: { x: number; y: number } | null;
  onChange: (
    nextOriginalText: string,
    options?: { lineHeight?: number },
  ) => void;
  onBlur: () => void;
  submit: (viaKeyboard: boolean) => void;
};

export type HostTextEditorHandle = {
  getValue: () => string;
  focus: () => void;
  onLayout?: () => void;
  unmount: () => void;
};

export interface HostTextEditor {
  shouldEdit: (element: ExcalidrawTextElement) => boolean;
  mount: (
    root: HTMLDivElement,
    props: HostTextEditorMountProps,
  ) => HostTextEditorHandle;
}

let hostTextEditor: HostTextEditor | null = null;

/** Registers the host editor. Pass `null` to edit all text in the textarea. */
export const setHostTextEditor = (editor: HostTextEditor | null) => {
  hostTextEditor = editor;
};

export const getHostTextEditor = (): HostTextEditor | null => hostTextEditor;

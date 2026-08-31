import { useState, useCallback } from "react";

// Utility type for caret position
export type CaretPosition = {
  start: number;
  end: number;
};

// Utility function to get text editor element
const getTextEditor = (ownerDocument: Document): HTMLTextAreaElement | null => {
  return ownerDocument.querySelector(
    ".excalidraw-wysiwyg",
  ) as HTMLTextAreaElement;
};

// ---------------------------------------------------------------------------
// Module-level selection capture
//
// The browser collapses a textarea's text selection the moment it loses focus,
// which happens on pointerdown on any element outside the textarea — including
// color swatches. By the time an onClick handler or the action's perform()
// runs, selectionStart === selectionEnd and the range is gone.
//
// Solution: call captureSelectionNow() from onPointerDown on color buttons
// (before focus moves). The result is stored here and retrieved once by
// consumeCapturedSelection() inside perform().
// ---------------------------------------------------------------------------

/** Module-level store for the last eagerly-captured selection. */
let _lastCapturedSelection: CaretPosition | null = null;

/**
 * Read and store the textarea's current selection immediately.
 * Call this from `onPointerDown` on any UI control that will steal focus
 * from the wysiwyg editor (e.g. color swatches, color picker trigger).
 */
export const captureSelectionNow = (): void => {
  const textEditor = getTextEditor();
  if (textEditor) {
    _lastCapturedSelection = {
      start: textEditor.selectionStart,
      end: textEditor.selectionEnd,
    };
  }
};

/**
 * Return the last captured selection WITHOUT clearing it.
 * Use this when you need to read the selection for UI purposes (e.g. caret
 * restoration) but the value must still be available for perform() to consume.
 */
export const peekCapturedSelection = (): CaretPosition | null => {
  return _lastCapturedSelection;
};

/**
 * Return the last captured selection and clear the store.
 * Returns null if nothing was captured or if the editor wasn't active.
 */
export const consumeCapturedSelection = (): CaretPosition | null => {
  const captured = _lastCapturedSelection;
  _lastCapturedSelection = null;
  return captured;
};

// ---------------------------------------------------------------------------
// Utility functions for caret position management
export const saveCaretPosition = (
  ownerDocument: Document = document,
): CaretPosition | null => {
  const textEditor = getTextEditor(ownerDocument);
  if (textEditor) {
    return {
      start: textEditor.selectionStart,
      end: textEditor.selectionEnd,
    };
  }
  return null;
};

export const restoreCaretPosition = (
  position: CaretPosition | null,
  ownerDocument: Document = document,
): void => {
  const ownerWindow = ownerDocument.defaultView ?? window;
  ownerWindow.setTimeout(() => {
    const textEditor = getTextEditor(ownerDocument);
    if (textEditor) {
      textEditor.focus();
      if (position) {
        textEditor.selectionStart = position.start;
        textEditor.selectionEnd = position.end;
      }
    }
  }, 0);
};

export const withCaretPositionPreservation = (
  callback: () => void,
  isCompactMode: boolean,
  isEditingText: boolean,
  onPreventClose?: () => void,
  ownerDocument: Document = document,
): void => {
  // Prevent popover from closing in compact mode
  if (isCompactMode && onPreventClose) {
    onPreventClose();
  }

  // Save caret position if editing text
  const savedPosition =
    isCompactMode && isEditingText ? saveCaretPosition(ownerDocument) : null;

  // Execute the callback
  callback();

  // Restore caret position if needed
  if (isCompactMode && isEditingText) {
    restoreCaretPosition(savedPosition, ownerDocument);
  }
};

// Hook for managing text editor caret position with state
export const useTextEditorFocus = (ownerDocument: Document = document) => {
  const [savedCaretPosition, setSavedCaretPosition] =
    useState<CaretPosition | null>(null);

  const saveCaretPositionToState = useCallback(() => {
    const position = saveCaretPosition(ownerDocument);
    setSavedCaretPosition(position);
  }, [ownerDocument]);

  const restoreCaretPositionFromState = useCallback(() => {
    const ownerWindow = ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      const textEditor = getTextEditor(ownerDocument);
      if (textEditor) {
        textEditor.focus();
        if (savedCaretPosition) {
          textEditor.selectionStart = savedCaretPosition.start;
          textEditor.selectionEnd = savedCaretPosition.end;
          setSavedCaretPosition(null);
        }
      }
    }, 0);
  }, [ownerDocument, savedCaretPosition]);

  const clearSavedPosition = useCallback(() => {
    setSavedCaretPosition(null);
  }, []);

  return {
    saveCaretPosition: saveCaretPositionToState,
    restoreCaretPosition: restoreCaretPositionFromState,
    clearSavedPosition,
    hasSavedPosition: !!savedCaretPosition,
  };
};

// Utility function to temporarily disable text editor blur
export const temporarilyDisableTextEditorBlur = (
  ownerDocument: Document = document,
  duration: number = 100,
): void => {
  const textEditor = getTextEditor(ownerDocument);
  if (textEditor) {
    const originalOnBlur = textEditor.onblur;
    textEditor.onblur = null;

    const ownerWindow = ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      textEditor.onblur = originalOnBlur;
    }, duration);
  }
};

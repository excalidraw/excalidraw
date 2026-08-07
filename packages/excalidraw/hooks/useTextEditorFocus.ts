import { useState, useCallback } from "react";

// Utility type for caret position
export type CaretPosition = {
  start: number;
  end: number;
};

// Utility function to get text editor element
const getTextEditor = (): HTMLTextAreaElement | null => {
  return document.querySelector(".excalidraw-wysiwyg") as HTMLTextAreaElement;
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
// ---------------------------------------------------------------------------

export const saveCaretPosition = (): CaretPosition | null => {
  const textEditor = getTextEditor();
  if (textEditor) {
    return {
      start: textEditor.selectionStart,
      end: textEditor.selectionEnd,
    };
  }
  return null;
};

export const restoreCaretPosition = (position: CaretPosition | null): void => {
  setTimeout(() => {
    const textEditor = getTextEditor();
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
): void => {
  // Prevent popover from closing in compact mode
  if (isCompactMode && onPreventClose) {
    onPreventClose();
  }

  // Save caret position if editing text
  const savedPosition =
    isCompactMode && isEditingText ? saveCaretPosition() : null;

  // Execute the callback
  callback();

  // Restore caret position if needed
  if (isCompactMode && isEditingText) {
    restoreCaretPosition(savedPosition);
  }
};

// Hook for managing text editor caret position with state
export const useTextEditorFocus = () => {
  const [savedCaretPosition, setSavedCaretPosition] =
    useState<CaretPosition | null>(null);

  const saveCaretPositionToState = useCallback(() => {
    const position = saveCaretPosition();
    setSavedCaretPosition(position);
  }, []);

  const restoreCaretPositionFromState = useCallback(() => {
    setTimeout(() => {
      const textEditor = getTextEditor();
      if (textEditor) {
        textEditor.focus();
        if (savedCaretPosition) {
          textEditor.selectionStart = savedCaretPosition.start;
          textEditor.selectionEnd = savedCaretPosition.end;
          setSavedCaretPosition(null);
        }
      }
    }, 0);
  }, [savedCaretPosition]);

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
  duration: number = 100,
): void => {
  const textEditor = getTextEditor();
  if (textEditor) {
    const originalOnBlur = textEditor.onblur;
    textEditor.onblur = null;

    setTimeout(() => {
      textEditor.onblur = originalOnBlur;
    }, duration);
  }
};

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

// Utility functions for caret position management
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

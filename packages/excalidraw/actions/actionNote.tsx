import { isTextElement } from "@excalidraw/element";
import { removeNoteFromTextElement, hasNote } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionAddNote = register({
  name: "addNote",
  label: "labels.addNote",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V9.5l-3-3V16H5V5h4.5l3-3H4z"
        fill="currentColor"
      />
      <path d="m14 3 3 3-8 8L7 15l1-2 6-6z" fill="currentColor" />
    </svg>
  ),
  keywords: ["note", "tooltip", "annotation"],
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      !hasNote(selectedElements[0])
    );
  },
  perform: (elements, appState, value, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    const textElement = selectedElements[0] as ExcalidrawTextElement;

    return {
      elements,
      appState: {
        ...appState,
        editingNoteElementId: textElement.id,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionEditNote = register({
  name: "editNote",
  label: "labels.editNote",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V9.5l-3-3V16H5V5h4.5l3-3H4z"
        fill="currentColor"
      />
      <path d="m14 3 3 3-8 8L7 15l1-2 6-6z" fill="currentColor" />
    </svg>
  ),
  keywords: ["note", "tooltip", "edit", "annotation"],
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      hasNote(selectedElements[0])
    );
  },
  perform: (elements, appState, value, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    const textElement = selectedElements[0] as ExcalidrawTextElement;

    return {
      elements,
      appState: {
        ...appState,
        editingNoteElementId: textElement.id,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionRemoveNote = register({
  name: "removeNote",
  label: "labels.deleteNote",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M8.5 5a1.5 1.5 0 00-3 0V6h3V5zM10 6V5a3 3 0 10-6 0v1H2v1h1.064l.803 9.632A1.5 1.5 0 005.36 18h9.28a1.5 1.5 0 001.493-1.368L17.036 8H18V7h-2V6h-6zM5.064 8h9.872l-.75 9H5.814l-.75-9z"
        fill="currentColor"
      />
    </svg>
  ),
  keywords: ["note", "tooltip", "remove", "delete"],
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      hasNote(selectedElements[0])
    );
  },
  perform: (elements, appState, value, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    const textElement = selectedElements[0] as ExcalidrawTextElement;

    // Remove the note from the text element
    removeNoteFromTextElement(textElement, app.scene);

    return {
      elements: app.scene.getNonDeletedElements(),
      appState: {
        ...appState,
        editingNoteElementId: null,
        showingNoteTooltipElementId: null,
        showNoteTooltip: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

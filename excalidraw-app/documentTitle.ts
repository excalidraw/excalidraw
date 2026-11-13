import { APP_NAME } from "@excalidraw/common";

/** title used when the drawing has no name (matches index.html) */
export const DEFAULT_DOCUMENT_TITLE = `${APP_NAME} Whiteboard`;

/**
 * Returns the browser/PWA window title for the current drawing, so that
 * multiple open windows can be told apart (e.g. "Roadmap - Excalidraw").
 */
export const getDocumentTitle = (name: string | null | undefined): string => {
  const trimmedName = name?.trim();
  return trimmedName ? `${trimmedName} - ${APP_NAME}` : DEFAULT_DOCUMENT_TITLE;
};

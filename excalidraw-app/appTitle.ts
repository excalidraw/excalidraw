import { APP_NAME } from "@excalidraw/common";

export const getDocumentTitle = (name: string | null | undefined) => {
  const trimmedName = name?.trim();

  return trimmedName ? `${trimmedName} - ${APP_NAME}` : APP_NAME;
};

export const updateDocumentTitle = (name: string | null | undefined) => {
  const title = getDocumentTitle(name);

  if (document.title !== title) {
    document.title = title;
  }
};

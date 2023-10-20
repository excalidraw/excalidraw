import { waitFor } from "@testing-library/dom";

export const getTextEditor = async (waitForEditor = true) => {
  const query = () =>
    document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;
  if (waitForEditor) {
    waitFor(() => expect(query()).not.toBe(null));
    return query();
  }
  return query();
};

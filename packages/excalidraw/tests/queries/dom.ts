import { waitFor } from "@testing-library/dom";
import { fireEvent } from "@testing-library/react";

export const getTextEditor = async (selector: string, waitForEditor = true) => {
  const query = () => document.querySelector(selector) as HTMLTextAreaElement;
  if (waitForEditor) {
    await waitFor(() => expect(query()).not.toBe(null));
    return query();
  }
  return query();
};

export const updateTextEditor = (
  editor: HTMLTextAreaElement,
  value: string,
) => {
  fireEvent.change(editor, { target: { value } });
  editor.dispatchEvent(new Event("input"));
};

import { waitFor } from "@testing-library/dom";
import { fireEvent } from "@testing-library/react";

import {
  stripIgnoredNodesFromErrorMessage,
  trimErrorStack,
} from "../test-utils";

export const TEXT_EDITOR_SELECTOR =
  ".excalidraw-textEditorContainer > textarea";

export const getTextEditor = async ({
  selector = TEXT_EDITOR_SELECTOR,
  waitForEditor = true,
}: { selector?: string; waitForEditor?: boolean } = {}) => {
  const error = trimErrorStack(new Error());
  try {
    const query = () => document.querySelector(selector) as HTMLTextAreaElement;
    if (waitForEditor) {
      await waitFor(() => expect(query()).not.toBe(null));
      return query();
    }
    return query();
  } catch (err: any) {
    stripIgnoredNodesFromErrorMessage(err);
    err.stack = error.stack;
    throw err;
  }
};

export const updateTextEditor = (
  editor: HTMLTextAreaElement | HTMLInputElement,
  value: string,
) => {
  fireEvent.change(editor, { target: { value } });
  fireEvent.input(editor);
};

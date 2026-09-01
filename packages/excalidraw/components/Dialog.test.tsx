import { THEME } from "@excalidraw/common";

import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UIAppStateContext } from "../context/ui-appState";
import { EditorJotaiProvider } from "../editor-jotai";

import { ExcalidrawContainerContext } from "./App";
import { Dialog, type DialogProps } from "./Dialog";

import type { UIAppState } from "../types";

const minimalUIAppState = { theme: THEME.LIGHT } as UIAppState;

const renderDialog = (
  props: Omit<DialogProps, "onCloseRequest" | "children">,
) => {
  const onCloseRequest = () => {};
  const container = document.createElement("div");
  document.body.appendChild(container);
  return render(
    <EditorJotaiProvider>
      <UIAppStateContext.Provider value={minimalUIAppState}>
        <ExcalidrawContainerContext.Provider value={{ container, id: "test" }}>
          <Dialog {...props} onCloseRequest={onCloseRequest}>
            content
          </Dialog>
        </ExcalidrawContainerContext.Provider>
      </UIAppStateContext.Provider>
    </EditorJotaiProvider>,
  );
};

describe("Dialog", () => {
  afterEach(cleanup);

  it("labels the dialog via the title heading's actual id", () => {
    renderDialog({ title: "My dialog" });

    const dialogEl = screen.getByRole("dialog");
    const labelledBy = dialogEl.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    // The id aria-labelledby points to must actually exist in the DOM and
    // contain the title text -- this is the bug: they used to be different
    // strings ("dialog-title" vs "${id}-dialog-title").
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe("My dialog");
  });

  it("falls back to aria-label when there is no title", () => {
    renderDialog({ title: false, ariaLabel: "Export image" });

    const dialogEl = screen.getByRole("dialog");
    expect(dialogEl.getAttribute("aria-labelledby")).toBeNull();
    expect(dialogEl.getAttribute("aria-label")).toBe("Export image");
  });

  it("has no accessible name when there is neither a title nor an ariaLabel", () => {
    renderDialog({ title: false });

    const dialogEl = screen.getByRole("dialog");
    expect(dialogEl.getAttribute("aria-labelledby")).toBeNull();
    expect(dialogEl.getAttribute("aria-label")).toBeNull();
  });
});

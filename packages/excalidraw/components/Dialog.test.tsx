import React from "react";

import { Excalidraw } from "../index";
import { render, waitFor } from "../tests/test-utils";

const getDialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

describe("Dialog", () => {
  it("resolves the accessible name for a titled dialog", async () => {
    await render(
      <Excalidraw initialData={{ appState: { openDialog: { name: "help" } } }} />,
    );

    const dialog = getDialog();
    expect(dialog).not.toBeNull();

    const labelledBy = dialog!.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const label = document.getElementById(labelledBy!);
    expect(label).not.toBeNull();
    expect(dialog!.contains(label)).toBe(true);
    expect(dialog!.getAttribute("aria-label")).toBeNull();
  });

  it("uses an accessible name when the dialog has no title", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: { openDialog: { name: "ttd", tab: "mermaid" } },
        }}
      />,
    );

    await waitFor(() => expect(getDialog()).not.toBeNull());

    const dialog = getDialog()!;
    expect(dialog.getAttribute("aria-label")).toBe("Dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeNull();
  });
});

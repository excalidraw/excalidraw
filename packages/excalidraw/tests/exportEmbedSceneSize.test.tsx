import React from "react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
  fireEvent,
  queryByTestId,
  render,
  toggleMenu,
  waitFor,
} from "./test-utils";

const { h } = window;

describe("image export dialog: embedded scene size (#2236)", () => {
  const openExportDialog = async (exportEmbedScene: boolean) => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle" })],
          appState: { exportEmbedScene },
        }}
      />,
    );
    toggleMenu(container);
    fireEvent.click(queryByTestId(container, "image-export-button")!);
    return document.querySelector(".ImageExportModal") as HTMLElement;
  };

  const getEmbedSwitch = () =>
    document.querySelector(
      'input[name="exportEmbedSwitch"]',
    ) as HTMLInputElement;

  it("does not show the size when 'Embed scene' is off", async () => {
    const dialog = await openExportDialog(false);
    expect(getEmbedSwitch().checked).toBe(false);
    expect(queryByTestId(dialog, "export-embed-scene-size")).toBe(null);
  });

  it("shows the size increase once 'Embed scene' is turned on", async () => {
    const dialog = await openExportDialog(false);

    fireEvent.click(getEmbedSwitch());
    expect(h.state.exportEmbedScene).toBe(true);

    await waitFor(() => {
      expect(
        queryByTestId(dialog, "export-embed-scene-size")?.textContent,
      ).toMatch(/^\+\d+(\.\d)? (B|kB|MB)$/);
    });

    // and hides it again when turned off
    fireEvent.click(getEmbedSwitch());
    await waitFor(() => {
      expect(queryByTestId(dialog, "export-embed-scene-size")).toBe(null);
    });
  });

  it("shows the size right away when 'Embed scene' is already on", async () => {
    const dialog = await openExportDialog(true);
    await waitFor(() => {
      expect(queryByTestId(dialog, "export-embed-scene-size")).not.toBe(null);
    });
  });
});

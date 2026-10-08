import React from "react";

import { Excalidraw } from "../index";
import { t } from "../i18n";

import { API } from "./helpers/api";
import { fireEvent, render, screen, waitFor } from "./test-utils";

const clipboardMock = vi.hoisted(() => ({
  supported: true,
  copyBlobToClipboardAsPng: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    get probablySupportsClipboardBlob() {
      return clipboardMock.supported;
    },
    copyBlobToClipboardAsPng: clipboardMock.copyBlobToClipboardAsPng,
  };
});

const renderExportDialog = async (exportEmbedScene: boolean) => {
  await render(
    <Excalidraw
      initialData={{
        elements: [API.createElement({ type: "rectangle" })],
        appState: { exportEmbedScene },
      }}
    />,
  );
  API.setAppState({ openDialog: { name: "imageExport" } });
};

describe("image export dialog", () => {
  beforeEach(() => {
    clipboardMock.supported = true;
    clipboardMock.copyBlobToClipboardAsPng.mockClear();
  });

  it.each([false, true])(
    "explains the clipboard limitation when embedding is enabled (initially %s)",
    async (initiallyEnabled) => {
      await renderExportDialog(initiallyEnabled);

      const embedScene = screen.getByLabelText(
        t("imageExportDialog.label.embedScene"),
      );
      const notice =
        "Copied images don't include scene data. Download a PNG or SVG to keep the scene editable.";

      expect(!!screen.queryByText(notice)).toBe(initiallyEnabled);

      fireEvent.click(embedScene);
      expect(!!screen.queryByText(notice)).toBe(!initiallyEnabled);
      expect(window.h.state.exportEmbedScene).toBe(!initiallyEnabled);

      fireEvent.click(embedScene);
      expect(!!screen.queryByText(notice)).toBe(initiallyEnabled);
    },
  );

  it("can copy an image without changing the embedding preference for downloads", async () => {
    await renderExportDialog(true);

    const copyButton = screen.getByRole("button", {
      name: t("imageExportDialog.title.copyPngToClipboard"),
    });
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    await waitFor(() =>
      expect(clipboardMock.copyBlobToClipboardAsPng).toHaveBeenCalledTimes(1),
    );
    expect(window.h.state.exportEmbedScene).toBe(true);
    expect(
      screen.getByLabelText(t("imageExportDialog.label.embedScene")),
    ).toBeChecked();
  });

  it("does not show a clipboard notice when copying images is unavailable", async () => {
    clipboardMock.supported = false;
    await renderExportDialog(true);

    expect(
      screen.queryByRole("button", {
        name: t("imageExportDialog.title.copyPngToClipboard"),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Copied images don't include scene data. Download a PNG or SVG to keep the scene editable.",
      ),
    ).not.toBeInTheDocument();
  });
});

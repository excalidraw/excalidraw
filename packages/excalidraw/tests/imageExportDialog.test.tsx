import React from "react";

import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";

import * as data from "../data";
import * as blob from "../data/blob";
import { Excalidraw } from "../index";
import { t } from "../i18n";
import * as sceneExport from "../scene/export";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

vi.mock("../clipboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../clipboard")>()),
  probablySupportsClipboardBlob: true,
}));

const { h } = window;

describe("image export padding", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
    vi.spyOn(blob, "canvasToBlob").mockResolvedValue(new Blob());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openDialog = async (width = 100, height = 50) => {
    await render(<Excalidraw />);
    act(() => {
      API.setElements([
        API.createElement({ type: "rectangle", width, height }),
      ]);
      h.setState({ openDialog: { name: "imageExport" } });
    });
    return screen.getByLabelText(
      t("imageExportDialog.label.padding"),
    ) as HTMLInputElement;
  };

  it.each([0, 32])(
    "updates the preview and all exports with %s px padding",
    async (padding) => {
      const preview = vi.spyOn(sceneExport, "exportScene");
      const save = vi.spyOn(data, "exportCanvas").mockResolvedValue(undefined);
      const input = await openDialog();
      expect(input.value).toBe(String(DEFAULT_EXPORT_PADDING));

      fireEvent.change(input, { target: { value: String(padding) } });
      await waitFor(() => {
        expect(preview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            type: "canvas",
            config: expect.objectContaining({ padding }),
          }),
        );
      });

      for (const [type, label] of [
        ["png", "exportToPng"],
        ["svg", "exportToSvg"],
        ["clipboard", "copyPngToClipboard"],
      ] as const) {
        fireEvent.click(
          screen.getByRole("button", {
            name: t(`imageExportDialog.title.${label}`),
          }),
        );
        await waitFor(() => {
          expect(save).toHaveBeenLastCalledWith(
            type,
            expect.any(Array),
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ exportPadding: padding }),
          );
        });
      }
    },
  );

  it.each(["", "-1", "1.5", "1e20"])(
    "keeps the last valid padding when the input is %j",
    async (value) => {
      const preview = vi.spyOn(sceneExport, "exportScene");
      const input = await openDialog();
      fireEvent.change(input, { target: { value: "24" } });
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
      expect(input.value).toBe("24");
      await waitFor(() => {
        expect(preview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({ padding: 24 }),
          }),
        );
      });
    },
  );

  it("scales the preview padding with large drawings", async () => {
    const preview = vi.spyOn(sceneExport, "exportScene");
    const input = await openDialog(1000, 500);
    fireEvent.change(input, { target: { value: "50" } });
    await waitFor(() => {
      const canvas = document.querySelector(
        ".ImageExportModal__preview__canvas canvas",
      ) as HTMLCanvasElement;
      // 1100 x 600 at full size, fitted into the 400 x 300 preview.
      expect(canvas?.width).toBe(400);
      expect(canvas?.height).toBe(218);
    });
    expect(preview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ padding: 50 }),
      }),
    );
  });

  it("does not offer padding when exporting a frame", async () => {
    await render(<Excalidraw />);
    act(() => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 50,
      });
      API.setElements([frame]);
      API.setSelectedElements([frame]);
      h.setState({ openDialog: { name: "imageExport" } });
    });
    expect(
      screen.queryByLabelText(t("imageExportDialog.label.padding")),
    ).toBeNull();
  });
});

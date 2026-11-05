import React from "react";

import * as data from "../data";
import * as blob from "../data/blob";
import { Excalidraw } from "../index";
import { t } from "../i18n";
import { getDefaultAppState } from "../appState";
import { exportScene } from "../scene/export";
import { getExportSizeForAspectRatio } from "../scene/exportSize";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

vi.mock("../clipboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../clipboard")>()),
  probablySupportsClipboardBlob: true,
}));

const { h } = window;
const ratios = [1, 4 / 3, 3 / 4, 16 / 9, 9 / 16];

describe("aspect-ratio export sizing", () => {
  it.each(ratios)(
    "pads a drawing to ratio %s without scaling its contents",
    async (ratio) => {
      const elements = [
        API.createElement({
          type: "rectangle",
          x: -100,
          y: 200,
          width: 300,
          height: 150,
        }),
      ];
      const original = JSON.stringify(elements);
      const config = getExportSizeForAspectRatio(elements, ratio);
      expect(config).toMatchObject({ fit: "none", position: "center" });
      expect(config.width).toBeGreaterThanOrEqual(300);
      expect(config.height).toBeGreaterThanOrEqual(150);
      expect((config.width! + 20) / (config.height! + 20)).toBeCloseTo(ratio);

      for (const type of ["canvas", "svg"] as const) {
        for (const scale of [1, 2]) {
          const output = await exportScene({
            type,
            data: { elements, appState: getDefaultAppState(), files: {} },
            config: { ...config, scale },
          });
          if (output instanceof Blob) {
            throw new Error("Expected a canvas or SVG export");
          }
          const width =
            output instanceof HTMLCanvasElement
              ? output.width
              : Number(output.getAttribute("width"));
          const height =
            output instanceof HTMLCanvasElement
              ? output.height
              : Number(output.getAttribute("height"));
          const expectedWidth = (config.width! + 20) * scale;
          const expectedHeight = (config.height! + 20) * scale;
          expect(width).toBeCloseTo(
            output instanceof HTMLCanvasElement
              ? Math.round(expectedWidth)
              : expectedWidth,
          );
          expect(height).toBeCloseTo(
            output instanceof HTMLCanvasElement
              ? Math.round(expectedHeight)
              : expectedHeight,
          );
          expect(Math.abs(width - height * ratio)).toBeLessThanOrEqual(1);
        }
      }
      expect(JSON.stringify(elements)).toBe(original);
    },
  );

  it("accounts for the export padding when sizing the output", () => {
    const elements = [
      API.createElement({ type: "rectangle", width: 300, height: 150 }),
    ];
    expect(getExportSizeForAspectRatio(elements, 1, 32)).toEqual({
      width: 300,
      height: 300,
      fit: "none",
      position: "center",
    });
  });

  it("uses frame bounds rather than the bounds of clipped children", () => {
    const frame = API.createElement({ type: "frame", width: 300, height: 150 });
    const child = API.createElement({
      type: "rectangle",
      frameId: frame.id,
      width: 1000,
      height: 1000,
    });
    expect(getExportSizeForAspectRatio([frame, child], 1)).toEqual(
      getExportSizeForAspectRatio([frame], 1),
    );
  });

  it("keeps original dimensions when no ratio is selected", () => {
    expect(
      getExportSizeForAspectRatio(
        [API.createElement({ type: "rectangle" })],
        null,
      ),
    ).toEqual({});
    expect(getExportSizeForAspectRatio([], 1)).toEqual({});
  });
});

describe("aspect-ratio export dialog", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
    vi.spyOn(blob, "canvasToBlob").mockResolvedValue(new Blob());
  });
  afterEach(() => vi.restoreAllMocks());

  const openDialog = async () => {
    await render(<Excalidraw />);
    act(() => {
      API.setElements([
        API.createElement({ type: "rectangle", width: 300, height: 150 }),
      ]);
      h.setState({ openDialog: { name: "imageExport" } });
    });
    return screen.getByLabelText(t("imageExportDialog.label.aspectRatio"));
  };

  it.each(ratios)(
    "uses ratio %s for the preview and all export actions",
    async (ratio) => {
      const save = vi.spyOn(data, "exportCanvas").mockResolvedValue(undefined);
      const select = await openDialog();
      fireEvent.change(select, { target: { value: String(ratio) } });
      await waitFor(() => {
        const canvas = document.querySelector(
          ".ImageExportModal__preview__canvas canvas",
        ) as HTMLCanvasElement;
        expect(canvas).not.toBeNull();
        expect(
          Math.abs(canvas.width - canvas.height * ratio),
        ).toBeLessThanOrEqual(1);
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
        await waitFor(() =>
          expect(save).toHaveBeenLastCalledWith(
            type,
            expect.any(Array),
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ exportAspectRatio: ratio }),
          ),
        );
      }
    },
  );

  it("restores the original proportions when Original is selected", async () => {
    const select = await openDialog();
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.change(select, { target: { value: "original" } });
    await waitFor(() => {
      const canvas = document.querySelector(
        ".ImageExportModal__preview__canvas canvas",
      ) as HTMLCanvasElement;
      expect(canvas?.width).toBe(320);
      expect(canvas?.height).toBe(170);
    });
  });

  it("recomputes the export region when switching between the selection and the scene", async () => {
    const save = vi.spyOn(data, "exportCanvas").mockResolvedValue(undefined);
    await render(<Excalidraw />);
    act(() => {
      const selected = API.createElement({
        type: "rectangle",
        width: 300,
        height: 150,
      });
      API.setElements([
        selected,
        API.createElement({
          type: "rectangle",
          x: 1000,
          width: 300,
          height: 150,
        }),
      ]);
      API.setSelectedElements([selected]);
      h.setState({ openDialog: { name: "imageExport" } });
    });
    fireEvent.change(
      screen.getByLabelText(t("imageExportDialog.label.aspectRatio")),
      { target: { value: "1" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: t("imageExportDialog.title.exportToPng"),
      }),
    );
    await waitFor(() => expect(save.mock.lastCall?.[1]).toHaveLength(1));
    fireEvent.click(
      screen.getByLabelText(t("imageExportDialog.label.onlySelected")),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: t("imageExportDialog.title.exportToPng"),
      }),
    );
    await waitFor(() => expect(save.mock.lastCall?.[1]).toHaveLength(2));
    expect(save.mock.lastCall?.[4]).toMatchObject({ exportAspectRatio: 1 });
  });

  it("keeps a selected frame's dimensions", async () => {
    await render(<Excalidraw />);
    act(() => {
      const frame = API.createElement({
        type: "frame",
        width: 300,
        height: 150,
      });
      API.setElements([frame]);
      API.setSelectedElements([frame]);
      h.setState({ openDialog: { name: "imageExport" } });
    });
    expect(
      screen.queryByLabelText(t("imageExportDialog.label.aspectRatio")),
    ).toBeNull();
    await waitFor(() => {
      const canvas = document.querySelector(
        ".ImageExportModal__preview__canvas canvas",
      ) as HTMLCanvasElement;
      expect(canvas?.width).toBe(300);
      expect(canvas?.height).toBe(150);
    });
  });
});

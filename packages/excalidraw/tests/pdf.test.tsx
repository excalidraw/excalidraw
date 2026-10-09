import { MIME_TYPES, randomId, reseed } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import * as pdfModule from "../data/pdf";
import { createPasteEvent } from "../clipboard";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { mockHTMLImageElement } from "./helpers/mocks";
import { Keyboard, UI } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

import type { PdfDocument, PdfPageSize } from "../data/pdf";

const { h } = window;

const A4 = { width: 794, height: 1123 };
const LANDSCAPE = { width: 1123, height: 794 };

describe("layoutPdfPages", () => {
  it("lays pages out side by side, top-aligned and centered", () => {
    const positions = pdfModule.layoutPdfPages(
      [[A4, LANDSCAPE, A4]],
      { x: 0, y: 0 },
      { gap: 10 },
    );

    const totalWidth = A4.width * 2 + LANDSCAPE.width + 20;
    const left = -totalWidth / 2;
    const top = -A4.height / 2;

    expect(positions).toEqual([
      { x: left, y: top },
      { x: left + A4.width + 10, y: top },
      { x: left + A4.width + LANDSCAPE.width + 20, y: top },
    ]);
  });

  it("wraps pages onto new rows", () => {
    const pages = Array.from({ length: 5 }, () => A4);
    const positions = pdfModule.layoutPdfPages(
      [pages],
      { x: 0, y: 0 },
      {
        gap: 10,
        pagesPerRow: 2,
      },
    );

    const left = -(A4.width * 2 + 10) / 2;
    const top = -(A4.height * 3 + 20) / 2;
    const col2 = left + A4.width + 10;
    const row = (index: number) => top + (A4.height + 10) * index;

    expect(positions).toEqual([
      { x: left, y: row(0) },
      { x: col2, y: row(0) },
      { x: left, y: row(1) },
      { x: col2, y: row(1) },
      { x: left, y: row(2) },
    ]);
  });

  it("starts each document on a new row", () => {
    const positions = pdfModule.layoutPdfPages(
      [[A4], [A4, A4]],
      { x: 0, y: 0 },
      { gap: 10 },
    );

    const top = -(A4.height * 2 + 10) / 2;
    expect(positions.map(({ y }) => y)).toEqual([
      top,
      top + A4.height + 10,
      top + A4.height + 10,
    ]);
    expect(positions[0].x).toBe(positions[1].x);
  });

  it("handles no pages", () => {
    expect(pdfModule.layoutPdfPages([], { x: 0, y: 0 })).toEqual([]);
    expect(pdfModule.layoutPdfPages([[]], { x: 0, y: 0 })).toEqual([]);
  });
});

describe("isPdfFile", () => {
  it("detects PDFs by MIME type, or by extension when type is missing", () => {
    expect(
      pdfModule.isPdfFile(new File([], "doc.pdf", { type: MIME_TYPES.pdf })),
    ).toBe(true);
    expect(pdfModule.isPdfFile(new File([], "doc.PDF"))).toBe(true);
    expect(
      pdfModule.isPdfFile(new File([], "doc.pdf", { type: MIME_TYPES.png })),
    ).toBe(false);
    expect(pdfModule.isPdfFile(new File([], "doc.txt"))).toBe(false);
    expect(pdfModule.isPdfFile(null)).toBe(false);
  });
});

describe("PDF import", () => {
  const pdfFile = new File([new Uint8Array([1, 2, 3])], "doc.pdf", {
    type: MIME_TYPES.pdf,
  });

  const mockPdf = (pages: PdfPageSize[]) => {
    const destroy = vi.fn(() => Promise.resolve());
    const renderPage = vi.fn(
      async (pageIndex: number) =>
        new File([`page-${pageIndex}`], `page-${pageIndex + 1}.png`, {
          type: MIME_TYPES.png,
        }),
    );
    const pdf: PdfDocument = { pages, renderPage, destroy };
    const openPdfSpy = vi.spyOn(pdfModule, "openPdf");
    openPdfSpy.mockResolvedValue(pdf);

    return { openPdfSpy, renderPage, destroy };
  };

  const assertPagesImported = async (pages: PdfPageSize[]) => {
    await waitFor(() => {
      expect(h.elements).toHaveLength(pages.length);
      for (const element of h.elements) {
        expect(element).toEqual(
          expect.objectContaining({
            type: "image",
            fileId: expect.any(String),
          }),
        );
      }
    });

    // pages keep their size, laid out next to each other
    h.elements.forEach((element, index) => {
      expect(element.width).toBeCloseTo(pages[index].width);
      expect(element.height).toBeCloseTo(pages[index].height);
      expect(element.y).toBeCloseTo(h.elements[0].y);
      if (index > 0) {
        const prev = h.elements[index - 1];
        expect(element.x).toBeCloseTo(
          prev.x + prev.width + pdfModule.PDF_PAGE_GAP,
        );
      }
    });

    expect(h.state.selectedElementIds).toEqual(
      Object.fromEntries(h.elements.map((el) => [el.id, true])),
    );
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    reseed(7);

    vi.spyOn(blobModule, "generateIdFromFile").mockImplementation(() =>
      Promise.resolve(randomId() as FileId),
    );
    vi.spyOn(blobModule, "resizeImageFile").mockImplementation((file: File) =>
      Promise.resolve(file),
    );

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });

    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    mockHTMLImageElement(1000, 1000);
  });

  it("imports dropped PDF pages side by side as a single undoable step", async () => {
    const pages = [A4, LANDSCAPE, A4];
    const { openPdfSpy, renderPage, destroy } = mockPdf(pages);

    await API.drop([{ kind: "file", file: pdfFile }]);

    await assertPagesImported(pages);
    expect(openPdfSpy).toHaveBeenCalledTimes(1);
    expect(renderPage).toHaveBeenCalledTimes(pages.length);
    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    expect(Object.keys(h.app.files)).toHaveLength(pages.length);

    expect(API.getUndoStack().length).toBe(1);
    Keyboard.undo();
    expect(h.elements.every((el) => el.isDeleted)).toBe(true);
    Keyboard.redo();
    expect(h.elements.every((el) => !el.isDeleted && el.fileId)).toBe(true);
  });

  it("imports pasted PDF", async () => {
    const pages = [A4, A4];
    mockPdf(pages);

    document.dispatchEvent(createPasteEvent({ files: [pdfFile] }));

    await assertPagesImported(pages);
  });

  it("imports PDF through the toolbar", async () => {
    const pages = [LANDSCAPE];
    mockPdf(pages);
    const fileOpenSpy = vi
      .spyOn(filesystemModule, "fileOpen")
      .mockResolvedValue([pdfFile]);

    fireEvent.click(
      document.querySelector(".App-toolbar__extra-tools-trigger")!,
    );
    UI.clickOnTestId("toolbar-pdf");

    await assertPagesImported(pages);
    expect(fileOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ extensions: ["pdf"] }),
    );
  });

  it("imports PDF through the image tool", async () => {
    const pages = [A4, A4];
    mockPdf(pages);
    vi.spyOn(filesystemModule, "fileOpen").mockResolvedValue([pdfFile]);

    UI.clickExtraTool("image");

    await assertPagesImported(pages);
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("imports at most PDF_MAX_PAGES pages", async () => {
    const pages = Array.from({ length: pdfModule.PDF_MAX_PAGES + 2 }, () => A4);
    const { renderPage } = mockPdf(pages);

    await API.drop([{ kind: "file", file: pdfFile }]);

    await waitFor(() => {
      expect(h.elements).toHaveLength(pdfModule.PDF_MAX_PAGES);
      expect(h.elements.every((el) => el.type === "image" && el.fileId)).toBe(
        true,
      );
    });
    expect(renderPage).toHaveBeenCalledTimes(pdfModule.PDF_MAX_PAGES);
    expect(h.state.toast?.message).toMatch(String(pdfModule.PDF_MAX_PAGES));
  });

  it("removes pages that failed to render", async () => {
    const pages = [A4, A4];
    const { renderPage } = mockPdf(pages);
    renderPage.mockRejectedValueOnce(new Error("render failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await API.drop([{ kind: "file", file: pdfFile }]);

    await waitFor(() => {
      expect(h.elements.filter((el) => !el.isDeleted)).toEqual([
        expect.objectContaining({ type: "image", fileId: expect.any(String) }),
      ]);
    });
    expect(h.state.errorMessage).toBe("render failed");
  });

  it("shows an error for password-protected PDFs", async () => {
    const error = Object.assign(new Error("No password given"), {
      name: "PasswordException",
    });
    vi.spyOn(pdfModule, "openPdf").mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await API.drop([{ kind: "file", file: pdfFile }]);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(
        "Password-protected PDFs aren't supported.",
      );
    });
    expect(h.elements).toHaveLength(0);
  });
});

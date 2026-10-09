import { MIME_TYPES } from "@excalidraw/common";

import { WorkerInTheMainChunkError, WorkerUrlNotDefinedError } from "../errors";

import { blobToArrayBuffer, canvasToBlob } from "./blob";

import type { PDFDocumentLoadingTask, PDFWorker } from "pdfjs-dist";

/** PDF points (1/72 in) to CSS pixels (1/96 in) */
const PDF_TO_CSS_UNITS = 96 / 72;

/**
 * Pages are rasterized at up to this multiple of their scene size so they stay
 * crisp when zoomed in (still capped by `imageOptions.maxWidthOrHeight`).
 */
const PDF_RENDER_SCALE = 2;

/**
 * Pages are encoded as PNG (lossless, small for text-heavy pages). If the PNG
 * exceeds this size (scans, photos...) we fall back to JPEG when smaller.
 */
const PDF_PAGE_PNG_MAX_SIZE = 512 * 1024;
const PDF_PAGE_JPEG_QUALITY = 0.92;

/** max number of pages imported from a single PDF */
export const PDF_MAX_PAGES = 50;
/** pages per row before wrapping onto the next one */
export const PDF_PAGES_PER_ROW = 10;
/** gap between pages, in scene units */
export const PDF_PAGE_GAP = 40;

/** page size in scene units (CSS pixels at 100% zoom) */
export type PdfPageSize = { width: number; height: number };

export type PdfDocument = {
  pages: readonly PdfPageSize[];
  /** rasterizes the page (0-based) into an image file */
  renderPage: (
    pageIndex: number,
    opts: { maxWidthOrHeight: number; ownerDocument: Document },
  ) => Promise<File>;
  destroy: () => Promise<void>;
};

export const isPdfFile = (file: Blob | null | undefined): file is File => {
  if (!file) {
    return false;
  }
  if (file.type) {
    return file.type === MIME_TYPES.pdf;
  }
  return /\.pdf$/i.test((file as File).name ?? "");
};

// -----------------------------------------------------------------------------
// layout
// -----------------------------------------------------------------------------

/**
 * Lays the pages of one or more documents out side by side, left to right,
 * wrapping onto a new row every `pagesPerRow` pages. Each document starts on
 * a new row. Pages in a row are top-aligned, and the whole block is centered
 * around `center`.
 *
 * @returns top-left scene coords of each page, flattened in document order
 */
export const layoutPdfPages = (
  documents: readonly (readonly PdfPageSize[])[],
  center: { x: number; y: number },
  {
    gap = PDF_PAGE_GAP,
    pagesPerRow = PDF_PAGES_PER_ROW,
  }: { gap?: number; pagesPerRow?: number } = {},
): { x: number; y: number }[] => {
  const rows: PdfPageSize[][] = [];
  for (const pages of documents) {
    for (let i = 0; i < pages.length; i += pagesPerRow) {
      rows.push(pages.slice(i, i + pagesPerRow));
    }
  }

  if (!rows.length) {
    return [];
  }

  const rowWidths = rows.map(
    (row) =>
      row.reduce((width, page) => width + page.width, 0) +
      gap * (row.length - 1),
  );
  const rowHeights = rows.map((row) =>
    Math.max(...row.map((page) => page.height)),
  );

  const totalWidth = Math.max(...rowWidths);
  const totalHeight =
    rowHeights.reduce((height, rowHeight) => height + rowHeight, 0) +
    gap * (rows.length - 1);

  const originX = center.x - totalWidth / 2;
  let y = center.y - totalHeight / 2;

  const positions: { x: number; y: number }[] = [];
  rows.forEach((row, rowIndex) => {
    let x = originX;
    for (const page of row) {
      positions.push({ x, y });
      x += page.width + gap;
    }
    y += rowHeights[rowIndex] + gap;
  });

  return positions;
};

// -----------------------------------------------------------------------------
// pdf.js loading
// -----------------------------------------------------------------------------

// using the legacy build, as the modern one only targets the latest browsers
let pdfjsPromise: Promise<
  typeof import("pdfjs-dist/legacy/build/pdf.mjs")
> | null = null;

const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").catch((error) => {
      // allow retrying (e.g. chunk failed to load due to network issues)
      pdfjsPromise = null;
      throw error;
    });
  }
  return pdfjsPromise;
};

/**
 * Spawns a dedicated pdf.js worker, resolved once it signals it's ready.
 *
 * @throws if the worker can't be spawned, in which case pdf.js falls back
 *  to parsing on the main thread
 */
const spawnPdfWorker = async (): Promise<Worker> => {
  // also registers the main thread fallback (see the chunk for details)
  const { WorkerUrl } = await import("./pdf-worker.chunk");

  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are not supported");
  }
  if (!WorkerUrl) {
    throw new WorkerUrlNotDefinedError();
  }
  if (!import.meta.url || WorkerUrl.toString() === import.meta.url) {
    throw new WorkerInTheMainChunkError();
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(WorkerUrl, { type: "module" });

    const onMessage = () => {
      cleanup();
      resolve(worker);
    };
    const onError = (event: ErrorEvent) => {
      cleanup();
      worker.terminate();
      reject(new Error(`Failed to spawn PDF worker: ${event.message}`));
    };
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    // the first message is pdf.js's "ready" handshake
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
  });
};

const encodePage = async (canvas: HTMLCanvasElement) => {
  const png = await canvasToBlob(canvas);
  if (png.size <= PDF_PAGE_PNG_MAX_SIZE) {
    return png;
  }
  const jpeg = await canvasToBlob(
    canvas,
    MIME_TYPES.jpg,
    PDF_PAGE_JPEG_QUALITY,
  );
  return jpeg.size < png.size ? jpeg : png;
};

/**
 * Opens a PDF file using pdf.js (lazy-loaded). Caller is responsible for
 * calling `destroy()` once done.
 *
 * @throws pdf.js errors (e.g. `PasswordException`, `InvalidPDFException`)
 */
export const openPdf = async (file: Blob): Promise<PdfDocument> => {
  const pdfjs = await loadPdfjs();

  let worker: Worker | null = null;
  try {
    worker = await spawnPdfWorker();
  } catch (error: any) {
    console.warn(
      "Failed to spawn PDF worker, falling back to the main thread.",
      error,
    );
  }
  const pdfWorker: PDFWorker | undefined = worker
    ? pdfjs.PDFWorker.create({ port: worker })
    : undefined;

  // optional resources pdf.js fetches only when a PDF needs them (CJK cmaps,
  // non-embedded standard fonts, JPEG 2000/JBIG2 decoders, ICC profiles)
  const resourcesUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;

  let loadingTask: PDFDocumentLoadingTask | null = null;

  const destroy = async () => {
    try {
      await loadingTask?.destroy();
    } finally {
      pdfWorker?.destroy();
      worker?.terminate();
    }
  };

  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await blobToArrayBuffer(file)),
      worker: pdfWorker,
      // PDFs are untrusted input
      isEvalSupported: false,
      enableXfa: false,
      cMapUrl: `${resourcesUrl}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${resourcesUrl}/standard_fonts/`,
      wasmUrl: `${resourcesUrl}/wasm/`,
      iccUrl: `${resourcesUrl}/iccs/`,
    });

    const pdf = await loadingTask.promise;

    const pages: PdfPageSize[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { width, height } = page.getViewport({ scale: PDF_TO_CSS_UNITS });
      pages.push({ width, height });
    }

    const renderPage: PdfDocument["renderPage"] = async (
      pageIndex,
      { maxWidthOrHeight, ownerDocument },
    ) => {
      const page = await pdf.getPage(pageIndex + 1);
      const canvas = ownerDocument.createElement("canvas");
      try {
        const { width, height } = pages[pageIndex];
        const scale =
          PDF_TO_CSS_UNITS *
          Math.min(
            PDF_RENDER_SCALE,
            maxWidthOrHeight / Math.max(width, height),
          );
        const viewport = page.getViewport({ scale });

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        await page.render({ canvas, viewport }).promise;

        const blob = await encodePage(canvas);
        const extension = blob.type === MIME_TYPES.jpg ? "jpg" : "png";

        return new File([blob], `page-${pageIndex + 1}.${extension}`, {
          type: blob.type,
        });
      } finally {
        // free the canvas memory early (esp. Safari is strict about it)
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    };

    return { pages, renderPage, destroy };
  } catch (error: any) {
    await destroy().catch((destroyError) => console.warn(destroyError));
    throw error;
  }
};

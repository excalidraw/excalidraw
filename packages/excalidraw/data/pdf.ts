import { MIME_TYPES } from "@excalidraw/common";
import * as pdfjsLib from "pdfjs-dist";

// Configure the worker to use the bundled version
// Using a data URL to avoid CDN issues
(async () => {
    const workerUrl = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
    ).href;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
})();

/**
 * Renders specific pages of a PDF file to images (Files).
 */
export const renderPDFToImages = async (
    file: File,
    pages: number[],
    scale: number = 2, // Higher scale for better quality
): Promise<File[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const renderedFiles: File[] = [];

    for (const pageNum of pages) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Could not get 2d context for PDF rendering");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), MIME_TYPES.png),
        );

        if (blob) {
            renderedFiles.push(
                new File([blob], `${file.name}-page-${pageNum}.png`, {
                    type: MIME_TYPES.png,
                }),
            );
        }
    }

    return renderedFiles;
};

/**
 * Returns the total number of pages in a PDF.
 */
export const getPDFPageCount = async (file: File): Promise<number> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
};

/**
 * Generates an array of page thumbnails for selection.
 */
export const renderPDFThumbnails = async (
    file: File,
    maxPages: number = 100,
    scale: number = 0.5
): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const thumbnails: string[] = [];

    const numPages = Math.min(pdf.numPages, maxPages);

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            thumbnails.push(canvas.toDataURL(MIME_TYPES.png));
        }
    }

    return thumbnails;
};

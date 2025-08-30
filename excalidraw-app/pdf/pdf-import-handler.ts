import { useCallback } from "react";
import { fileOpen } from "browser-fs-access";
import { MIME_TYPES } from "@excalidraw/common";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * PDF import handler return type
 */
interface PDFImportHandlers {
  importPdfFile: () => Promise<void>;
}

/**
 * PDF import handler for file dialog import functionality.
 * Creates a simulated drop event to trigger the global PDF drop handler
 * for consistent processing behavior.
 */
export const usePDFImportHandler = (excalidrawAPI: ExcalidrawImperativeAPI | null): PDFImportHandlers => {
  const importPdfFile = useCallback(async (): Promise<void> => {
    try {
      const file = await fileOpen({
        description: "PDF files",
        extensions: [".pdf"],
      });

      if (file && excalidrawAPI) {
        // Simulate a drop event to trigger the global handler
        const fakeDropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
        });

        // Add the file to the dataTransfer
        Object.defineProperty(fakeDropEvent, 'dataTransfer', {
          value: {
            files: [file],
          }
        });

        // Add client coordinates for positioning
        Object.defineProperty(fakeDropEvent, 'clientX', { value: 400 });
        Object.defineProperty(fakeDropEvent, 'clientY', { value: 300 });

        // Dispatch the event to trigger global handler
        document.dispatchEvent(fakeDropEvent);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("PDF import error:", error);
        excalidrawAPI?.setToast({
          message: `Failed to import PDF: ${error.message}`,
          duration: 5000
        });
      }
    }
  }, [excalidrawAPI]);

  return { importPdfFile };
};
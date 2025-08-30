import { useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { usePDFInitialization } from "../pdf/pdf-initialization.js";
import { usePDFDropHandler } from "../pdf/pdf-drop-handler.js";
import { usePDFImportHandler } from "../pdf/pdf-import-handler.js";

/**
 * PDF handlers interface for the return value
 */
interface PDFHandlers {
  importPdfFile: () => Promise<void>;
}

/**
 * Comprehensive PDF handlers hook that combines all PDF functionality
 * into a single, easy-to-use interface for App.tsx.
 * 
 * This approach minimizes changes to App.tsx and makes future upstream
 * merges much cleaner since all PDF logic is self-contained.
 */
export const usePDFHandlers = (excalidrawAPI: ExcalidrawImperativeAPI | null): PDFHandlers => {
  // Initialize PDF.js
  usePDFInitialization();
  
  // Set up global drop handler
  usePDFDropHandler(excalidrawAPI);
  
  // Get PDF import functionality
  const { importPdfFile } = usePDFImportHandler(excalidrawAPI);
  
  return {
    importPdfFile
  };
};
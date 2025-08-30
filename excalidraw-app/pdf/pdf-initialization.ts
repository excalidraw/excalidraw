import { useEffect } from "react";
import { initializePDFJS } from "./pdf-processor.js";

/**
 * PDF.js initialization hook.
 * Ensures PDF.js is properly configured when the component mounts.
 */
export const usePDFInitialization = (): void => {
  useEffect(() => {
    initializePDFJS();
  }, []);
};
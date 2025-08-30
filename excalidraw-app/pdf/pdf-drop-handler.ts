import { useEffect } from "react";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, DataURL } from "@excalidraw/excalidraw/types";
import { newImageElement } from "@excalidraw/element";
import { generateIdFromFile } from "@excalidraw/excalidraw/data/blob";
import { processPDFFile } from "./pdf-processor.js";
import { storePDFFile, getPDFFile } from "./pdf-storage.js";
import type { PDFPageResult } from './types/pdf.types.js';

/**
 * Global PDF drop handler that intercepts PDF files at document level
 * before they reach Excalidraw's built-in drop handler.
 * This prevents the "Couldn't load invalid file" error while maintaining
 * full PDF processing functionality.
 */
export const usePDFDropHandler = (excalidrawAPI: ExcalidrawImperativeAPI | null): void => {
  useEffect(() => {
    const handleGlobalDrop = async (e: DragEvent): Promise<void> => {
      if (!e.dataTransfer?.files || !excalidrawAPI) return;

      const files = Array.from(e.dataTransfer.files);
      const pdfFiles = files.filter(file => file.type === "application/pdf");

      if (pdfFiles.length > 0) {
        // Process PDF files here and prevent Excalidraw from seeing them
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Calculate drop position
        const appState = excalidrawAPI.getAppState();
        const position = viewportCoordsToSceneCoords(
          { clientX: e.clientX, clientY: e.clientY },
          appState
        );

        // Process each PDF file
        for (const pdfFile of pdfFiles) {
          try {
            // Show loading state
            excalidrawAPI.setToast({ message: "Processing PDF...", duration: 2000 });

            // Generate stable file ID based on content hash for reference only
            const originalFileId = await generateIdFromFile(pdfFile);

            // Store original PDF in our separate IndexedDB storage
            await storePDFFile(originalFileId, pdfFile);

            // Process PDF using the new pdf-utils.js library
            const result = await processPDFFile(pdfFile, position, 1.0);
            const firstPage = result.thumbnails[0];

            // Convert blob to data URL
            const reader = new FileReader();
            const dataURL = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(firstPage.blob);
            });

            // Generate stable thumbnail file ID
            const thumbnailFile = new File([firstPage.blob], `page-${firstPage.page}.jpg`, { type: 'image/jpeg' });
            const thumbnailFileId = await generateIdFromFile(thumbnailFile);

            // Get existing files to check if thumbnail already exists
            const existingFiles = excalidrawAPI.getFiles();

            // Add thumbnail file to system if not exists
            if (!existingFiles[thumbnailFileId]) {
              excalidrawAPI.addFiles([{
                id: thumbnailFileId,
                dataURL: dataURL as DataURL,
                mimeType: "image/jpeg",
                created: Date.now(),
                lastRetrieved: Date.now(),
              }]);
            }

            // Calculate final position
            const x = position?.x ?? 100;
            const y = position?.y ?? 100;

            // Create image element with PDF custom data
            const element = newImageElement({
              type: "image",
              x, y,
              width: firstPage.width,
              height: firstPage.height,
              fileId: thumbnailFileId,
              status: "saved",
              customData: {
                pdf: {
                  originalFileId,
                  page: 1,
                  pageCount: result.pageCount,
                }
              }
            });

            // Add element to scene
            excalidrawAPI.updateScene({
              elements: [...excalidrawAPI.getSceneElements(), element],
            });

            // Prefetch next page for faster navigation
            if (result.pageCount > 1) {
              try {
                const originalFile = await getPDFFile(originalFileId);
                if (originalFile && window.extractPDFDocumentPages) {
                  const arrayBuffer = await originalFile.arrayBuffer();
                  const pdfData = new Uint8Array(arrayBuffer);
                  const pages = await window.extractPDFDocumentPages!(pdfData, 1.0);
                  const pageResult = pages[1]; // Page 2 (0-based index)

                  if (pageResult) {
                    // Convert page result to blob like in pdf-processor.ts
                    const pageBlob = new Blob([pageResult.Bytes], { type: 'image/jpeg' });

                    const reader = new FileReader();
                    const pageDataURL = await new Promise<string>((resolve, reject) => {
                      reader.onload = () => resolve(reader.result as string);
                      reader.onerror = reject;
                      reader.readAsDataURL(pageBlob);
                    });

                    const pageFile = new File([pageBlob], `page-2.jpg`, { type: 'image/jpeg' });
                    const pageFileId = await generateIdFromFile(pageFile);

                    if (!excalidrawAPI.getFiles()[pageFileId]) {
                      excalidrawAPI.addFiles([{
                        id: pageFileId,
                        dataURL: pageDataURL as DataURL,
                        mimeType: "image/jpeg",
                        created: Date.now(),
                        lastRetrieved: Date.now(),
                      }]);
                    }
                  }
                }
              } catch (error) {
                console.warn('Prefetch failed:', error);
              }
            }

            excalidrawAPI.setToast({ message: `PDF imported (${result.pageCount} pages)`, duration: 3000 });

          } catch (error) {
            console.error('PDF processing failed:', error);
            excalidrawAPI.setToast({
              message: `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              duration: 5000
            });
          }
        }
      }
    };

    // Add capture listener to intercept before React handlers
    document.addEventListener('drop', handleGlobalDrop, true);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop, true);
    };
  }, [excalidrawAPI]);
};
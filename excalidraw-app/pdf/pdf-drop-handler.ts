import { useEffect } from "react";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, DataURL } from "@excalidraw/excalidraw/types";
import { newImageElement } from "@excalidraw/element";
import { generateIdFromFile } from "@excalidraw/excalidraw/data/blob";
import { processPDFFile } from "./pdf-processor.js";
import { storePDFFile, getPDFFile } from "./pdf-storage.js";
import { hashFile, createChunks, buildIngestPayload } from "./rag-utils.js";
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

            // RAG ingestion (non-blocking)
            try {
              await ingestPDFForRAG(pdfFile, originalFileId, excalidrawAPI);
            } catch (ragError) {
              console.warn('RAG ingestion failed (non-blocking):', ragError);
              // Don't show error toast for RAG failures to keep UX smooth
            }

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

/**
 * Ingest PDF for RAG system (non-blocking background process)
 */
async function ingestPDFForRAG(
  pdfFile: File, 
  originalFileId: string, 
  excalidrawAPI: ExcalidrawImperativeAPI
): Promise<void> {
  // Check if RAG indexing is enabled (privacy setting)
  const ragIndexingEnabled = localStorage.getItem('excalidraw-rag-indexing') !== 'false';
  if (!ragIndexingEnabled) {
    console.log('PDF RAG indexing disabled by user preference');
    return;
  }

  // Resolve LLM service URL safely in browser environment
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LLM_SERVICE_URL)
    ? import.meta.env.VITE_LLM_SERVICE_URL
    : undefined;
  const globalUrl = window.__EXCALIDRAW_LLM_SERVICE_URL;
  const storedUrl = (localStorage.getItem('excalidraw-llm-url') || undefined) as string | undefined;
  const defaultUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
  const LLM_SERVICE_URL = globalUrl || envUrl || storedUrl || defaultUrl;
  
  try {
    // Show indexing start toast
    excalidrawAPI.setToast({ 
      message: 'Indexing PDF for semantic search...', 
      duration: 2000 
    });

    // Generate stable source hash
    const sourceHash = await hashFile(pdfFile);
    
    // Extract text from PDF
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);
    
    if (!window.extractPDFText) {
      throw new Error('PDF text extraction not available');
    }
    
    const pagesText = await window.extractPDFText(pdfData);
    
    // Skip if no text extracted
    if (pagesText.length === 0 || pagesText.every(p => !p.text.trim())) {
      console.log('No text content found in PDF, skipping RAG indexing');
      return;
    }
    
    // Create chunks
    const chunks = createChunks(pagesText, 1000, 0.15);
    
    if (chunks.length === 0) {
      console.log('No chunks created from PDF text, skipping RAG indexing');
      return;
    }
    
    // Build ingestion payload
    const payload = buildIngestPayload(pdfFile.name, sourceHash, chunks);
    
    // Ingest document
    const ingestResponse = await fetch(`${LLM_SERVICE_URL}/api/rag/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!ingestResponse.ok) {
      throw new Error(`Ingestion failed: ${ingestResponse.status} ${ingestResponse.statusText}`);
    }
    
    const ingestResult = await ingestResponse.json();
    const documentId = ingestResult?.document?.id;
    
    if (!documentId) {
      throw new Error('No document ID returned from ingestion');
    }
    
    // Update element with RAG metadata
    const elements = excalidrawAPI.getSceneElements();
    const pdfElement = elements.find(el => 
      el.type === 'image' && 
      el.customData?.pdf?.originalFileId === originalFileId
    );
    
    if (pdfElement) {
      const updatedElement = {
        ...pdfElement,
        customData: {
          ...pdfElement.customData,
          pdf: {
            ...pdfElement.customData?.pdf,
            documentId,
            sourceHash,
            indexingStatus: 'ingesting'
          }
        }
      };
      
      excalidrawAPI.updateScene({
        elements: elements.map(el => el.id === pdfElement.id ? updatedElement : el)
      });
    }
    
    // Trigger embedding generation (fire-and-forget)
    fetch(`${LLM_SERVICE_URL}/api/rag/embed-missing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId })
    }).catch(error => {
      console.warn('Embedding generation failed:', error);
    });
    
    console.log(`PDF "${pdfFile.name}" indexed for RAG: ${chunks.length} chunks, document ID: ${documentId}`);
    
  } catch (error) {
    console.warn('PDF RAG ingestion failed:', error);
    excalidrawAPI.setToast({ 
      message: 'PDF indexing failed (non-blocking)', 
      duration: 2500 
    });
  }
}
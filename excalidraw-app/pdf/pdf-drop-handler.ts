import { useEffect } from "react";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, DataURL } from "@excalidraw/excalidraw/types";
import { newImageElement } from "@excalidraw/element";
import { generateNKeysBetween } from "fractional-indexing";
import { generateIdFromFile } from "@excalidraw/excalidraw/data/blob";
import { processPDFFile } from "./pdf-processor.js";
import { storePDFFile, getPDFFile } from "./pdf-storage.js";
import { hashFile, createChunks, buildIngestPayload } from "./rag-utils.js";
import type { PDFPageResult } from './types/pdf.types.js';
import { useAuthShell } from "../auth-shell/index";
import type { AuthShellContextValue } from "../auth-shell/AuthShellContext";

/**
 * Global PDF drop handler that intercepts PDF files at document level
 * before they reach Excalidraw's built-in drop handler.
 * This prevents the "Couldn't load invalid file" error while maintaining
 * full PDF processing functionality.
 */
export const usePDFDropHandler = (excalidrawAPI: ExcalidrawImperativeAPI | null): void => {
  const authShell = useAuthShell();

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

            // Ensure the new element has a valid fractional index before adding
            try {
              const current = excalidrawAPI.getSceneElements();
              const lastIndex = current.length > 0 ? (current[current.length - 1] as any).index ?? null : null;
              const [nextIndex] = generateNKeysBetween(lastIndex, null, 1);
              (element as any).index = nextIndex;
              excalidrawAPI.updateScene({ elements: [...current, element] });
            } catch {
              // Fallback: append without manual index (engine will attempt to repair)
              excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements(), element] });
            }

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
              await ingestPDFForRAG(pdfFile, originalFileId, excalidrawAPI, authShell);
            } catch (ragError) {
              console.warn('RAG ingestion failed (non-blocking):', ragError);
              // Don't show error toast for RAG failures to keep UX smooth
            }

            // Check existing document status after drop (non-blocking)
            if (authShell?.getToken) {
              try {
                const statusToken = await authShell.getToken();
                if (statusToken) {
          await checkExistingDocumentStatus(originalFileId, excalidrawAPI, statusToken);
        }
      } catch (statusError) {
        console.warn('Document status check failed (non-blocking):', statusError);
      }
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
  excalidrawAPI: ExcalidrawImperativeAPI,
  authShell: AuthShellContextValue | null
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
  const globalUrl = (window as any).__EXCALIDRAW_LLM_SERVICE_URL;
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
    
  // Get auth token
  const token = authShell?.getToken ? await authShell.getToken() : null;
  if (!token) {
    console.warn('PDF RAG indexing requires authentication');
    excalidrawAPI.setToast({
      message: 'Please sign in to enable PDF search indexing',
      duration: 4000
      });
      return;
    }

    // Ingest document
    const ingestResponse = await fetch(`${LLM_SERVICE_URL}/v1/rag/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (ingestResponse.status === 401) {
      console.warn('PDF RAG indexing requires authentication');
      excalidrawAPI.setToast({
        message: 'Please sign in to enable PDF search indexing',
        duration: 4000
      });
      return;
    }

    if (!ingestResponse.ok) {
      throw new Error(`Ingestion failed: ${ingestResponse.status} ${ingestResponse.statusText}`);
    }
    
    const ingestResult = await ingestResponse.json();
    // Support both legacy { document: { id } } and new { document_id }
    const documentId: string | undefined =
      (ingestResult && ingestResult.document && ingestResult.document.id)
        ? ingestResult.document.id
        : ingestResult?.document_id;
    
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
      const bump = (el: any) => ({
        ...el,
        version: (el.version ?? 0) + 1,
        versionNonce: typeof el.versionNonce === 'number' ? el.versionNonce + 1 : Math.floor(Math.random() * 2 ** 31),
      });
      const updatedElement = bump({
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
      });
      
      excalidrawAPI.updateScene({
        elements: elements.map(el => el.id === pdfElement.id ? updatedElement : el)
      });
    }
    
    // Start embedding job and track progress
    try {
      const embedResponse = await fetch(`${LLM_SERVICE_URL}/v1/rag/embed-missing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentId })
      });
      
      if (embedResponse.ok) {
        const { jobId, total, batchSize, accessToken } = await embedResponse.json();
        
        // Handle no-op case when no chunks need embedding
        if (jobId === null || total === 0) {
          console.log(`No embedding needed for document ${documentId} (already complete)`);
          
          // Explicitly update element status from 'ingesting' to 'embedded'
          const currentElements = excalidrawAPI.getSceneElements();
          const noOpPdfElement = currentElements.find(el => 
            el.type === 'image' && 
            el.customData?.pdf?.originalFileId === originalFileId
          );
          
          if (noOpPdfElement) {
            const bump = (el: any) => ({
              ...el,
              version: (el.version ?? 0) + 1,
              versionNonce: typeof el.versionNonce === 'number' ? el.versionNonce + 1 : Math.floor(Math.random() * 2 ** 31),
            });
            const noOpUpdatedElement = bump({
              ...noOpPdfElement,
              customData: {
                ...noOpPdfElement.customData,
                pdf: {
                  ...noOpPdfElement.customData?.pdf,
                  indexingStatus: 'embedded' as const
                }
              }
            });
            
            excalidrawAPI.updateScene({
              elements: currentElements.map(el => el.id === noOpPdfElement.id ? noOpUpdatedElement : el)
            });
          }
          
          excalidrawAPI.setToast({
            message: 'PDF already indexed for search',
            duration: 2000
          });
          return;
        }
        
        // Update element with job tracking info
        const currentElements = excalidrawAPI.getSceneElements();
        const currentPdfElement = currentElements.find(el => 
          el.type === 'image' && 
          el.customData?.pdf?.originalFileId === originalFileId
        );
        
        if (currentPdfElement && jobId) {
          const bump = (el: any) => ({
            ...el,
            version: (el.version ?? 0) + 1,
            versionNonce: typeof el.versionNonce === 'number' ? el.versionNonce + 1 : Math.floor(Math.random() * 2 ** 31),
          });
          const jobUpdatedElement = bump({
            ...currentPdfElement,
            customData: {
              ...currentPdfElement.customData,
              pdf: {
                ...currentPdfElement.customData?.pdf,
                indexingJobId: jobId,
                indexingStatus: 'running' as const
              }
            }
          });
          
          excalidrawAPI.updateScene({
            elements: currentElements.map(el => el.id === currentPdfElement.id ? jobUpdatedElement : el)
          });
          
          // Start progress tracking (SSE preferred, polling fallback)
          startEmbeddingProgressTracking(jobId, originalFileId, excalidrawAPI, LLM_SERVICE_URL, accessToken, token);
          
          // Show progress toast with cancellation info
          excalidrawAPI.setToast({
            message: `PDF indexing started (${total} chunks) - Check console for progress`,
            duration: 4000
          });
          
          console.log(`Started embedding job ${jobId} for document ${documentId} (${total} chunks)`);
          console.log(`To cancel: cancelEmbeddingJob_${jobId}()`);
        }
      } else {
        throw new Error(`Embedding job failed: ${embedResponse.status}`);
      }
    } catch (error) {
      console.warn('Embedding job start failed:', error);
      
      // Update status to failed
      const currentElements = excalidrawAPI.getSceneElements();
      const failedPdfElement = currentElements.find(el => 
        el.type === 'image' && 
        el.customData?.pdf?.originalFileId === originalFileId
      );
      
      if (failedPdfElement) {
        const failedUpdatedElement = {
          ...failedPdfElement,
          customData: {
            ...failedPdfElement.customData,
            pdf: {
              ...failedPdfElement.customData?.pdf,
              indexingStatus: 'failed' as const
            }
          }
        };
        
        excalidrawAPI.updateScene({
          elements: currentElements.map(el => el.id === failedPdfElement.id ? failedUpdatedElement : el)
        });
      }
    }
    
    console.log(`PDF "${pdfFile.name}" indexed for RAG: ${chunks.length} chunks, document ID: ${documentId}`);
    
  } catch (error) {
    console.warn('PDF RAG ingestion failed:', error);
    excalidrawAPI.setToast({ 
      message: 'PDF indexing failed (non-blocking)', 
      duration: 2500 
    });
  }
}

/**
 * Start embedding progress tracking using SSE if available, fallback to polling
 */
function startEmbeddingProgressTracking(
  jobId: string,
  originalFileId: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
  llmServiceUrl: string,
  accessToken?: string,
  authToken?: string
): void {
  // Try SSE first, fallback to polling if it fails
  const useSSE = typeof EventSource !== 'undefined';
  
  if (useSSE && accessToken) {
    startEmbeddingSSETracking(jobId, originalFileId, excalidrawAPI, llmServiceUrl, accessToken, authToken);
  } else {
    console.log(`EventSource not available, using polling for job ${jobId}`);
    startEmbeddingJobPolling(jobId, originalFileId, excalidrawAPI, llmServiceUrl);
  }
}

/**
 * Track embedding job progress via Server-Sent Events
 */
function startEmbeddingSSETracking(
  jobId: string,
  originalFileId: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
  llmServiceUrl: string,
  accessToken: string,
  authToken?: string
): void {
  let cancelled = false;

  // Create cancellation function
  const cancelFunction = async () => {
    if (cancelled) return;
    cancelled = true;

    try {
      const cancelResponse = await fetch(`${llmServiceUrl}/v1/rag/embed-jobs/${jobId}`, {
        method: 'DELETE',
        headers: authToken
          ? { 'Authorization': `Bearer ${authToken}` }
          : undefined
      });
      
      if (cancelResponse.ok) {
        console.log(`Embedding job ${jobId} cancelled successfully`);
        updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
        excalidrawAPI.setToast({
          message: 'PDF indexing cancelled',
          duration: 2000
        });
      } else {
        console.warn(`Failed to cancel job ${jobId}:`, cancelResponse.status);
      }
    } catch (error) {
      console.warn(`Error cancelling job ${jobId}:`, error);
    }
  };
  
  // Store cancel function globally for manual access
  if (typeof window !== 'undefined') {
    (window as any)[`cancelEmbeddingJob_${jobId}`] = cancelFunction;
  }
  
  // Create EventSource for SSE with access token
  const eventSource = new EventSource(`${llmServiceUrl}/v1/rag/embed-events/${jobId}?access_token=${accessToken}`);
  
  eventSource.onopen = () => {
    console.log(`SSE connected for job ${jobId}`);
  };
  
  eventSource.addEventListener('status', (event) => {
    if (cancelled) return;
    
    try {
      const data = JSON.parse(event.data);
      const { status, embedded, failed, total, progress } = data;
      
      // Show progress updates
      console.log(`Embedding progress: ${progress}% (${embedded + failed}/${total}) - Cancel: cancelEmbeddingJob_${jobId}()`);
      
      // Handle completion
      if (status === 'done') {
        console.log(`Embedding job ${jobId} completed: ${embedded}/${total} chunks embedded`);
        updatePdfElementStatus(originalFileId, 'embedded', excalidrawAPI);
        excalidrawAPI.setToast({
          message: `PDF indexing complete (${embedded}/${total} chunks)`,
          duration: 3000
        });
        cleanup();
        
      } else if (status === 'error' || status === 'cancelled') {
        console.warn(`Embedding job ${jobId} ${status}:`, data.lastError);
        updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
        
        // Show error toast (unless we cancelled it ourselves)
        if (!cancelled) {
          // Create user-friendly error message
          let errorMessage = `PDF indexing ${status}`;
          if (data.lastError) {
            // Check for provider-specific errors and show appropriate message
            if (data.lastError.includes('region') || data.lastError.includes('not available')) {
              errorMessage = '⚠️ Embeddings not available in your region. Please configure a different provider.';
            } else if (data.lastError.includes('unauthorized') || data.lastError.includes('API key')) {
              errorMessage = '🔑 Invalid API key. Please check your embeddings provider configuration.';
            } else if (data.lastError.includes('provider') || data.lastError.includes('configuration')) {
              errorMessage = '⚙️ Embeddings provider error. Please check your configuration.';
            } else {
              errorMessage = `PDF indexing ${status}: ${data.lastError}`;
            }
          }
          
          excalidrawAPI.setToast({
            message: errorMessage,
            duration: 6000 // Longer duration for error messages
          });
        }
        cleanup();
      }
    } catch (error) {
      console.warn('Error parsing SSE status event:', error);
    }
  });
  
  eventSource.addEventListener('done', (event) => {
    if (cancelled) return;
    
    try {
      const data = JSON.parse(event.data);
      console.log(`SSE: Job ${jobId} finished with status: ${data.status}`);
    } catch (error) {
      console.warn('Error parsing SSE done event:', error);
    }
    cleanup();
  });
  
  eventSource.addEventListener('error', (event) => {
    console.warn(`SSE error for job ${jobId}:`, event);
    
    // If SSE fails, fallback to polling
    console.log(`SSE failed for job ${jobId}, falling back to polling`);
    cleanup();
    
    if (!cancelled) {
      startEmbeddingJobPolling(jobId, originalFileId, excalidrawAPI, llmServiceUrl);
    }
  });
  
  eventSource.onerror = (error) => {
    console.warn(`SSE connection error for job ${jobId}:`, error);
    
    // Fallback to polling on connection errors
    console.log(`SSE connection failed for job ${jobId}, falling back to polling`);
    cleanup();
    
    if (!cancelled) {
      startEmbeddingJobPolling(jobId, originalFileId, excalidrawAPI, llmServiceUrl);
    }
  };
  
  const cleanup = () => {
    eventSource.close();
    if (typeof window !== 'undefined') {
      delete (window as any)[`cancelEmbeddingJob_${jobId}`];
    }
  };
}

/**
 * Poll embedding job status and update PDF element UI state (fallback method)
 */
function startEmbeddingJobPolling(
  jobId: string,
  originalFileId: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
  llmServiceUrl: string
): void {
  let pollCount = 0;
  const maxPolls = 150; // 5 minutes max (150 * 2s)
  let cancelled = false;
  
  // Create cancellation function and store it globally for manual cancellation
  const cancelFunction = async () => {
    if (cancelled) return;
    cancelled = true;
    
    try {
      const cancelResponse = await fetch(`${llmServiceUrl}/v1/rag/embed-jobs/${jobId}`, {
        method: 'DELETE'
      });
      
      if (cancelResponse.ok) {
        console.log(`Embedding job ${jobId} cancelled successfully`);
        updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
        excalidrawAPI.setToast({
          message: 'PDF indexing cancelled',
          duration: 2000
        });
      } else {
        console.warn(`Failed to cancel job ${jobId}:`, cancelResponse.status);
      }
    } catch (error) {
      console.warn(`Error cancelling job ${jobId}:`, error);
    }
  };
  
  // Store cancel function globally for debugging/manual access
  if (typeof window !== 'undefined') {
    (window as any)[`cancelEmbeddingJob_${jobId}`] = cancelFunction;
  }
  
  const poll = async () => {
    if (cancelled) return;
    try {
      pollCount++;
      
      const response = await fetch(`${llmServiceUrl}/v1/rag/embed-status/${jobId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Job ${jobId} not found or expired`);
          updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
          return;
        }
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const { job } = await response.json();
      const { status, embedded, total, failed, lastError } = job;
      
      // Calculate progress percentage
      const progress = total > 0 ? Math.round(((embedded + failed) / total) * 100) : 0;
      
      if (status === 'done') {
        console.log(`Embedding job ${jobId} completed: ${embedded}/${total} chunks embedded`);
        updatePdfElementStatus(originalFileId, 'embedded', excalidrawAPI);
        
        // Show success toast
        excalidrawAPI.setToast({
          message: `PDF indexing complete (${embedded}/${total} chunks)`,
          duration: 3000
        });
        
        // Cleanup cancel function
        if (typeof window !== 'undefined') {
          delete (window as any)[`cancelEmbeddingJob_${jobId}`];
        }
        
      } else if (status === 'error' || status === 'cancelled') {
        console.warn(`Embedding job ${jobId} ${status}:`, lastError);
        updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
        
        // Show error toast (unless we cancelled it ourselves)
        if (!cancelled) {
          // Create user-friendly error message
          let errorMessage = `PDF indexing ${status}`;
          if (lastError) {
            if (lastError.includes('region') || lastError.includes('not available')) {
              errorMessage = '⚠️ Embeddings not available in your region. Please configure a different provider.';
            } else if (lastError.includes('unauthorized') || lastError.includes('API key')) {
              errorMessage = '🔑 Invalid API key. Please check your embeddings provider configuration.';
            } else if (lastError.includes('provider') || lastError.includes('configuration')) {
              errorMessage = '⚙️ Embeddings provider error. Please check your configuration.';
            } else {
              errorMessage = `PDF indexing ${status}: ${lastError}`;
            }
          }
          
          excalidrawAPI.setToast({
            message: errorMessage,
            duration: 6000 // Longer duration for error messages
          });
        }
        
        // Cleanup cancel function
        if (typeof window !== 'undefined') {
          delete (window as any)[`cancelEmbeddingJob_${jobId}`];
        }
        
      } else if (status === 'running') {
        // Still running, schedule next poll
        if (pollCount < maxPolls) {
          setTimeout(poll, 2000); // Poll every 2 seconds
          
          // Show progress in console with cancellation instructions
          if (pollCount % 5 === 0) { // Every 10 seconds
            console.log(`Embedding progress: ${progress}% (${embedded + failed}/${total}) - Cancel: cancelEmbeddingJob_${jobId}()`);
          }
        } else {
          console.warn(`Embedding job ${jobId} polling timeout after ${maxPolls} attempts`);
          updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
          
          // Cleanup cancel function on timeout
          if (typeof window !== 'undefined') {
            delete (window as any)[`cancelEmbeddingJob_${jobId}`];
          }
        }
      }
      
    } catch (error) {
      console.warn(`Embedding job polling error:`, error);
      
      // Retry a few times before giving up
      if (pollCount < 5) {
        setTimeout(poll, 3000); // Retry with longer delay
      } else {
        updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
        
        // Cleanup cancel function on final error
        if (typeof window !== 'undefined') {
          delete (window as any)[`cancelEmbeddingJob_${jobId}`];
        }
      }
    }
  };
  
  // Start polling after initial delay
  setTimeout(poll, 1000);
}

/**
 * Check existing document embedding status and offer resume options
 */
async function checkExistingDocumentStatus(
  originalFileId: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
  token: string
): Promise<void> {
  // Find PDF element to get document ID
  const elements = excalidrawAPI.getSceneElements();
  const pdfElement = elements.find(el => 
    el.type === 'image' && 
    el.customData?.pdf?.originalFileId === originalFileId
  );
  
  if (!pdfElement?.customData?.pdf?.documentId) {
    return; // No document ID available
  }
  
  const documentId = pdfElement.customData.pdf.documentId;
  
  // Resolve LLM service URL
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LLM_SERVICE_URL)
    ? import.meta.env.VITE_LLM_SERVICE_URL
    : undefined;
  const globalUrl = (window as any).__EXCALIDRAW_LLM_SERVICE_URL;
  const storedUrl = (localStorage.getItem('excalidraw-llm-url') || undefined) as string | undefined;
  const defaultUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
  const LLM_SERVICE_URL = globalUrl || envUrl || storedUrl || defaultUrl;
  
  try {
    // Check document status
    const statusResponse = await fetch(`${LLM_SERVICE_URL}/v1/rag/doc/${documentId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        console.log(`Document ${documentId} not found in RAG system`);
        return;
      }
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }
    
    const status = await statusResponse.json();
    const { chunks, embedded, embeddingPending, progress, isComplete, title } = status;
    
    console.log(`Document "${title}" status: ${embedded}/${chunks} chunks embedded (${progress}%)`);
    
    // Update element status based on completion
    if (isComplete) {
      updatePdfElementStatus(originalFileId, 'embedded', excalidrawAPI);
      console.log(`✅ Document "${title}" is fully embedded and ready for search`);
    } else if (embedded > 0) {
      // Partially embedded - offer resume option
      updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI); // Use 'failed' to show incomplete state
      
      console.log(`⚠️ Document "${title}" is partially embedded (${embedded}/${chunks})`);
      console.log(`🔄 To resume embedding: resumeDocumentEmbedding_${documentId}()`);
      
      // Create resume function
      const resumeFunction = async () => {
        try {
          const embedResponse = await fetch(`${LLM_SERVICE_URL}/v1/rag/embed-missing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ documentId })
          });
          
          if (embedResponse.ok) {
            const { jobId, total, accessToken } = await embedResponse.json();
            
            if (jobId === null || total === 0) {
              console.log('✅ No additional embedding needed - document is complete');
              updatePdfElementStatus(originalFileId, 'embedded', excalidrawAPI);
              return;
            }
            
            console.log(`🚀 Resumed embedding for "${title}" - Job: ${jobId} (${total} remaining chunks)`);
            
            // Update element to show running status
            updatePdfElementStatus(originalFileId, 'running', excalidrawAPI);
            
            // Start progress tracking
            startEmbeddingProgressTracking(jobId, originalFileId, excalidrawAPI, LLM_SERVICE_URL, accessToken, token);
            
            excalidrawAPI.setToast({
              message: `Resumed PDF indexing (${total} chunks remaining)`,
              duration: 3000
            });
          } else {
            throw new Error(`Resume failed: ${embedResponse.status}`);
          }
        } catch (error) {
          console.error('Failed to resume embedding:', error);
          excalidrawAPI.setToast({
            message: 'Failed to resume PDF indexing',
            duration: 3000
          });
        }
      };
      
      // Store resume function globally
      if (typeof window !== 'undefined') {
        (window as any)[`resumeDocumentEmbedding_${documentId}`] = resumeFunction;
      }
      
    } else {
      // No embeddings yet - document exists but not embedded
      updatePdfElementStatus(originalFileId, 'failed', excalidrawAPI);
      console.log(`📄 Document "${title}" exists but has no embeddings (${chunks} chunks pending)`);
    }
    
  } catch (error) {
    console.warn('Document status check failed:', error);
  }
}

/**
 * Update PDF element indexing status in the scene
 */
function updatePdfElementStatus(
  originalFileId: string,
  status: 'running' | 'embedded' | 'failed',
  excalidrawAPI: ExcalidrawImperativeAPI
): void {
  const elements = excalidrawAPI.getSceneElements();
  const pdfElement = elements.find(el => 
    el.type === 'image' && 
    el.customData?.pdf?.originalFileId === originalFileId
  );
  
  if (pdfElement) {
    const prevPdf = (pdfElement as any).customData?.pdf || {};
    // For terminal states, drop indexingJobId from metadata
    const nextPdf = (() => {
      if (status === 'running') {
        return { ...prevPdf, indexingStatus: status } as const;
      }
      const { indexingJobId, ...rest } = prevPdf as any; // omit jobId on done/failed
      return { ...rest, indexingStatus: status } as const;
    })();
    const bump = (el: any) => ({
      ...el,
      version: (el.version ?? 0) + 1,
      versionNonce: typeof el.versionNonce === 'number' ? el.versionNonce + 1 : Math.floor(Math.random() * 2 ** 31),
    });
    const updatedElement = bump({
      ...pdfElement,
      customData: {
        ...pdfElement.customData,
        pdf: nextPdf
      }
    });
    
    excalidrawAPI.updateScene({
      elements: elements.map(el => el.id === pdfElement.id ? updatedElement : el)
    });
  }
}

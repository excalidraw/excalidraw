import { useCallback } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { RAGFocusDetail } from '../types/rag.types';
import type { ChatCitation } from '../lib/chat/types';
import { isDev } from '../lib/chat/config';

export interface UseCitationFocusProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const useCitationFocus = ({ excalidrawAPI }: UseCitationFocusProps) => {
  const focusCitation = useCallback(async (citation: ChatCitation) => {
    const detail: RAGFocusDetail = {
      documentId: citation.documentId,
      chunkId: citation.chunkId,
      page: citation.page,
      chunk_index: citation.chunk_index
    };

    try {
      const { documentId, page } = detail;
      if (isDev()) console.log('RAG citation focus requested:', detail);

      // Get current scene elements
      const elements = excalidrawAPI.getSceneElements();

      // Find all PDF elements with matching documentId and prefer the topmost (last in array)
      const matches = elements.filter((el: any) =>
        el.type === 'image' && el.customData?.pdf?.documentId === documentId
      );
      const pdfElement = matches.length > 0 ? matches[matches.length - 1] : null;

      if (!pdfElement) {
        excalidrawAPI.setToast({
          message: 'Document not found on canvas',
          closable: true,
          duration: 3000
        });
        if (isDev()) {
          console.warn('PDF document not found on canvas:', documentId, 'matches=', matches.length);
        }
        return;
      }

      // Center viewport on the element and select it
      const elementCenter = {
        x: pdfElement.x + pdfElement.width / 2,
        y: pdfElement.y + pdfElement.height / 2
      };
      const appState = excalidrawAPI.getAppState();
      const containerWidth = (appState as any)?.width || window.innerWidth;
      const containerHeight = (appState as any)?.height || window.innerHeight;
      const newAppState = {
        ...appState,
        scrollX: -elementCenter.x + (containerWidth / 2) / (appState.zoom?.value || 1),
        scrollY: -elementCenter.y + (containerHeight / 2) / (appState.zoom?.value || 1),
        selectedElementIds: { [pdfElement.id]: true } as const
      };
      excalidrawAPI.updateScene({ appState: newAppState });

      // Switch to target page if specified and different
      if (page && pdfElement.customData?.pdf?.page !== page) {
        const { navigatePDFPage } = await import('../pdf/pdf-navigation-handler');
        await navigatePDFPage(excalidrawAPI, pdfElement, page);
      }

      if (isDev()) console.log('RAG citation focus completed successfully');
    } catch (error) {
      const message = error instanceof Error && /Thumbnail not found/i.test(error.message)
        ? 'Thumbnails missing for this PDF. Reopen/import the PDF to reindex.'
        : 'Failed to focus citation';
      excalidrawAPI.setToast({ message, closable: true, duration: 3000 });
      if (isDev()) console.error('Error focusing RAG citation:', error);
    }
  }, [excalidrawAPI]);

  return { focusCitation };
};
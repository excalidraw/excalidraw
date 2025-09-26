import { useCallback } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  getThumbnailEnabled,
  getMaxThumbnailDim,
  getThumbnailQuality,
  getMaxThumbnailBytes,
  isDev
} from '../lib/chat/config';
import { generateSimpleHash } from '../lib/chat/hash';

export interface UseSnapshotsProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  isVisible?: boolean;
}

export interface SnapshotsResult {
  fullCanvas?: string;
  selection?: string;
  thumbnail?: string;
  thumbnailHash?: string;
}

export interface UseSnapshotsResult {
  generateSnapshots: (needsSnapshot?: boolean) => Promise<SnapshotsResult>;
}

export const useSnapshots = ({
  excalidrawAPI,
  isVisible = true
}: UseSnapshotsProps): UseSnapshotsResult => {

  const generateSnapshots = useCallback(async (needsSnapshot?: boolean): Promise<SnapshotsResult> => {
    let snapshots: SnapshotsResult = {};

    try {
      const elements = excalidrawAPI.getSceneElements();
      const refreshedAppState = excalidrawAPI.getAppState();

      // Generate thumbnail for preattach (if enabled and elements exist)
      const thumbnailEnabled = getThumbnailEnabled();
      const maxThumbnailDim = getMaxThumbnailDim();
      const thumbnailQuality = getThumbnailQuality();
      const maxThumbnailBytes = getMaxThumbnailBytes();

      if (thumbnailEnabled && isVisible && elements.length > 0) {
        try {
          const thumbnailCanvas = await exportToCanvas({
            elements: elements,
            appState: {
              ...refreshedAppState,
              exportBackground: true,
              viewBackgroundColor: refreshedAppState.viewBackgroundColor,
            },
            files: excalidrawAPI.getFiles(),
            maxWidthOrHeight: maxThumbnailDim,
          });

          const thumbnailDataURL = thumbnailCanvas.toDataURL('image/jpeg', thumbnailQuality);

          // Check size limit
          const thumbnailSizeBytes = Math.round((thumbnailDataURL.length - 'data:image/jpeg;base64,'.length) * 0.75);

          if (thumbnailSizeBytes <= maxThumbnailBytes) {
            snapshots.thumbnail = thumbnailDataURL;

            // Generate simple hash for deduplication
            const base64Data = thumbnailDataURL.split(',')[1];
            snapshots.thumbnailHash = await generateSimpleHash(base64Data);

            if (isDev()) {
              console.log(`Generated thumbnail: ${(thumbnailSizeBytes/1000).toFixed(1)}KB, hash: ${snapshots.thumbnailHash}`);
            }
          } else if (isDev()) {
            console.warn(`Thumbnail too large: ${(thumbnailSizeBytes/1000).toFixed(1)}KB > ${(maxThumbnailBytes/1000).toFixed(1)}KB limit`);
          }
        } catch (thumbnailError) {
          if (isDev()) console.warn('Failed to generate thumbnail:', thumbnailError);
        }
      }

      // Generate full canvas snapshot (only if needed or if we have elements)
      if (needsSnapshot !== false && elements.length > 0) {
        const canvas = await exportToCanvas({
          elements: elements,
          appState: {
            ...refreshedAppState,
            exportBackground: true,
            viewBackgroundColor: refreshedAppState.viewBackgroundColor,
          },
          files: excalidrawAPI.getFiles(),
          maxWidthOrHeight: 1200,
        });

        const canvasDataURL = canvas.toDataURL('image/png', 0.8);
        snapshots.fullCanvas = canvasDataURL;

        // Generate selection snapshot if elements are selected
        if (Object.keys(refreshedAppState.selectedElementIds).length > 0) {
          const selectedElements = elements.filter(el => refreshedAppState.selectedElementIds[el.id]);
          if (selectedElements.length > 0) {
            const selectionCanvas = await exportToCanvas({
              elements: selectedElements,
              appState: {
                ...refreshedAppState,
                exportBackground: false,
                viewBackgroundColor: 'transparent',
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: 800,
            });

            const selectionDataURL = selectionCanvas.toDataURL('image/png', 0.8);
            snapshots.selection = selectionDataURL;
          }
        }
      }
    } catch (snapshotError) {
      console.warn('Failed to generate snapshots:', snapshotError);
      // Continue without snapshots
    }

    return snapshots;
  }, [excalidrawAPI, isVisible]);

  return {
    generateSnapshots
  };
};
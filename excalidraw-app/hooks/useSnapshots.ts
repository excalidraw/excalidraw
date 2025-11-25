import { useCallback, useRef } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types';
import rough from 'roughjs/bin/rough';
import { renderStaticScene } from '../../packages/excalidraw/renderer/staticScene';
import { arrayToMap, toBrandedType } from '@excalidraw/common';
import { syncInvalidIndices, getInitializedImageElements } from '@excalidraw/element';
import type { NonDeletedExcalidrawElement, NonDeletedSceneElementsMap } from '@excalidraw/element/types';
import { updateImageCache } from '@excalidraw/element';
import { getDefaultAppState } from '../../packages/excalidraw/appState';
import type { RenderableElementsMap } from '../../packages/excalidraw/scene/types';
import {
  getThumbnailEnabled,
  getMaxThumbnailDim,
  getThumbnailQuality,
  getMaxThumbnailBytes,
  getFullCanvasMaxDim,
  getFullCanvasQuality,
  getFullCanvasMaxBytes,
  getSelectionMaxDim,
  getSelectionQuality,
  getSelectionMaxBytes,
  getMaxViewportDim,
  getViewportQuality,
  getMaxViewportBytes,
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
  thumbnailHashStatus?: 'new' | 'unchanged' | 'skipped';
  viewport?: {
    dataUrl?: string;
    hash?: string;
    capturedAt?: string;
    width?: number;
    height?: number;
    bounds?: { x: number; y: number; width: number; height: number; zoom?: number };
  };
  viewportHash?: string;
  viewportCapturedAt?: string;
  viewportHashStatus?: 'new' | 'unchanged' | 'skipped';
}

export interface UseSnapshotsResult {
  generateSnapshots: (needsSnapshot?: boolean) => Promise<SnapshotsResult>;
}

export const useSnapshots = ({
  excalidrawAPI,
  isVisible = true
}: UseSnapshotsProps): UseSnapshotsResult => {
  // Refs to store previous hashes for deduplication
  const previousThumbnailHashRef = useRef<string | undefined>(undefined);
  const previousViewportHashRef = useRef<string | undefined>(undefined);

  const estimateDataUrlBytes = (dataUrl: string): number => {
    const commaIndex = dataUrl.indexOf(',');
    const raw = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
    return Math.round((raw.length * 3) / 4 - (raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0));
  };

  const encodeSnapshot = async (
    canvas: HTMLCanvasElement,
    {
      mimeType,
      quality,
      maxBytes,
      computeHash,
      label
    }: { mimeType: string; quality?: number; maxBytes?: number; computeHash?: boolean; label: string }
  ) => {
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const byteSize = estimateDataUrlBytes(dataUrl);

    if (maxBytes && byteSize > maxBytes) {
      if (isDev()) {
        console.warn(
          `${label} snapshot skipped: ${(byteSize / 1000).toFixed(1)}KB exceeds ${(maxBytes / 1000).toFixed(1)}KB limit`
        );
      }
      return null;
    }

    const base64Data = dataUrl.split(',')[1];
    const hash = computeHash && base64Data ? await generateSimpleHash(base64Data) : undefined;

    return { dataUrl, hash, byteSize };
  };

  const captureViewportSnapshot = async (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: ReturnType<ExcalidrawImperativeAPI['getAppState']>,
    files: ReturnType<ExcalidrawImperativeAPI['getFiles']>
  ): Promise<SnapshotsResult['viewport'] | null> => {
    const viewportWidth = appState.width;
    const viewportHeight = appState.height;

    if (!viewportWidth || !viewportHeight) return null;

    const maxDim = getMaxViewportDim();
    const baseScale = Math.min(1, maxDim / Math.max(viewportWidth, viewportHeight));
    const renderScale = baseScale * (appState.exportScale || 1);

    const canvasWidth = Math.max(1, Math.round(viewportWidth * renderScale));
    const canvasHeight = Math.max(1, Math.round(viewportHeight * renderScale));
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const { imageCache } = await updateImageCache({
      imageCache: new Map(),
      fileIds: getInitializedImageElements(elements).map((element) => element.fileId),
      files,
    });

    const renderAppState = {
      ...getDefaultAppState(),
      ...appState,
      width: viewportWidth,
      height: viewportHeight,
      zoom: { ...appState.zoom },
      shouldCacheIgnoreZoom: false,
    };

    renderStaticScene({
      canvas,
      rc: rough.canvas(canvas),
      elementsMap: toBrandedType<RenderableElementsMap>(arrayToMap(elements)),
      allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
        arrayToMap(syncInvalidIndices(elements))
      ),
      visibleElements: elements,
      scale: renderScale,
      appState: renderAppState,
      renderConfig: {
        canvasBackgroundColor: appState.viewBackgroundColor,
        imageCache,
        renderGrid: false,
        isExporting: true,
        embedsValidationStatus: new Map(),
        elementsPendingErasure: new Set(),
        pendingFlowchartNodes: null,
      },
    });

    const dataUrl = canvas.toDataURL('image/jpeg', getViewportQuality());
    const byteSize = estimateDataUrlBytes(dataUrl);
    const maxBytes = getMaxViewportBytes();
    if (byteSize > maxBytes) {
      if (isDev()) {
        console.warn(
          `Viewport snapshot skipped: ${(byteSize / 1000).toFixed(1)}KB exceeds ${(maxBytes / 1000).toFixed(1)}KB limit`
        );
      }
      return null;
    }

    const base64Data = dataUrl.split(',')[1];
    const hash = base64Data ? await generateSimpleHash(base64Data) : undefined;
    const capturedAt = new Date().toISOString();

    return {
      dataUrl,
      hash,
      capturedAt,
      width: Math.round(viewportWidth),
      height: Math.round(viewportHeight),
      bounds: {
        x: -appState.scrollX,
        y: -appState.scrollY,
        width: viewportWidth / appState.zoom.value,
        height: viewportHeight / appState.zoom.value,
        zoom: appState.zoom.value
      }
    };
  };

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

          const encodedThumbnail = await encodeSnapshot(thumbnailCanvas, {
            mimeType: 'image/jpeg',
            quality: thumbnailQuality,
            maxBytes: maxThumbnailBytes,
            computeHash: true,
            label: 'Thumbnail'
          });

          if (encodedThumbnail && encodedThumbnail.hash) {
            const currentHash = encodedThumbnail.hash;
            const previousHash = previousThumbnailHashRef.current;

            // Compare hash with previous to determine if unchanged
            if (previousHash && currentHash === previousHash) {
              // Hash unchanged - only send hash, not dataUrl
              snapshots.thumbnailHash = currentHash;
              snapshots.thumbnailHashStatus = 'unchanged';
              if (isDev()) {
                console.log(`Thumbnail hash unchanged: ${currentHash} (skipping dataUrl)`);
              }
            } else {
              // Hash changed or first time - send both hash and dataUrl
              snapshots.thumbnail = encodedThumbnail.dataUrl;
              snapshots.thumbnailHash = currentHash;
              snapshots.thumbnailHashStatus = 'new';
              previousThumbnailHashRef.current = currentHash;

              if (isDev()) {
                console.log(
                  `Generated thumbnail: ${(encodedThumbnail.byteSize / 1000).toFixed(1)}KB, hash: ${currentHash}`
                );
              }
            }
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
          maxWidthOrHeight: getFullCanvasMaxDim(),
        });

        const encodedFull = await encodeSnapshot(canvas, {
          mimeType: 'image/jpeg',
          quality: getFullCanvasQuality(),
          maxBytes: getFullCanvasMaxBytes(),
          computeHash: false,
          label: 'Full canvas'
        });

        if (encodedFull?.dataUrl) {
          snapshots.fullCanvas = encodedFull.dataUrl;
        }

        // Generate selection snapshot if elements are selected
        if (Object.keys(refreshedAppState.selectedElementIds).length > 0) {
          const selectedElements = elements.filter(el => refreshedAppState.selectedElementIds[el.id]);
          if (selectedElements.length > 0) {
            const selectionCanvas = await exportToCanvas({
              elements: selectedElements,
              appState: {
                ...refreshedAppState,
                exportBackground: true,
                viewBackgroundColor: refreshedAppState.viewBackgroundColor || '#ffffff',
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: getSelectionMaxDim(),
            });

            const encodedSelection = await encodeSnapshot(selectionCanvas, {
              mimeType: 'image/jpeg',
              quality: getSelectionQuality(),
              maxBytes: getSelectionMaxBytes(),
              computeHash: false,
              label: 'Selection'
            });

            if (encodedSelection?.dataUrl) {
              snapshots.selection = encodedSelection.dataUrl;
            }
          }
        }
      }

      // Generate viewport snapshot (captures current visible area)
      if (needsSnapshot !== false && elements.length > 0) {
        try {
          const viewportSnapshot = await captureViewportSnapshot(elements, refreshedAppState, excalidrawAPI.getFiles());
          if (viewportSnapshot && viewportSnapshot.hash) {
            const currentHash = viewportSnapshot.hash;
            const previousHash = previousViewportHashRef.current;

            // Compare hash with previous to determine if unchanged
            if (previousHash && currentHash === previousHash) {
              // Hash unchanged - only send hash and metadata, not dataUrl
              snapshots.viewportHash = currentHash;
              snapshots.viewportCapturedAt = viewportSnapshot.capturedAt;
              snapshots.viewportHashStatus = 'unchanged';
              snapshots.viewport = {
                hash: currentHash,
                capturedAt: viewportSnapshot.capturedAt,
                width: viewportSnapshot.width,
                height: viewportSnapshot.height,
                bounds: viewportSnapshot.bounds,
              };
              if (isDev()) {
                console.log(`Viewport hash unchanged: ${currentHash} (skipping dataUrl)`);
              }
            } else {
              // Hash changed or first time - send full snapshot including dataUrl
              snapshots.viewport = viewportSnapshot;
              snapshots.viewportHash = currentHash;
              snapshots.viewportCapturedAt = viewportSnapshot.capturedAt;
              snapshots.viewportHashStatus = 'new';
              previousViewportHashRef.current = currentHash;

              if (isDev()) {
                console.log(`Generated viewport snapshot: hash: ${currentHash}`);
              }
            }
          } else if (viewportSnapshot === null) {
            // Snapshot was skipped (e.g., size limit exceeded)
            snapshots.viewportHashStatus = 'skipped';
            if (isDev()) {
              console.log('Viewport snapshot skipped (size limit exceeded)');
            }
          }
        } catch (viewportError) {
          if (isDev()) console.warn('Failed to generate viewport snapshot:', viewportError);
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

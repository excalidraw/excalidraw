/**
 * TypeScript interfaces for PDF storage and processing system
 */

export interface ThumbnailData {
  page: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface PDFStorageEntry {
  id: string;
  data: ArrayBuffer;
  name: string;
  type: string;
  size: number;
  thumbnails: Record<number, ThumbnailData>;
  pageCount: number;
  created: number;
}

export interface ProcessPDFResult {
  originalFileId: string;
  pageCount: number;
  thumbnails: ThumbnailData[];
}

export interface PDFThumbnailInfo {
  pageCount: number;
  thumbnails: Record<number, {
    width: number;
    height: number;
  }>;
}

export interface PDFProcessingError {
  type: 'PROCESSING_ERROR' | 'STORAGE_ERROR' | 'VALIDATION_ERROR';
  message: string;
  originalError?: Error;
}

export interface PDFProcessingResult<T> {
  success: boolean;
  data?: T;
  error?: PDFProcessingError;
}

export interface PDFStorageAPI {
  storePDFFile: (fileId: string, file: File) => Promise<string>;
  getPDFFile: (fileId: string) => Promise<File | null>;
  hasPDFFile: (fileId: string) => Promise<boolean>;
  deletePDFFile: (fileId: string) => Promise<void>;
  storePDFThumbnails: (originalFileId: string, thumbnails: ThumbnailData[]) => Promise<string>;
  getPDFThumbnail: (originalFileId: string, pageNumber: number) => Promise<Blob | null>;
  getPDFThumbnailInfo: (originalFileId: string) => Promise<PDFThumbnailInfo | null>;
}

export interface PDFProcessorAPI {
  initializePDFJS: () => void;
  processPDFFile: (
    file: File,
    position: { x: number; y: number },
    outputScale?: number
  ) => Promise<ProcessPDFResult>;
  processPDFPage: (
    originalFileId: string,
    pdfData: Uint8Array,
    pageNumber: number,
    outputScale?: number
  ) => Promise<ThumbnailData | null>;
}

export interface NavigationHandlerAPI {
  blobToDataURL: (blob: Blob) => Promise<string>;
  generateFileIdFromBlob: (
    blob: Blob,
    originalFileId: string,
    pageNumber: number
  ) => Promise<string>;
  navigatePDFPage: (
    excalidrawAPI: any,
    element: any,
    targetPage: number
  ) => Promise<boolean>;
  goToPrevPage: (excalidrawAPI: any, element: any) => Promise<boolean | undefined>;
  goToNextPage: (excalidrawAPI: any, element: any) => Promise<boolean | undefined>;
  canNavigate: (element: any, direction: 'prev' | 'next') => boolean;
}

// Window type extensions for PDF.js
export interface PDFPageResult {
  Bytes: Uint8Array;
  Width: number;
  Height: number;
}

declare global {
  interface Window {
    pdfjsLib?: any;
    extractPDFDocumentPages?: (pdfData: Uint8Array, outputScale: number) => Promise<PDFPageResult[]>;
  }
}

export {}; // Make this module
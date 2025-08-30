// PDF-specific storage using IndexedDB
// This is separate from Excalidraw's file system to avoid loading PDF files as images

import type { PDFStorageEntry, ThumbnailData, PDFThumbnailInfo } from './types/pdf.types.js';

const DB_NAME = 'ExcalidrawPDFStorage';
const DB_VERSION = 2;
const STORE_NAME = 'pdfs';

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB for PDF storage
async function initPDFStorage(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('created', 'created', { unique: false });
      }
    };
  });
}

// Store PDF file data
export async function storePDFFile(fileId: string, file: File): Promise<string> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  const arrayBuffer = await file.arrayBuffer();
  
  return new Promise<string>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const pdfData: PDFStorageEntry = {
      id: fileId,
      data: arrayBuffer,
      name: file.name,
      type: file.type,
      size: file.size,
      thumbnails: {}, // Will store page thumbnails as { pageNum: { blob, width, height } }
      pageCount: 0, // Will be updated when thumbnails are stored
      created: Date.now()
    };
    
    const request = store.put(pdfData);
    request.onsuccess = () => resolve(fileId);
    request.onerror = () => reject(request.error);
  });
}

// Retrieve PDF file data
export async function getPDFFile(fileId: string): Promise<File | null> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<File | null>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(fileId);
    request.onsuccess = () => {
      if (request.result) {
        // Convert back to File object
        const pdfData = request.result as PDFStorageEntry;
        const file = new File([pdfData.data], pdfData.name, { type: pdfData.type });
        resolve(file);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Check if PDF file exists
export async function hasPDFFile(fileId: string): Promise<boolean> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<boolean>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.count(fileId);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
}

// Delete PDF file
export async function deletePDFFile(fileId: string): Promise<void> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<void>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(fileId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Store PDF page thumbnails
export async function storePDFThumbnails(originalFileId: string, thumbnails: ThumbnailData[]): Promise<string> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<string>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First get existing PDF data
    const getRequest = store.get(originalFileId);
    getRequest.onsuccess = () => {
      const pdfData = getRequest.result as PDFStorageEntry | undefined;
      if (!pdfData) {
        reject(new Error(`PDF not found: ${originalFileId}`));
        return;
      }
      
      // Convert thumbnails array to object keyed by page number
      const thumbnailsObj: Record<number, ThumbnailData> = {};
      thumbnails.forEach(thumbnail => {
        thumbnailsObj[thumbnail.page] = {
          page: thumbnail.page,
          blob: thumbnail.blob,
          width: thumbnail.width,
          height: thumbnail.height
        };
      });
      
      // Update PDF data with thumbnails
      pdfData.thumbnails = thumbnailsObj;
      pdfData.pageCount = thumbnails.length;
      
      // Store updated data
      const putRequest = store.put(pdfData);
      putRequest.onsuccess = () => resolve(originalFileId);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Retrieve specific page thumbnail
export async function getPDFThumbnail(originalFileId: string, pageNumber: number): Promise<Blob | null> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(originalFileId);
    request.onsuccess = () => {
      const pdfData = request.result as PDFStorageEntry | undefined;
      if (!pdfData || !pdfData.thumbnails || !pdfData.thumbnails[pageNumber]) {
        resolve(null);
        return;
      }
      
      resolve(pdfData.thumbnails[pageNumber].blob);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get all thumbnail data for a PDF (without blobs, just metadata)
export async function getPDFThumbnailInfo(originalFileId: string): Promise<PDFThumbnailInfo | null> {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise<PDFThumbnailInfo | null>((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(originalFileId);
    request.onsuccess = () => {
      const pdfData = request.result as PDFStorageEntry | undefined;
      if (!pdfData) {
        resolve(null);
        return;
      }
      
      const thumbnailInfo: Record<number, { width: number; height: number }> = {};
      Object.keys(pdfData.thumbnails || {}).forEach(pageNum => {
        const pageNumber = parseInt(pageNum, 10);
        thumbnailInfo[pageNumber] = {
          width: pdfData.thumbnails[pageNumber].width,
          height: pdfData.thumbnails[pageNumber].height
        };
      });
      
      resolve({
        pageCount: pdfData.pageCount || 0,
        thumbnails: thumbnailInfo
      });
    };
    request.onerror = () => reject(request.error);
  });
}
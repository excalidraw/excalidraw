// PDF-specific storage using IndexedDB
// This is separate from Excalidraw's file system to avoid loading PDF files as images

const DB_NAME = 'ExcalidrawPDFStorage';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

let dbInstance = null;

// Initialize IndexedDB for PDF storage
async function initPDFStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('created', 'created', { unique: false });
      }
    };
  });
}

// Store PDF file data
export async function storePDFFile(fileId, file) {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  const arrayBuffer = await file.arrayBuffer();
  
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const pdfData = {
      id: fileId,
      data: arrayBuffer,
      name: file.name,
      type: file.type,
      size: file.size,
      created: Date.now()
    };
    
    const request = store.put(pdfData);
    request.onsuccess = () => resolve(fileId);
    request.onerror = () => reject(request.error);
  });
}

// Retrieve PDF file data
export async function getPDFFile(fileId) {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(fileId);
    request.onsuccess = () => {
      if (request.result) {
        // Convert back to File object
        const pdfData = request.result;
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
export async function hasPDFFile(fileId) {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.count(fileId);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
}

// Delete PDF file
export async function deletePDFFile(fileId) {
  if (!dbInstance) {
    await initPDFStorage();
  }
  
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(fileId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
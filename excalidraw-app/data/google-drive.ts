/**
 * Google Drive integration for Excalidraw.
 *
 * Provides save/load functionality for .excalidraw files in Google Drive,
 * enabling cloud storage and seamless editing workflows.
 */

import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { restore } from "@excalidraw/excalidraw/data/restore";

import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

// Google API configuration
// These should be set in environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID || "";
const GOOGLE_API_KEY = import.meta.env.VITE_APP_GOOGLE_API_KEY || "";
const GOOGLE_APP_ID = import.meta.env.VITE_APP_GOOGLE_APP_ID || "";

// OAuth scopes required for Drive file operations
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // Create/edit files created by app
  "https://www.googleapis.com/auth/drive.readonly", // Read files shared with app
].join(" ");

// Discovery docs for Google APIs
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];

// MIME type for Excalidraw files
const EXCALIDRAW_MIME_TYPE = "application/json";
const EXCALIDRAW_EXTENSION = ".excalidraw";

// State management
let gapiLoaded = false;
let gisLoaded = false;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;

// Callback for when auth state changes
type AuthStateCallback = (isSignedIn: boolean) => void;
let authStateCallback: AuthStateCallback | null = null;

/**
 * Check if Google Drive integration is configured
 */
export const isGoogleDriveEnabled = (): boolean => {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);
};

/**
 * Load the Google API client library
 */
const loadGapiClient = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiLoaded) {
      resolve();
      return;
    }

    // Check if gapi is already loaded
    if (typeof gapi !== "undefined") {
      gapi.load("client:picker", async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiLoaded = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      return;
    }

    // Load gapi script
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const gapiInstance = (window as any).gapi;
      gapiInstance.load("client:picker", async () => {
        try {
          await gapiInstance.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiLoaded = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/**
 * Load the Google Identity Services library
 */
const loadGisClient = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gisLoaded) {
      resolve();
      return;
    }

    // Check if google.accounts is already loaded
    if (typeof google !== "undefined" && google.accounts) {
      initTokenClient();
      gisLoaded = true;
      resolve();
      return;
    }

    // Load GIS script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initTokenClient();
      gisLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/**
 * Initialize the OAuth token client
 */
const initTokenClient = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
        if (authStateCallback) {
          authStateCallback(true);
        }
      }
    },
  });
};

/**
 * Initialize Google Drive integration
 */
export const initGoogleDrive = async (): Promise<void> => {
  if (!isGoogleDriveEnabled()) {
    console.warn("Google Drive integration not configured");
    return;
  }

  await Promise.all([loadGapiClient(), loadGisClient()]);
};

/**
 * Set callback for auth state changes
 */
export const setAuthStateCallback = (callback: AuthStateCallback): void => {
  authStateCallback = callback;
};

/**
 * Check if user is signed in to Google
 */
export const isSignedIn = (): boolean => {
  return Boolean(accessToken);
};

/**
 * Sign in to Google
 */
export const signIn = async (): Promise<void> => {
  if (!tokenClient) {
    await initGoogleDrive();
  }

  if (tokenClient) {
    // Request access token
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
};

/**
 * Sign out of Google
 */
export const signOut = (): void => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      if (authStateCallback) {
        authStateCallback(false);
      }
    });
  }
};

/**
 * Get the current user's email
 */
export const getCurrentUserEmail = async (): Promise<string | null> => {
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const data = await response.json();
    return data.email || null;
  } catch (error) {
    console.error("Failed to get user email:", error);
    return null;
  }
};

// Drive file interface
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

/**
 * List Excalidraw files from Google Drive
 */
export const listExcalidrawFiles = async (
  maxResults: number = 50,
): Promise<DriveFile[]> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const query = `name contains '${EXCALIDRAW_EXTENSION}' and trashed = false`;

  const response = await gapi.client.drive.files.list({
    q: query,
    pageSize: maxResults,
    fields:
      "files(id, name, mimeType, webViewLink, webContentLink, modifiedTime, createdTime, size, iconLink, thumbnailLink)",
    orderBy: "modifiedTime desc",
  });

  return response.result.files || [];
};

/**
 * Search for files in Google Drive
 */
export const searchDriveFiles = async (
  searchQuery: string,
  maxResults: number = 50,
): Promise<DriveFile[]> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const query = `name contains '${searchQuery}' and name contains '${EXCALIDRAW_EXTENSION}' and trashed = false`;

  const response = await gapi.client.drive.files.list({
    q: query,
    pageSize: maxResults,
    fields:
      "files(id, name, mimeType, webViewLink, webContentLink, modifiedTime, createdTime, size, iconLink, thumbnailLink)",
    orderBy: "modifiedTime desc",
  });

  return response.result.files || [];
};

/**
 * Load scene from Google Drive
 */
export const loadFromGoogleDrive = async (
  fileId: string,
): Promise<ImportedDataState> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  // Get file content
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to load file: ${response.statusText}`);
  }

  const content = await response.text();
  const data = JSON.parse(content);

  // Restore the scene data
  const restored = restore(
    {
      elements: data.elements,
      appState: data.appState,
      files: data.files,
    },
    null,
    null,
    {
      repairBindings: true,
      deleteInvisibleElements: true,
    },
  );

  return {
    elements: restored.elements,
    appState: restored.appState,
    files: restored.files,
  };
};

/**
 * Save scene to Google Drive
 */
export const saveToGoogleDrive = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  fileId?: string,
  fileName?: string,
): Promise<{ fileId: string; webViewLink: string }> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  // Serialize the scene
  const content = serializeAsJSON(elements, appState, files, "local");

  // File metadata
  const metadata: any = {
    mimeType: EXCALIDRAW_MIME_TYPE,
  };

  if (!fileId && fileName) {
    metadata.name = fileName.endsWith(EXCALIDRAW_EXTENSION)
      ? fileName
      : `${fileName}${EXCALIDRAW_EXTENSION}`;
  }

  // Create form data for multipart upload
  const boundary = "excalidraw_upload_boundary";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${EXCALIDRAW_MIME_TYPE}\r\n\r\n` +
    content +
    closeDelimiter;

  // Upload or update
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,webViewLink`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";

  const method = fileId ? "PATCH" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    throw new Error(`Failed to save file: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
  };
};

/**
 * Create a new file in Google Drive
 */
export const createNewFileInDrive = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  fileName: string,
  folderId?: string,
): Promise<{ fileId: string; webViewLink: string }> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const name = fileName.endsWith(EXCALIDRAW_EXTENSION)
    ? fileName
    : `${fileName}${EXCALIDRAW_EXTENSION}`;

  // Serialize the scene
  const content = serializeAsJSON(elements, appState, files, "local");

  // File metadata
  const metadata: any = {
    name,
    mimeType: EXCALIDRAW_MIME_TYPE,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  // Create form data for multipart upload
  const boundary = "excalidraw_upload_boundary";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${EXCALIDRAW_MIME_TYPE}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
  };
};

/**
 * Delete a file from Google Drive
 */
export const deleteFromGoogleDrive = async (fileId: string): Promise<void> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
};

/**
 * Get file metadata from Google Drive
 */
export const getFileMetadata = async (fileId: string): Promise<DriveFile> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const response = await gapi.client.drive.files.get({
    fileId,
    fields:
      "id, name, mimeType, webViewLink, webContentLink, modifiedTime, createdTime, size, iconLink, thumbnailLink",
  });

  return response.result;
};

/**
 * Open the Google Drive file picker
 */
export const openFilePicker = (
  callback: (fileId: string, fileName: string) => void,
): void => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
  view.setQuery(".excalidraw");
  view.setMimeTypes(EXCALIDRAW_MIME_TYPE);

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(accessToken)
    .setDeveloperKey(GOOGLE_API_KEY)
    .setAppId(GOOGLE_APP_ID)
    .setCallback((data: google.picker.ResponseObject) => {
      if (data.action === google.picker.Action.PICKED) {
        const file = data.docs[0];
        callback(file.id, file.name);
      }
    })
    .build();

  picker.setVisible(true);
};

/**
 * Share a file (set link sharing)
 */
export const shareFile = async (
  fileId: string,
  role: "reader" | "writer" = "reader",
): Promise<string> => {
  if (!accessToken) {
    throw new Error("Not signed in to Google Drive");
  }

  // Create permission for anyone with link
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        type: "anyone",
      }),
    },
  );

  // Get the sharing link
  const metadata = await getFileMetadata(fileId);
  return metadata.webViewLink || "";
};

// Type declarations for Google APIs (minimal)
declare global {
  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenClient {
          requestAccessToken(options?: { prompt?: string }): void;
        }
        function initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: { access_token?: string; error?: string }) => void;
        }): TokenClient;
        function revoke(token: string, callback: () => void): void;
      }
    }
    namespace picker {
      enum ViewId {
        DOCS = "all",
      }
      enum Action {
        PICKED = "picked",
      }
      interface ResponseObject {
        action: string;
        docs: Array<{ id: string; name: string }>;
      }
      class DocsView {
        constructor(viewId: ViewId);
        setQuery(query: string): DocsView;
        setMimeTypes(mimeTypes: string): DocsView;
      }
      class PickerBuilder {
        addView(view: DocsView): PickerBuilder;
        setOAuthToken(token: string): PickerBuilder;
        setDeveloperKey(key: string): PickerBuilder;
        setAppId(appId: string): PickerBuilder;
        setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
        build(): Picker;
      }
      interface Picker {
        setVisible(visible: boolean): void;
      }
    }
  }

  const gapi: {
    load(libraries: string, callback: () => void): void;
    client: {
      init(config: {
        apiKey: string;
        discoveryDocs: string[];
      }): Promise<void>;
      drive: {
        files: {
          list(params: {
            q: string;
            pageSize: number;
            fields: string;
            orderBy?: string;
          }): Promise<{ result: { files: DriveFile[] } }>;
          get(params: {
            fileId: string;
            fields: string;
          }): Promise<{ result: DriveFile }>;
        };
      };
    };
  };
}

export {};

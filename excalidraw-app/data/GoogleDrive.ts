/**
 * Google Drive API integration service
 * Handles authentication and file operations with Google Drive
 */

import { appJotaiStore } from "../app-jotai";
import {
  googleDriveAuthAtom,
  excalidrawFolderIdAtom,
  currentBoardIdAtom,
} from "../app-jotai";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const EXCALIDRAW_FOLDER_NAME = "excalidraw";
const BOARD_FILE_NAME = "board.excalidraw";

// Storage keys for persistence
const AUTH_STORAGE_KEY = "excalidraw_google_drive_auth";
const FOLDER_ID_STORAGE_KEY = "excalidraw_google_drive_folder_id";
// Use localStorage key from app_constants for board selection (persists across sessions)
const CURRENT_BOARD_STORAGE_KEY = "excalidraw_current_board_id";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export class GoogleDriveService {
  private static isInitialized = false;

  /**
   * Load Google Identity Services script dynamically
   */
  private static loadGISScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (window.google?.accounts) {
        resolve();
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      );
      if (existingScript) {
        // Script is loading, wait for it
        const checkInterval = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.google?.accounts) {
            reject(
              new Error(
                "Google Identity Services script loaded but not initialized",
              ),
            );
          }
        }, 10000);
        return;
      }

      // Load the script dynamically
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait for google.accounts to be available
        const checkInterval = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.google?.accounts) {
            reject(
              new Error(
                "Google Identity Services script loaded but window.google.accounts not available. Check your Client ID configuration.",
              ),
            );
          }
        }, 5000);
      };
      script.onerror = () => {
        reject(
          new Error(
            "Failed to load Google Identity Services script. Check your network connection and Content Security Policy settings.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Google Identity Services
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      throw new Error(
        "Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env.development file.",
      );
    }

    // Validate Client ID format
    if (
      !GOOGLE_CLIENT_ID.includes(".apps.googleusercontent.com") &&
      !GOOGLE_CLIENT_ID.match(/^\d+-[\w-]+\.apps\.googleusercontent\.com$/)
    ) {
      console.warn(
        "Google Client ID format may be incorrect. Expected format: XXXX-XXXX.apps.googleusercontent.com",
      );
    }

    try {
      // Load GIS script if not already loaded
      await this.loadGISScript();

      // Verify oauth2 is available
      if (!window.google?.accounts?.oauth2) {
        throw new Error(
          "Google Identity Services OAuth2 not available. Ensure you're using a Web Client ID from Google Cloud Console (not OAuth consent screen only).",
        );
      }

      this.isInitialized = true;
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        "Failed to initialize Google Identity Services. Please check:\n" +
          "1. Your Client ID is a Web Client ID from Google Cloud Console\n" +
          "2. The script is not blocked by browser extensions or CSP\n" +
          "3. Your network connection is working";
      throw new Error(errorMessage);
    }
  }

  /**
   * Authenticate user with Google OAuth 2.0
   */
  static async authenticate(): Promise<{
    accessToken: string;
    userEmail: string;
  }> {
    await this.initialize();

    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Google Client ID not configured");
    }

    return new Promise((resolve, reject) => {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: `${GOOGLE_DRIVE_SCOPE} ${GOOGLE_USERINFO_SCOPE}`,
        callback: async (response) => {
          if (response.access_token) {
            try {
              // Get user email
              const userInfo = await this.getUserInfo(response.access_token);

              const authData = {
                isAuthenticated: true,
                accessToken: response.access_token,
                userEmail: userInfo.email,
              };

              appJotaiStore.set(googleDriveAuthAtom, authData);

              // Persist auth state to sessionStorage
              try {
                sessionStorage.setItem(
                  AUTH_STORAGE_KEY,
                  JSON.stringify(authData),
                );
              } catch (error) {
                console.warn("Failed to persist auth state:", error);
              }

              resolve({
                accessToken: response.access_token,
                userEmail: userInfo.email,
              });
            } catch (error: any) {
              console.error("Error getting user info:", error);
              const errorMessage =
                error?.message ||
                `Failed to get user info: ${error?.status || "Unknown error"}`;
              reject(new Error(errorMessage));
            }
          } else {
            reject(new Error("Failed to get access token"));
          }
        },
      });

      tokenClient.requestAccessToken();
    });
  }

  /**
   * Get user info from Google API
   */
  private static async getUserInfo(
    accessToken: string,
  ): Promise<{ email: string }> {
    if (!accessToken || accessToken.trim() === "") {
      throw new Error("Access token is missing or empty");
    }

    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to get user info: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // If error response isn't JSON, use the text
        if (errorText) {
          errorMessage = `${errorMessage} - ${errorText}`;
        }
      }

      console.error("Userinfo API error:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      throw new Error(errorMessage);
    }

    const userInfo = await response.json();

    if (!userInfo.email) {
      throw new Error("User email not found in response");
    }

    return userInfo;
  }

  /**
   * Get or create the Excalidraw folder in Google Drive
   */
  static async getOrCreateExcalidrawFolder(
    accessToken: string,
  ): Promise<string> {
    // Check if folder already exists
    const existingFolderId = appJotaiStore.get(excalidrawFolderIdAtom);
    if (existingFolderId) {
      // Verify it still exists
      try {
        await this.getFileMetadata(accessToken, existingFolderId);
        return existingFolderId;
      } catch {
        // Folder doesn't exist anymore, create a new one
      }
    }

    // Search for existing folder
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${EXCALIDRAW_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      if (data.files && data.files.length > 0) {
        const folderId = data.files[0].id;
        appJotaiStore.set(excalidrawFolderIdAtom, folderId);

        // Persist folder ID to sessionStorage
        try {
          sessionStorage.setItem(FOLDER_ID_STORAGE_KEY, folderId);
        } catch (error) {
          console.warn("Failed to persist folder ID:", error);
        }

        return folderId;
      }
    }

    // Create new folder
    const createResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: EXCALIDRAW_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
        }),
      },
    );

    if (!createResponse.ok) {
      throw new Error("Failed to create Excalidraw folder");
    }

    const folder = await createResponse.json();
    appJotaiStore.set(excalidrawFolderIdAtom, folder.id);

    // Persist folder ID to sessionStorage
    try {
      sessionStorage.setItem(FOLDER_ID_STORAGE_KEY, folder.id);
    } catch (error) {
      console.warn("Failed to persist folder ID:", error);
    }

    return folder.id;
  }

  /**
   * Create a new board folder
   */
  static async createBoardFolder(
    accessToken: string,
    excalidrawFolderId: string,
    boardName: string,
  ): Promise<{ id: string; name: string; folderId: string }> {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: boardName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [excalidrawFolderId],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create board folder");
    }

    const folder = await response.json();
    return {
      id: folder.id,
      name: boardName,
      folderId: folder.id,
    };
  }

  /**
   * List all board folders
   */
  static async listBoards(
    accessToken: string,
    excalidrawFolderId: string,
  ): Promise<Array<{ id: string; name: string; folderId: string }>> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${excalidrawFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&orderBy=name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to list boards");
    }

    const data = await response.json();
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      folderId: file.id,
    }));
  }

  /**
   * Save board data to Google Drive
   */
  static async saveBoard(
    accessToken: string,
    boardFolderId: string,
    data: string,
  ): Promise<void> {
    // Check if file already exists
    const existingFileId = await this.findBoardFile(accessToken, boardFolderId);

    const blob = new Blob([data], { type: "application/json" });
    const formData = new FormData();

    const metadata = {
      name: BOARD_FILE_NAME,
      parents: [boardFolderId],
    };

    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    formData.append("file", blob);

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    const method = existingFileId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to save board");
    }
  }

  /**
   * Create initial empty board.excalidraw file
   */
  static async createInitialBoardFile(
    accessToken: string,
    boardFolderId: string,
  ): Promise<void> {
    // Check if file already exists
    const existingFileId = await this.findBoardFile(accessToken, boardFolderId);
    if (existingFileId) {
      return; // File already exists
    }

    // Create empty Excalidraw scene
    const emptyScene = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: null,
        currentItemStrokeColor: "#000000",
        currentItemBackgroundColor: "transparent",
        currentItemFillStyle: "hachure",
        currentItemStrokeStyle: "solid",
        currentItemRoughness: 1,
        currentItemOpacity: 100,
        currentItemFontFamily: 1,
        currentItemFontSize: 20,
        currentItemTextAlign: "left",
        currentItemStrokeWidth: 1,
        currentItemRoundness: "round",
        gridModeEnabled: false,
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
      },
      files: {},
    };

    const jsonData = JSON.stringify(emptyScene);
    await this.saveBoard(accessToken, boardFolderId, jsonData);
  }

  /**
   * Load board data from Google Drive
   */
  static async loadBoard(
    accessToken: string,
    boardFolderId: string,
  ): Promise<string> {
    const fileId = await this.findBoardFile(accessToken, boardFolderId);

    if (!fileId) {
      // Create initial file if it doesn't exist
      await this.createInitialBoardFile(accessToken, boardFolderId);
      // Try loading again
      const newFileId = await this.findBoardFile(accessToken, boardFolderId);
      if (!newFileId) {
        throw new Error("Failed to create board file");
      }
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${newFileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to load board");
      }
      return response.text();
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load board");
    }

    return response.text();
  }

  /**
   * Delete a board folder
   */
  static async deleteBoard(
    accessToken: string,
    boardFolderId: string,
  ): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${boardFolderId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete board");
    }
  }

  /**
   * Find board.excalidraw file in a folder
   */
  private static async findBoardFile(
    accessToken: string,
    boardFolderId: string,
  ): Promise<string | null> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${boardFolderId}' in parents and name='${BOARD_FILE_NAME}' and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  /**
   * Get file metadata
   */
  private static async getFileMetadata(
    accessToken: string,
    fileId: string,
  ): Promise<any> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("File not found");
    }

    return response.json();
  }

  /**
   * Restore auth state from sessionStorage and localStorage
   */
  static restoreAuthState(): void {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const authData = JSON.parse(stored);
        appJotaiStore.set(googleDriveAuthAtom, authData);

        const folderId = sessionStorage.getItem(FOLDER_ID_STORAGE_KEY);
        if (folderId) {
          appJotaiStore.set(excalidrawFolderIdAtom, folderId);
        }

        // Restore current board from localStorage (persists across sessions)
        const currentBoard = localStorage.getItem(CURRENT_BOARD_STORAGE_KEY);
        if (currentBoard) {
          appJotaiStore.set(currentBoardIdAtom, currentBoard);
        }
      }
    } catch (error) {
      console.error("Failed to restore auth state:", error);
      // Clear corrupted storage
      try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(FOLDER_ID_STORAGE_KEY);
        localStorage.removeItem(CURRENT_BOARD_STORAGE_KEY);
      } catch {
        // Ignore errors when clearing
      }
    }
  }

  /**
   * Sign out user
   */
  static signOut(): void {
    appJotaiStore.set(googleDriveAuthAtom, {
      isAuthenticated: false,
      accessToken: null,
      userEmail: null,
    });
    appJotaiStore.set(excalidrawFolderIdAtom, null);

    // Clear persisted state
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(FOLDER_ID_STORAGE_KEY);
      localStorage.removeItem(CURRENT_BOARD_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear persisted auth state:", error);
    }
  }

  /**
   * Rename a board folder
   */
  static async renameBoard(
    accessToken: string,
    boardFolderId: string,
    newName: string,
  ): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${boardFolderId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to rename board");
    }
  }
}

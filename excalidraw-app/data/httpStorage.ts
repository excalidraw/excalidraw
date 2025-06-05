import { Socket } from "socket.io-client";
import { getSyncableElements } from ".";
import {
  MIME_TYPES,
  getSceneVersion,
  restoreElements,
} from "../../packages/excalidraw";
import {
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../packages/excalidraw/types";
import {
  ExcalidrawElement,
  FileId,
} from "../../packages/excalidraw/element/types";
import { decompressData } from "../../packages/excalidraw/data/encode";
import Portal from "../collab/Portal";
import * as Sentry from "@sentry/browser";

export const encryptElements = async (
  elements: readonly ExcalidrawElement[],
): Promise<any> => {
  return JSON.stringify(elements);
};

const httpStorageSceneVersionCache = new WeakMap<Socket, number>();

const HTTP_STORAGE_BACKEND_URL = import.meta.env.VITE_APP_HTTP_SERVER_URL;

export class TokenService {
  private cachedToken: string | null = null;
  private tokenPromise: Promise<string> | null = null;
  private eventHandlerRegistered = false;
  private pendingRequests = new Map();
  private allowedOrigins = (
    import.meta.env.VITE_APP_TOKEN_SERVICE_ALLOWED_ORIGINS || ""
  )
    .split(",")
    .map((origin: string) => origin.trim());

  async getToken(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.ensureEventHandler();
    this.tokenPromise = this.fetchTokenFromParent();

    try {
      this.cachedToken = await this.tokenPromise;
      // Mintain a short cache to not send too many messages
      setTimeout(() => this.clearToken(), 10000); // 30 seconds
      return this.cachedToken;
    } finally {
      this.tokenPromise = null;
    }
  }

  private ensureEventHandler() {
    if (!this.eventHandlerRegistered) {
      window.addEventListener("message", this.handleMessage);
      this.eventHandlerRegistered = true;
      console.info(
        "[draw][token-service] Event handler registered for token service",
      );
    }
  }

  private handleMessage = (event: MessageEvent) => {
    if (!this.allowedOrigins.includes(event.origin)) {
      console.warn(
        "[draw][token-service] Rejected message from untrusted origin:",
        event.origin,
      );
      return;
    }

    const { type, requestId, data, error } = event.data;

    if (type === "TOKEN_RESPONSE" && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      console.info(
        "[draw][token-service] recieved token response for requestId:",
        requestId,
        "error:",
        error,
      );

      if (error) {
        console.warn("[draw][token-service] Error in token response:", error);
        reject(new Error(error));
      } else {
        resolve(data);
      }
    } else {
      console.warn(
        "[draw][token-service] Unhandled message type:",
        type,
        "for requestId:",
        requestId,
      );
    }
  };

  private async fetchTokenFromParent(timeout = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.pendingRequests.set(requestId, { resolve, reject });

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          console.warn(
            "[draw][token-service] Request timed out for requestId:",
            requestId,
          );
          reject(new Error("Request timeout"));
        }
      }, timeout);

      window.parent.postMessage(
        {
          type: "TOKEN_REQUEST",
          requestId,
        },
        "*",
      );

      console.info(
        "[draw][token-service] Requesting token from parent with requestId:",
        requestId,
      );

      // Clear timeout when promise resolves/rejects
      const originalResolve = resolve;
      const originalReject = reject;

      this.pendingRequests.set(requestId, {
        resolve: (value: string) => {
          clearTimeout(timeoutId);
          originalResolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          originalReject(error);
        },
      });
    });
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  destroy() {
    if (this.eventHandlerRegistered) {
      window.removeEventListener("message", this.handleMessage);
      this.eventHandlerRegistered = false;
    }
    this.pendingRequests.clear();
    this.clearToken();
  }

  clearToken() {
    this.cachedToken = null;
  }
}

export const isSavedToHttpStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return httpStorageSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

const getSyncableElementsFromResponse = async (response: Response) => {
  return getSyncableElements(JSON.parse((await response.json()).data) || []);
};

// TODO (Jess): Consider adding reconciliation here, similar to firebase impl
export const saveToHttpStorage = async (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
  tokenService: TokenService,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // if no room exists, consider the room saved because there's nothing we can
    // do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToHttpStorage(portal, elements)
  ) {
    return true;
  }
  const token = await tokenService.getToken();

  console.info("[draw] Saving to HTTP storage", roomId, roomKey);

  const sceneVersion = getSceneVersion(elements);

  const getResponse = await fetch(`${HTTP_STORAGE_BACKEND_URL}/drawing-data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      roomId,
      roomKey,
    }),
  });

  if (!getResponse.ok && getResponse.status !== 404) {
    return false;
  }

  if (getResponse.ok) {
    const existingElements = await getSyncableElementsFromResponse(getResponse);

    if (existingElements && getSceneVersion(existingElements) >= sceneVersion) {
      console.info(
        "[draw] Scene is already saved",
        sceneVersion,
        getSceneVersion(existingElements),
      );
      return false;
    }
  }

  console.info("[draw] Saving drawing data...");

  const putHeaders: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  putHeaders.Authorization = `Bearer ${token}`;

  const putResponse = await fetch(`${HTTP_STORAGE_BACKEND_URL}/drawing-data`, {
    method: "POST",
    headers: putHeaders,
    body: new URLSearchParams({
      roomId,
      roomKey,
      data: JSON.stringify(elements),
    }),
  });

  if (putResponse.ok) {
    httpStorageSceneVersionCache.set(socket, sceneVersion);
    return true;
  }
  return false;
};

// TODO (Jess): might need to look at getSceneVersion... new is using elements
// as a whole, not just version number for the version cache
export const loadFromHttpStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
  tokenService: TokenService,
): Promise<readonly ExcalidrawElement[] | null> => {
  const token = await tokenService.getToken();

  const getResponse = await fetch(`${HTTP_STORAGE_BACKEND_URL}/drawing-data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      roomId,
      roomKey,
    }),
  });

  const elements = await getSyncableElementsFromResponse(getResponse);

  console.info("[draw] Loaded scene version", getSceneVersion(elements));

  if (socket) {
    httpStorageSceneVersionCache.set(socket!, getSceneVersion(elements));
  }

  return restoreElements(elements, null);
};

export const saveFilesToHttpStorage = async ({
  files,
  roomId,
  roomKey,
  tokenService,
}: {
  files: { id: FileId; buffer: Uint8Array }[];
  roomId: string;
  roomKey: string;
  tokenService: TokenService;
}) => {
  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const payloadBlob = new Blob([buffer]);
        const body = await new Response(payloadBlob).arrayBuffer();

        const headers: HeadersInit = {
          "Room-Id": roomId,
          "Room-Key": roomKey,
          "File-Id": id,
        };

        const token = await tokenService.getToken();
        headers.Authorization = `Bearer ${token}`;

        await fetch(`${HTTP_STORAGE_BACKEND_URL}/drawing-file`, {
          method: "POST",
          headers,
          body,
        });
        savedFiles.set(id, true);
      } catch (error: any) {
        Sentry.captureException(error);
        console.error("Error saving file", error);
        erroredFiles.set(id, true);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromHttpStorage = async (
  filesIds: readonly FileId[],
  roomId: string,
  roomKey: string,
  tokenService: TokenService,
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const token = await tokenService.getToken();

        const response = await fetch(
          `${HTTP_STORAGE_BACKEND_URL}/drawing-file`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Room-Id": roomId,
              "Room-Key": roomKey,
              "File-Id": id,
            },
          },
        );
        if (response.status < 400) {
          const buffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(buffer),
            {
              decryptionKey: roomKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            // TODO (Jess): consider adding:
            // lastRetrieved: metadata?.created || Date.now(),
          });
        } else if (response.status === 403) {
          // Note that we don't consider this an "erroredFile" because we still want
          // other connected clients to be able to load the file
          Sentry.captureException(new Error(`File access forbidden ${id}`));
          console.error("File access forbidden", id);
        } else {
          Sentry.captureException(new Error(`Error loading file ${id}`));
          console.error("Error loading file", id);
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        Sentry.captureException(error);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

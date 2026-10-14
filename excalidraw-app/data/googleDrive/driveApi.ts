/**
 * Minimal Google Drive v3 REST helpers.
 *
 * Files are stored as `.excalidraw` JSON documents (scene + embedded images),
 * so a single Drive file holds a complete drawing. All requests authenticate
 * with the user's OAuth access token (`drive.file` scope), no API key needed.
 */
import { MIME_TYPES } from "@excalidraw/common";

import type { DriveFile } from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

type OwnerWindow = Window & typeof globalThis;

const assertOk = async (response: Response, context: string) => {
  if (response.ok) {
    return;
  }
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    // ignore body read errors
  }
  throw new Error(
    `${context} (${response.status})${detail ? `: ${detail}` : ""}`,
  );
};

export const downloadDriveFile = async ({
  ownerWindow,
  accessToken,
  fileId,
}: {
  ownerWindow: OwnerWindow;
  accessToken: string;
  fileId: string;
}): Promise<Blob> => {
  const response = await ownerWindow.fetch(
    `${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertOk(response, "Google Drive download failed");
  return response.blob();
};

export const deleteDriveFile = async ({
  ownerWindow,
  accessToken,
  fileId,
}: {
  ownerWindow: OwnerWindow;
  accessToken: string;
  fileId: string;
}): Promise<void> => {
  const response = await ownerWindow.fetch(
    `${DRIVE_API}/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertOk(response, "Google Drive delete failed");
};

export const createDriveFile = async ({
  ownerWindow,
  accessToken,
  name,
  blob,
  parentId,
}: {
  ownerWindow: OwnerWindow;
  accessToken: string;
  name: string;
  blob: Blob;
  parentId?: string;
}): Promise<DriveFile> => {
  // 1. create the file metadata (returns an id)...
  const metadataResponse = await ownerWindow.fetch(
    `${DRIVE_API}?fields=id,name`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: MIME_TYPES.excalidraw,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    },
  );
  await assertOk(metadataResponse, "Google Drive create failed");
  const { id } = (await metadataResponse.json()) as { id: string };

  // 2. ...then upload the content into it
  try {
    const mediaResponse = await ownerWindow.fetch(
      `${DRIVE_UPLOAD_API}/${encodeURIComponent(
        id,
      )}?uploadType=media&fields=id,name`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": MIME_TYPES.excalidraw,
        },
        body: blob,
      },
    );
    await assertOk(mediaResponse, "Google Drive upload failed");
    const saved = (await mediaResponse.json()) as Partial<DriveFile>;
    return { id: saved.id ?? id, name: saved.name ?? name };
  } catch (error) {
    // don't leave an empty file behind if the content upload failed
    await deleteDriveFile({ ownerWindow, accessToken, fileId: id }).catch(
      (cleanupError) => {
        console.error("Failed to clean up Google Drive file", cleanupError);
      },
    );
    throw error;
  }
};

export const updateDriveFile = async ({
  ownerWindow,
  accessToken,
  fileId,
  blob,
  name,
}: {
  ownerWindow: OwnerWindow;
  accessToken: string;
  fileId: string;
  blob: Blob;
  name?: string;
}): Promise<DriveFile> => {
  if (name) {
    const renameResponse = await ownerWindow.fetch(
      `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id,name`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
    );
    await assertOk(renameResponse, "Google Drive rename failed");
  }

  const response = await ownerWindow.fetch(
    `${DRIVE_UPLOAD_API}/${encodeURIComponent(
      fileId,
    )}?uploadType=media&fields=id,name`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": MIME_TYPES.excalidraw,
      },
      body: blob,
    },
  );
  await assertOk(response, "Google Drive update failed");
  return (await response.json()) as DriveFile;
};

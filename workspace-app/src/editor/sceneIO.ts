import {
  exportToBlob,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import { ApiError, put } from "../api/client";

import { SaveFailure } from "./AutosaveEngine";

import type {
  Draft,
  DraftStore,
  SaveOutcome,
  Snapshot,
} from "./AutosaveEngine";

/** Only document-level settings are stored server-side (matches the server whitelist). */
export const persistedAppState = (a: Partial<AppState>) => ({
  viewBackgroundColor: a.viewBackgroundColor,
  gridSize: a.gridSize,
  gridStep: a.gridStep,
  gridModeEnabled: a.gridModeEnabled,
});

export const idbDraftStore = (key: string): DraftStore => ({
  get: () => idbGet<Draft>(key).catch(() => undefined),
  set: (d) => idbSet(key, d),
  clear: () => idbDel(key),
});

export const draftKey = (sceneId: string) => `ew:draft:${sceneId}`;

/** Merge server content into local edits with Excalidraw's own reconciler. */
export const mergeSnapshots = (
  local: Snapshot,
  remote: Snapshot,
  appState: AppState,
): Snapshot => ({
  elements: reconcileElements(
    local.elements as OrderedExcalidrawElement[],
    restoreElements(remote.elements as any, null) as any,
    appState,
  ),
  appState: local.appState,
});

/**
 * True when the local draft holds any element the server doesn't already have
 * at the same-or-newer version (Excalidraw's version / versionNonce rule).
 * Drafts that the server already covers are discarded instead of "recovered".
 */
export const draftIsAhead = (draft: readonly any[], server: readonly any[]) => {
  const byId = new Map(server.map((e) => [e.id, e]));
  return draft.some((e) => {
    const s = byId.get(e.id);
    return (
      !s ||
      e.version > s.version ||
      (e.version === s.version && e.versionNonce < s.versionNonce)
    );
  });
};

// ---------------------------------------------------------------- files

const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export const fetchSceneFiles = async (
  api: ExcalidrawImperativeAPI,
  elements: readonly any[],
  urlFor: (fileId: string) => string,
) => {
  const have = api.getFiles();
  const wanted = [
    ...new Set(
      elements
        .filter(
          (e) =>
            e.type === "image" && !e.isDeleted && e.fileId && !have[e.fileId],
        )
        .map((e) => e.fileId as string),
    ),
  ];
  const loaded: BinaryFileData[] = [];
  await Promise.all(
    wanted.map(async (id) => {
      try {
        const res = await fetch(urlFor(id), { credentials: "same-origin" });
        if (!res.ok) {
          return;
        }
        const blob = await res.blob();
        loaded.push({
          id: id as any,
          mimeType: blob.type as any,
          dataURL: (await blobToDataURL(blob)) as any,
          created: Date.now(),
        });
      } catch {
        /* image stays as a placeholder; retried on next open */
      }
    }),
  );
  if (loaded.length) {
    api.addFiles(loaded);
  }
};

/** Uploads image files that the server has not seen yet. Returns when all are stored. */
export const uploadPendingFiles = async (
  files: BinaryFiles,
  elements: readonly any[],
  uploaded: Set<string>,
  uploadPath: (fileId: string) => string,
  putFn: typeof put = put,
) => {
  const needed = new Set(
    elements
      .filter((e) => e.type === "image" && !e.isDeleted && e.fileId)
      .map((e) => e.fileId as string),
  );
  for (const id of needed) {
    const file = files[id];
    if (!file || uploaded.has(id)) {
      continue;
    }
    const m = /^data:([^;]+);base64,(.*)$/.exec(file.dataURL);
    if (!m) {
      continue;
    }
    await putFn(uploadPath(id), { mimeType: m[1], dataBase64: m[2] });
    uploaded.add(id);
  }
};

// ---------------------------------------------------------------- save

export const toSaveFailure = (e: unknown) => {
  if (e instanceof ApiError) {
    if (
      e.status === 0 ||
      e.status >= 500 ||
      e.status === 429 ||
      e.status === 408
    ) {
      return new SaveFailure(true, e.message);
    }
    if (e.status === 401) {
      return new SaveFailure(
        false,
        "Your session expired. Sign in again in another tab, then retry.",
      );
    }
    if (e.status === 403 || e.status === 404) {
      return new SaveFailure(
        false,
        "You no longer have permission to edit this scene.",
      );
    }
    if (e.status === 413) {
      return new SaveFailure(false, "This scene is too large to save.");
    }
    return new SaveFailure(false, e.message);
  }
  return new SaveFailure(true, (e as Error)?.message ?? "Save failed");
};

export const putSceneData = async (
  path: string,
  snapshot: Snapshot,
  baseVersion: number,
  thumbnail: string | undefined,
): Promise<SaveOutcome> => {
  try {
    const res = await put<{ version: number }>(path, {
      baseVersion,
      elements: snapshot.elements,
      appState: snapshot.appState,
      ...(thumbnail ? { thumbnail } : {}),
    });
    return { kind: "ok", version: res.version };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body?.data) {
      return { kind: "conflict", version: e.body.version, data: e.body.data };
    }
    throw toSaveFailure(e);
  }
};

// ---------------------------------------------------------------- thumbnail

const blobToDataUrl = (b: Blob) => blobToDataURL(b);

/** Small preview stored with the scene for the dashboard (<150 KB, else skipped). */
export const makeThumbnail = async (
  elements: readonly any[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<string | undefined> => {
  const live = elements.filter((e) => !e.isDeleted);
  if (live.length === 0) {
    return undefined;
  }
  try {
    const blob = await exportToBlob({
      elements: live as any,
      appState: {
        ...appState,
        exportBackground: true,
        viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
        exportWithDarkMode: false,
      },
      files,
      mimeType: "image/webp",
      quality: 0.7,
      maxWidthOrHeight: 480,
    } as any);
    if (blob.size > 140 * 1024) {
      return undefined;
    }
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
};

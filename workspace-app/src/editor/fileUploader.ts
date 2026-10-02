import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { uploadPendingFiles } from "./sceneIO";

type PutFn = Parameters<typeof uploadPendingFiles>[4];

export interface FileUploader {
  /** Uploads every referenced file the server hasn't got; rejects if any upload fails. */
  ensure: (files: BinaryFiles, elements: readonly any[]) => Promise<void>;
  /** Fire-and-forget variant used on every editor change; failures are retried later. */
  sync: (files: BinaryFiles, elements: readonly any[]) => void;
  /** Connectivity is back: retry whatever failed. */
  retry: () => void;
  markUploaded: (ids: Iterable<string>) => void;
  dispose: () => void;
}

/**
 * Image bytes travel separately from scene JSON, and they must reach the server even
 * while HTTP autosave is paused by a live session — collaborators fetch them by id.
 * Uploads are serialized (no duplicate PUTs) and retried with backoff.
 */
export const createFileUploader = (
  uploadPath: (fileId: string) => string,
  putFn?: PutFn,
  retryBaseMs = 3000,
): FileUploader => {
  const uploaded = new Set<string>();
  let chain: Promise<unknown> = Promise.resolve();
  let latest: { files: BinaryFiles; elements: readonly any[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let disposed = false;

  const ensure = (files: BinaryFiles, elements: readonly any[]) => {
    latest = { files, elements };
    const run = chain.then(() =>
      uploadPendingFiles(files, elements, uploaded, uploadPath, putFn),
    );
    chain = run.catch(() => {});
    return run;
  };

  const schedule = () => {
    if (timer || disposed) {
      return;
    }
    failures++;
    timer = setTimeout(() => {
      timer = null;
      retry();
    }, Math.min(30_000, retryBaseMs * 2 ** (failures - 1)));
  };

  const sync = (files: BinaryFiles, elements: readonly any[]) => {
    ensure(files, elements).then(
      () => {
        failures = 0;
      },
      (e) => {
        // client errors (413/415/403…) are permanent for that file: don't loop forever
        if (
          !e?.status ||
          e.status >= 500 ||
          e.status === 429 ||
          e.status === 408 ||
          e.status === 0
        ) {
          schedule();
        } else {
          console.warn("image upload rejected:", e.message);
        }
      },
    );
  };

  const retry = () => {
    if (latest && !disposed) {
      sync(latest.files, latest.elements);
    }
  };

  return {
    ensure,
    sync,
    retry,
    markUploaded: (ids) => {
      for (const id of ids) {
        uploaded.add(id);
      }
    },
    dispose: () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    },
  };
};

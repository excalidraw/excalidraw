import { VersionedSnapshotStore } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

export type FileLoadingStatus = "loading" | "loaded" | "error";

export class FileStatusStore {
  private static store = new VersionedSnapshotStore<
    Map<FileId, FileLoadingStatus>
  >(new Map());

  static getSnapshot() {
    return this.store.getSnapshot();
  }

  static pull(sinceVersion?: number) {
    return this.store.pull(sinceVersion);
  }

  static updateStatuses(updates: Array<[FileId, FileLoadingStatus]>) {
    if (!updates.length) {
      return;
    }
    this.store.update((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, status] of updates) {
        if (next.get(id) !== status) {
          next.set(id, status);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  static getPendingCount(statuses: Map<FileId, FileLoadingStatus>) {
    let pending = 0;
    let total = 0;
    for (const status of statuses.values()) {
      total++;
      if (status === "loading") {
        pending++;
      }
    }
    return { pending, total };
  }
}

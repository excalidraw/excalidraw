import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useAtomValue } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { CollectionStore } from "../data/collections/CollectionStore";
import { exportAllCollectionsToZip } from "../data/collections/exportCollections";
import { getCollectionThumbnail } from "../data/collections/collectionThumbnails";
import { activeCollectionDirtyAtom } from "../data/collectionUiAtoms";

import { collectionsDialogOpenAtom } from "./collectionsDialogAtom";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

import "./CollectionsDialog.scss";

import type { Collection } from "../data/collections/types";

export type CollectionsDialogProps = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onSwitchCollection: (collectionId: string) => Promise<void>;
  onSaveCollection: (collectionId: string) => Promise<void>;
  onSaveCollectionAs: (collectionId: string) => Promise<void>;
  onDownloadCollection: (collectionId: string) => Promise<void>;
  isDirty: boolean;
};

type SortMode = "name-asc" | "name-desc" | "modified";

const readSortMode = (): SortMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_SORT);
    if (v === "name-asc" || v === "name-desc" || v === "modified") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "modified";
};

export const CollectionsDialog = ({
  excalidrawAPI,
  onSwitchCollection,
  onSaveCollection,
  onSaveCollectionAs,
  onDownloadCollection,
  isDirty,
}: CollectionsDialogProps) => {
  const [isOpen, setIsOpen] = useAtom(collectionsDialogOpenAtom);
  const activeDirty = useAtomValue(activeCollectionDirtyAtom);
  const dirty = isDirty || activeDirty;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSessionFolder, setHasSessionFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>(readSortMode);
  const [osPath, setOsPath] = useState(CollectionStore.getOsFolderPath());
  const [folderInfoOpen, setFolderInfoOpen] = useState(false);
  const [folderInfo, setFolderInfo] = useState<{
    folderName: string | null;
    fileNames: string[];
    osPath: string;
  } | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const fsSupported = CollectionStore.isFileSystemSupported();

  const refresh = useCallback(async () => {
    const index = CollectionStore.getIndex();
    setCollections([...index.collections]);
    setActiveId(CollectionStore.getActiveCollection()?.id ?? null);
    setHasSessionFolder(
      CollectionStore.hasSessionDirectory() || index.hasDirectory,
    );
    setOsPath(CollectionStore.getOsFolderPath());

    const urls: Record<string, string> = {};
    await Promise.all(
      index.collections.map(async (c) => {
        const blob = await getCollectionThumbnail(c.id);
        if (blob) {
          urls[c.id] = URL.createObjectURL(blob);
        }
      }),
    );
    setThumbnails((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refresh();
      setError(null);
      setSearchQuery("");
    }
    return () => {
      setThumbnails((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [isOpen, refresh]);

  const handleClose = () => setIsOpen(false);

  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...collections];
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.fileName.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortMode === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      return (b.lastSavedAt ?? b.updatedAt) - (a.lastSavedAt ?? a.updatedAt);
    });
    return list;
  }, [collections, searchQuery, sortMode]);

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_SORT, mode);
  };

  const handlePickFolder = async () => {
    setBusy(true);
    setError(null);
    try {
      await CollectionStore.pickDirectory();
      await CollectionStore.migrateLegacySceneToDefaultCollection();
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not open folder picker.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await CollectionStore.createCollection(name);
      setNewName("");
      CollectionStore.setActiveCollection(created.id);
      await onSwitchCollection(created.id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not create collection.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSaveCollection(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not save collection.");
    } finally {
      setBusy(false);
    }
  };

  const performSwitch = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSwitchCollection(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not switch collection.");
    } finally {
      setBusy(false);
      setPendingSwitchId(null);
      setUnsavedOpen(false);
    }
  };

  const handleSwitch = async (id: string) => {
    if (id === activeId) {
      return;
    }
    if (dirty && activeId) {
      setPendingSwitchId(id);
      setUnsavedOpen(true);
      return;
    }
    await performSwitch(id);
  };

  const handleUnsavedSaveAndContinue = async () => {
    if (!activeId || !pendingSwitchId) {
      return;
    }
    setBusy(true);
    try {
      await onSaveCollection(activeId);
      await performSwitch(pendingSwitchId);
    } catch (e: any) {
      setError(e?.message ?? "Could not save before switching.");
      setBusy(false);
    }
  };

  const handleUnsavedDiscard = async () => {
    if (!pendingSwitchId) {
      return;
    }
    await performSwitch(pendingSwitchId);
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await CollectionStore.renameCollection(id, name);
      setRenameId(null);
      setRenameValue("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not rename collection.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Delete this collection? The file on disk will be removed if possible.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const wasActive = activeId === id;
      await CollectionStore.deleteCollection(id);
      await refresh();
      if (wasActive && excalidrawAPI) {
        const next = CollectionStore.getActiveCollection();
        if (next) {
          await onSwitchCollection(next.id);
        } else {
          excalidrawAPI.resetScene();
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not delete collection.");
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const created = await CollectionStore.duplicateCollection(id);
      CollectionStore.setActiveCollection(created.id);
      await onSwitchCollection(created.id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not duplicate collection.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const created = await CollectionStore.importFromFile(file);
      await onSwitchCollection(created.id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not import file.");
    } finally {
      setBusy(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const handleExportAll = async () => {
    if (!excalidrawAPI) {
      return;
    }
    setBusy(true);
    setError(null);
    setExportProgress(null);
    try {
      const { failed } = await exportAllCollectionsToZip(
        excalidrawAPI.getAppState(),
        (current, total, name) => {
          setExportProgress(`Exporting ${current}/${total}: ${name}`);
        },
      );
      if (failed.length > 0) {
        setError(`Some collections failed to export: ${failed.join(", ")}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not export collections.");
    } finally {
      setBusy(false);
      setExportProgress(null);
    }
  };

  const handleOpenFolderInfo = async () => {
    setBusy(true);
    setError(null);
    try {
      if (fsSupported) {
        try {
          await CollectionStore.ensureSessionDirectory();
        } catch {
          /* may not have picked yet */
        }
      }
      setFolderInfo(CollectionStore.getFolderInfo());
      setFolderInfoOpen(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not read folder info.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOsPath = () => {
    CollectionStore.setOsFolderPath(osPath);
    setError(null);
  };

  const activeCollection = collections.find((c) => c.id === activeId);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title="Collections"
        size="regular"
        className="collections-dialog"
      >
        <div className="collections-dialog__content">
          {!fsSupported && (
            <p className="collections-dialog__hint collections-dialog__hint--warn">
              This browser cannot write files directly. Collections are stored
              in browser storage. Use <strong>Download</strong> or{" "}
              <strong>Export all</strong> to back up your drawings.
            </p>
          )}
          {fsSupported && (
            <p className="collections-dialog__hint">
              {hasSessionFolder
                ? "New collections in this session will save to the same folder when you click Save."
                : "Click Save on a collection to choose where it is stored on disk."}
            </p>
          )}

          {activeCollection?.saveLocationLabel && (
            <p className="collections-dialog__location">
              Active save location:{" "}
              <code>{activeCollection.saveLocationLabel}</code>
            </p>
          )}

          <div className="collections-dialog__toolbar">
            <input
              type="search"
              className="collections-dialog__input"
              placeholder="Search collections…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={busy}
              aria-label="Search collections"
            />
            <select
              className="collections-dialog__select"
              value={sortMode}
              onChange={(e) => handleSortChange(e.target.value as SortMode)}
              disabled={busy}
              aria-label="Sort collections"
            >
              <option value="modified">Last modified</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </div>

          <div className="collections-dialog__toolbar-actions">
            {fsSupported && (
              <FilledButton
                label={hasSessionFolder ? "Change folder" : "Choose folder"}
                onClick={handlePickFolder}
                disabled={busy}
              />
            )}
            <FilledButton
              label="Open save folder"
              onClick={handleOpenFolderInfo}
              disabled={busy}
            />
            <FilledButton
              label="Import file"
              onClick={() => importInputRef.current?.click()}
              disabled={busy}
            />
            <input
              ref={importInputRef}
              type="file"
              accept=".excalidraw,.json,application/json"
              className="collections-dialog__file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleImport(file);
                }
              }}
            />
            <FilledButton
              label="Export all"
              onClick={handleExportAll}
              disabled={busy || collections.length === 0}
            />
          </div>

          <div className="collections-dialog__os-path">
            <label htmlFor="collections-os-path">
              Collections folder path (optional, for Explorer / .bat)
            </label>
            <div className="collections-dialog__os-path-row">
              <input
                id="collections-os-path"
                type="text"
                className="collections-dialog__input"
                placeholder="C:\Users\you\Documents\my-drawings"
                value={osPath}
                onChange={(e) => setOsPath(e.target.value)}
                disabled={busy}
              />
              <button type="button" onClick={handleSaveOsPath} disabled={busy}>
                Save path
              </button>
            </div>
          </div>

          <div className="collections-dialog__create">
            <input
              type="text"
              className="collections-dialog__input"
              placeholder="New collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              disabled={busy}
            />
            <FilledButton
              label="Create"
              onClick={handleCreate}
              disabled={busy || !newName.trim()}
            />
          </div>

          {exportProgress && (
            <p className="collections-dialog__progress">{exportProgress}</p>
          )}

          <ul className="collections-dialog__list">
            {filteredCollections.length === 0 && (
              <li className="collections-dialog__empty">
                {collections.length === 0
                  ? "No collections yet."
                  : "No collections match your search."}
              </li>
            )}
            {filteredCollections.map((c) => (
              <li
                key={c.id}
                className={
                  c.id === activeId
                    ? "collections-dialog__item collections-dialog__item--active"
                    : "collections-dialog__item"
                }
              >
                {renameId === c.id ? (
                  <div className="collections-dialog__rename">
                    <input
                      type="text"
                      className="collections-dialog__input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(c.id)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(c.id)}
                      disabled={busy}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameId(null);
                        setRenameValue("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="collections-dialog__name"
                      onClick={() => handleSwitch(c.id)}
                      disabled={busy}
                    >
                      {thumbnails[c.id] && (
                        <img
                          src={thumbnails[c.id]}
                          alt=""
                          className="collections-dialog__thumb"
                        />
                      )}
                      <span className="collections-dialog__name-text">
                        {c.name}
                        <span className="collections-dialog__file">
                          {c.fileName}
                          {c.saveLocationLabel && (
                            <span className="collections-dialog__path">
                              {" "}
                              · {c.saveLocationLabel}
                            </span>
                          )}
                          {fsSupported && !c.savedToDisk && (
                            <span className="collections-dialog__unsaved">
                              {" "}
                              · not saved to folder
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    <div className="collections-dialog__actions">
                      {fsSupported && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSave(c.id);
                          }}
                          disabled={busy}
                        >
                          Save
                        </button>
                      )}
                      {fsSupported && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBusy(true);
                            setError(null);
                            onSaveCollectionAs(c.id)
                              .then(() => refresh())
                              .catch((err: any) =>
                                setError(err?.message ?? "Save As failed."),
                              )
                              .finally(() => setBusy(false));
                          }}
                          disabled={busy}
                        >
                          Save As
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDownloadCollection(c.id);
                        }}
                        disabled={busy}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(c.id)}
                        disabled={busy}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(c.id);
                          setRenameValue(c.name);
                        }}
                        disabled={busy}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {error && <p className="collections-dialog__error">{error}</p>}
        </div>
      </Dialog>

      {folderInfoOpen && folderInfo && (
        <Dialog
          onCloseRequest={() => setFolderInfoOpen(false)}
          title="Save folder"
          size="small"
          className="collections-dialog"
        >
          <div className="collections-dialog__content">
            {folderInfo.folderName ? (
              <p>
                Session folder: <strong>{folderInfo.folderName}</strong>
              </p>
            ) : (
              <p>No session folder selected yet. Save a collection first.</p>
            )}
            {folderInfo.fileNames.length > 0 && (
              <>
                <p>Files in this session:</p>
                <ul className="collections-dialog__file-list">
                  {folderInfo.fileNames.map((f) => (
                    <li key={f}>
                      <code>{f}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {folderInfo.osPath && (
              <p>
                Configured OS path: <code>{folderInfo.osPath}</code>
              </p>
            )}
            <p className="collections-dialog__hint">
              Browsers cannot reveal the full folder path automatically. Set the
              optional path above and use{" "}
              <code>open-collections-folder.bat</code> in the project root to
              open it in Explorer.
            </p>
            <div className="collections-dialog__toolbar-actions">
              {folderInfo.folderName && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(folderInfo.folderName!);
                  }}
                >
                  Copy folder name
                </button>
              )}
              {folderInfo.osPath && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(folderInfo.osPath);
                  }}
                >
                  Copy OS path
                </button>
              )}
              <FilledButton
                label="Close"
                onClick={() => setFolderInfoOpen(false)}
              />
            </div>
          </div>
        </Dialog>
      )}

      <UnsavedChangesDialog
        isOpen={unsavedOpen}
        collectionName={activeCollection?.name ?? "Collection"}
        onSaveAndContinue={handleUnsavedSaveAndContinue}
        onDiscard={handleUnsavedDiscard}
        onCancel={() => {
          setUnsavedOpen(false);
          setPendingSwitchId(null);
        }}
        busy={busy}
      />
    </>
  );
};

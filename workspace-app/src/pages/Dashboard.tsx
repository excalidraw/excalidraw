import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { del, get, patch, post } from "../api/client";
import { Modal } from "../components/Modal";
import { formatBytes, timeAgo, useDebounced } from "../components/util";
import { useWorkspace } from "../layout/WorkspaceContext";

import type { SceneSummary } from "../api/types";

type View = "all" | "recent" | "mine" | "shared" | "trash" | "folder";

const TITLES: Record<View, string> = {
  all: "All scenes",
  recent: "Recent",
  mine: "My scenes",
  shared: "Shared with me",
  trash: "Trash",
  folder: "Folder",
};

const PAGE = 24;

export const Dashboard = ({ view }: { view: View }) => {
  const { current, folders, reloadFolders } = useWorkspace();
  const { folderId } = useParams();
  const nav = useNavigate();
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updatedAt" | "createdAt" | "name">(
    "updatedAt",
  );
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [layout, setLayout] = useState<"grid" | "list">(
    () => (localStorage.getItem("ew:layout") as "grid" | "list") || "grid",
  );
  const [dialog, setDialog] = useState<{
    kind: "rename" | "move" | "confirm-purge";
    scene: SceneSummary;
  } | null>(null);
  const dq = useDebounced(q, 250);

  const query = useCallback(
    (offset: number) => {
      if (!current) {
        return null;
      }
      const p = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        sort,
        dir,
      });
      if (dq) {
        p.set("q", dq);
      }
      if (view === "folder" && folderId) {
        p.set("folderId", folderId);
      }
      if (view === "recent" || view === "mine" || view === "trash") {
        p.set("view", view);
      }
      return `/workspaces/${current.id}/scenes?${p}`;
    },
    [current, dq, sort, dir, view, folderId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "shared") {
        setScenes((await get("/scenes/shared")).scenes);
        setHasMore(false);
      } else {
        const url = query(0);
        if (url) {
          const res = await get(url);
          setScenes(res.scenes);
          setHasMore(res.hasMore);
        }
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load scenes");
    } finally {
      setLoading(false);
    }
  }, [query, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    const url = query(scenes.length);
    if (!url) {
      return;
    }
    const res = await get(url);
    setScenes((s) => [...s, ...res.scenes]);
    setHasMore(res.hasMore);
  };

  const newScene = async () => {
    if (!current) {
      return;
    }
    const { scene } = await post(`/workspaces/${current.id}/scenes`, {
      name: "Untitled",
      folderId: view === "folder" ? folderId : null,
    });
    nav(`/scene/${scene.id}`);
  };

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const title =
    view === "folder"
      ? folders.find((f) => f.id === folderId)?.name ?? "Folder"
      : TITLES[view];
  const folderName = (id: string | null) =>
    folders.find((f) => f.id === id)?.name;

  if (!current) {
    return <div className="page pad muted">Loading workspace…</div>;
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <div className="toolbar">
          {view !== "shared" && (
            <input
              className="search"
              type="search"
              placeholder="Search name, text, folder, owner…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search scenes"
            />
          )}
          {view !== "shared" && view !== "recent" && (
            <>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Sort by"
              >
                <option value="updatedAt">Last modified</option>
                <option value="createdAt">Created</option>
                <option value="name">Name</option>
              </select>
              <button
                className="btn"
                onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
                title="Toggle sort order"
                aria-label="Toggle sort order"
              >
                {dir === "asc" ? "↑" : "↓"}
              </button>
            </>
          )}
          <button
            className="btn"
            title="Toggle layout"
            aria-label="Toggle layout"
            onClick={() => {
              const n = layout === "grid" ? "list" : "grid";
              setLayout(n);
              try {
                localStorage.setItem("ew:layout", n);
              } catch {
                /* ignore */
              }
            }}
          >
            {layout === "grid" ? "☰" : "▦"}
          </button>
          {view !== "trash" && view !== "shared" && (
            <button className="btn primary" onClick={newScene}>
              ＋ New scene
            </button>
          )}
        </div>
      </header>

      {view === "trash" && (
        <p className="muted banner">
          Scenes in the trash are permanently removed after 30 days.
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading && scenes.length === 0 ? (
        <div className="muted pad">Loading…</div>
      ) : scenes.length === 0 ? (
        <div className="empty">
          <div className="empty-art">✎</div>
          <h3>
            {dq
              ? "No scenes match your search"
              : view === "trash"
              ? "Trash is empty"
              : "Nothing here yet"}
          </h3>
          {view !== "trash" && view !== "shared" && !dq && (
            <button className="btn primary" onClick={newScene}>
              Create your first scene
            </button>
          )}
        </div>
      ) : (
        <div className={layout === "grid" ? "grid" : "list"}>
          {scenes.map((s) => (
            <article key={s.id} className="scene-card">
              <Link
                to={view === "trash" ? "#" : `/scene/${s.id}`}
                className="thumb"
                aria-label={`Open ${s.name}`}
                onClick={(e) => view === "trash" && e.preventDefault()}
              >
                {s.hasThumbnail ? (
                  <img
                    loading="lazy"
                    alt=""
                    src={`/api/v1/scenes/${s.id}/thumbnail?v=${s.version}`}
                  />
                ) : (
                  <span className="thumb-empty">✎</span>
                )}
              </Link>
              <div className="scene-meta">
                <div className="scene-name ellipsis" title={s.name}>
                  {s.name}
                </div>
                <div className="muted small ellipsis">
                  {s.ownerName ?? ""}
                  {folderName(s.folderId) ? ` · ${folderName(s.folderId)}` : ""}
                  {s.visibility === "private" ? " · 🔒" : ""}
                  {s.access === "VIEW" ? " · view only" : ""}
                </div>
                <div className="muted small">
                  {s.deletedAt
                    ? `Deleted ${timeAgo(s.deletedAt)}`
                    : `Edited ${timeAgo(s.updatedAt)}`}{" "}
                  · {formatBytes(s.sizeBytes)}
                </div>
              </div>
              <details className="menu">
                <summary aria-label={`Actions for ${s.name}`}>⋯</summary>
                <div
                  className="menu-pop"
                  onClick={(e) =>
                    (
                      e.currentTarget.parentElement as HTMLDetailsElement
                    ).removeAttribute("open")
                  }
                >
                  {view === "trash" ? (
                    <>
                      <button
                        onClick={() =>
                          act(() => post(`/scenes/${s.id}/restore`))
                        }
                      >
                        Restore
                      </button>
                      <button
                        className="danger"
                        onClick={() =>
                          setDialog({ kind: "confirm-purge", scene: s })
                        }
                      >
                        Delete forever
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => nav(`/scene/${s.id}`)}>
                        Open
                      </button>
                      {(s.access ?? "OWNER") !== "VIEW" && (
                        <button
                          onClick={() =>
                            setDialog({ kind: "rename", scene: s })
                          }
                        >
                          Rename
                        </button>
                      )}
                      {view !== "shared" && (
                        <button
                          onClick={() => setDialog({ kind: "move", scene: s })}
                        >
                          Move to folder…
                        </button>
                      )}
                      <button
                        onClick={() =>
                          act(async () => {
                            const r = await post(`/scenes/${s.id}/duplicate`);
                            void r;
                          })
                        }
                      >
                        Duplicate
                      </button>
                      {(s.access === undefined || s.access === "OWNER") && (
                        <button
                          className="danger"
                          onClick={() => act(() => del(`/scenes/${s.id}`))}
                        >
                          Move to trash
                        </button>
                      )}
                    </>
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
      {hasMore && (
        <div className="center pad">
          <button className="btn" onClick={loadMore}>
            Load more
          </button>
        </div>
      )}

      {dialog?.kind === "rename" && (
        <RenameDialog
          initial={dialog.scene.name}
          onClose={() => setDialog(null)}
          onSave={(name) =>
            act(() => patch(`/scenes/${dialog.scene.id}`, { name })).then(() =>
              setDialog(null),
            )
          }
        />
      )}
      {dialog?.kind === "move" && (
        <Modal
          title={`Move “${dialog.scene.name}”`}
          onClose={() => setDialog(null)}
        >
          <select
            defaultValue={dialog.scene.folderId ?? ""}
            onChange={(e) =>
              act(() =>
                patch(`/scenes/${dialog.scene.id}`, {
                  folderId: e.target.value || null,
                }),
              ).then(() => {
                setDialog(null);
                void reloadFolders();
              })
            }
          >
            <option value="">No folder (root)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Modal>
      )}
      {dialog?.kind === "confirm-purge" && (
        <Modal title="Delete forever?" onClose={() => setDialog(null)}>
          <p>
            “{dialog.scene.name}” and its images will be permanently deleted.
            This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() =>
                act(() => del(`/scenes/${dialog.scene.id}/permanent`)).then(
                  () => setDialog(null),
                )
              }
            >
              Delete forever
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const RenameDialog = ({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (n: string) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(initial);
  return (
    <Modal title="Rename scene" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave(name.trim());
          }
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
};

import { useCallback, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";

import { post } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Modal } from "../components/Modal";

import { useWorkspace, WorkspaceProvider } from "./WorkspaceContext";

import type { Folder } from "../api/types";

const FolderTree = ({
  folders,
  parent,
  depth,
  wsId,
}: {
  folders: Folder[];
  parent: string | null;
  depth: number;
  wsId: string;
}) => (
  <>
    {folders
      .filter((f) => f.parentId === parent)
      .map((f) => (
        <div key={f.id}>
          <NavLink
            to={`/w/${wsId}/folder/${f.id}`}
            className="nav-item"
            style={{ paddingLeft: 12 + depth * 14 }}
          >
            <span className="ico">▸</span>
            <span className="ellipsis">{f.name}</span>
          </NavLink>
          <FolderTree
            folders={folders}
            parent={f.id}
            depth={depth + 1}
            wsId={wsId}
          />
        </div>
      ))}
  </>
);

const Sidebar = () => {
  const { user, logout, features } = useAuth();
  const multiUser = features?.workspaces !== false;
  const { workspaces, current, folders, select, reload, reloadFolders } =
    useWorkspace();
  const nav = useNavigate();
  const [creating, setCreating] = useState<"workspace" | "folder" | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const create = async () => {
    setErr("");
    try {
      if (creating === "workspace") {
        const { workspace } = await post("/workspaces", { name });
        await reload();
        select(workspace.id);
        nav(`/w/${workspace.id}`);
      } else if (current) {
        await post(`/workspaces/${current.id}/folders`, { name });
        await reloadFolders();
      }
      setCreating(null);
      setName("");
    } catch (e: any) {
      setErr(
        e.code === "folder_exists" ? "That folder already exists." : e.message,
      );
    }
  };

  if (!current) {
    return <aside className="sidebar" />;
  }
  const base = `/w/${current.id}`;
  return (
    <aside className="sidebar">
      <div className="ws-switch">
        <select
          aria-label="Workspace"
          value={current.id}
          onChange={(e) => {
            if (e.target.value === "__new") {
              setCreating("workspace");
              return;
            }
            select(e.target.value);
            nav(`/w/${e.target.value}`);
          }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
          {multiUser && <option value="__new">＋ New workspace…</option>}
        </select>
      </div>
      <nav className="nav">
        <NavLink end to={base} className="nav-item">
          <span className="ico">⌂</span>Home
        </NavLink>
        <NavLink to={`${base}/recent`} className="nav-item">
          <span className="ico">◷</span>Recent
        </NavLink>
        <NavLink to={`${base}/mine`} className="nav-item">
          <span className="ico">◉</span>My scenes
        </NavLink>
        <NavLink to={`${base}/shared`} className="nav-item">
          <span className="ico">⇄</span>Shared with me
        </NavLink>
        <div className="nav-section">
          <span>Folders</span>
          <button
            className="icon-btn"
            title="New folder"
            onClick={() => setCreating("folder")}
          >
            ＋
          </button>
        </div>
        <FolderTree
          folders={folders}
          parent={null}
          depth={0}
          wsId={current.id}
        />
        {folders.length === 0 && (
          <div className="muted small pad">No folders yet</div>
        )}
        <div className="nav-section">
          <span>Workspace</span>
        </div>
        <NavLink to={`${base}/libraries`} className="nav-item">
          <span className="ico">❖</span>Libraries
        </NavLink>
        <NavLink to={`${base}/trash`} className="nav-item">
          <span className="ico">🗑</span>Trash
        </NavLink>
        <NavLink to={`${base}/settings`} className="nav-item">
          <span className="ico">⚙</span>Settings
        </NavLink>
      </nav>
      <div className="user-box">
        <div className="avatar">
          {user?.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="user-meta">
          <div className="ellipsis strong">{user?.displayName}</div>
          <div className="ellipsis muted small">{user?.email}</div>
        </div>
        <button
          className="btn ghost small"
          onClick={() => logout().then(() => nav("/login"))}
        >
          Sign out
        </button>
      </div>
      {creating && (
        <Modal
          title={creating === "workspace" ? "New workspace" : "New folder"}
          onClose={() => setCreating(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              maxLength={80}
              required
            />
            {err && <div className="form-error">{err}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setCreating(null)}
              >
                Cancel
              </button>
              <button className="btn primary">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  );
};

export const Shell = () => {
  const { workspaceId } = useParams();
  const nav = useNavigate();
  const onSelect = useCallback((id: string) => nav(`/w/${id}`), [nav]);
  return (
    <WorkspaceProvider routeId={workspaceId} onSelect={onSelect}>
      <div className="shell">
        <Sidebar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </WorkspaceProvider>
  );
};

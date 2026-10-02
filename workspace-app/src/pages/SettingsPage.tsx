import { useCallback, useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";

import { del, get, patch, post } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AiSettings } from "../components/AiSettings";
import { ApiKeysSettings } from "../components/ApiKeys";
import { timeAgo } from "../components/util";
import { useWorkspace } from "../layout/WorkspaceContext";

import type { Member } from "../api/types";

const TABS = [
  ["profile", "Profile"],
  ["workspace", "Workspace"],
  ["members", "Members"],
  ["ai", "AI"],
  ["keys", "API keys"],
  ["audit", "Audit log"],
] as const;

export const SettingsPage = () => {
  const { tab = "profile", workspaceId } = useParams();
  const { features } = useAuth();
  // single-user mode (ENABLE_WORKSPACES=false) has no member management
  const tabs = TABS.filter(
    ([id]) => id !== "members" || features?.workspaces !== false,
  );
  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <NavLink
            key={id}
            role="tab"
            to={`/w/${workspaceId}/settings/${id}`}
            className={() => (tab === id ? "tab active" : "tab")}
          >
            {label}
          </NavLink>
        ))}
      </div>
      <div className="panel">
        {tab === "profile" && <ProfileTab />}
        {tab === "workspace" && <WorkspaceTab />}
        {tab === "members" && <MembersTab />}
        {tab === "ai" && <AiSettings />}
        {tab === "keys" && <ApiKeysSettings />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
};

const Msg = ({ ok, text }: { ok?: boolean; text: string | null }) =>
  text ? (
    <div className={ok ? "notice" : "form-error"} role="status">
      {text}
    </div>
  ) : null;

const ProfileTab = () => {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = async () => {
    try {
      const r = await patch("/me", {
        displayName,
        avatarUrl: avatarUrl || null,
      });
      setUser(r.user);
      setMsg({ ok: true, text: "Profile updated." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };
  const changePassword = async () => {
    try {
      await post("/me/password", { currentPassword: cur, newPassword: next });
      setCur("");
      setNext("");
      setMsg({
        ok: true,
        text: "Password changed. Other devices were signed out.",
      });
    } catch (e: any) {
      setMsg({
        ok: false,
        text:
          e.code === "invalid_credentials"
            ? "Current password is wrong."
            : e.message,
      });
    }
  };
  return (
    <>
      <Msg ok={msg?.ok} text={msg?.text ?? null} />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveProfile();
        }}
      >
        <h3>Profile</h3>
        <label>
          Email
          <input value={user?.email ?? ""} disabled />
        </label>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label>
          Avatar URL
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <button className="btn primary">Save profile</button>
      </form>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void changePassword();
        }}
      >
        <h3>Change password</h3>
        <label>
          Current password
          <input
            type="password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <button className="btn">Change password</button>
      </form>
    </>
  );
};

const WorkspaceTab = () => {
  const { features } = useAuth();
  const { current, reload } = useWorkspace();
  const nav = useNavigate();
  const [name, setName] = useState(current?.name ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setName(current?.name ?? ""), [current]);
  if (!current) {
    return null;
  }
  const canEdit = current.role !== "MEMBER";
  return (
    <>
      <Msg ok={msg?.ok} text={msg?.text ?? null} />
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await patch(`/workspaces/${current.id}`, { name });
            await reload();
            setMsg({ ok: true, text: "Workspace renamed." });
          } catch (err: any) {
            setMsg({ ok: false, text: err.message });
          }
        }}
      >
        <h3>Workspace</h3>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            maxLength={80}
            required
          />
        </label>
        <label>
          Your role
          <input value={current.role} disabled />
        </label>
        {canEdit && <button className="btn primary">Save</button>}
      </form>
      {current.role === "OWNER" && features?.workspaces !== false && (
        <div className="form danger-zone">
          <h3>Danger zone</h3>
          <p className="muted">
            Deleting a workspace permanently removes all its scenes, folders and
            images.
          </p>
          <button
            className="btn danger"
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete “${current.name}” and everything in it? This cannot be undone.`,
                )
              ) {
                return;
              }
              await del(`/workspaces/${current.id}`);
              await reload();
              nav("/");
            }}
          >
            Delete workspace
          </button>
        </div>
      )}
    </>
  );
};

const MembersTab = () => {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (current) {
      setMembers((await get(`/workspaces/${current.id}/members`)).members);
    }
  }, [current]);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (!current) {
    return null;
  }
  const canManage = current.role !== "MEMBER";
  const run = async (fn: () => Promise<any>) => {
    try {
      const r = await fn();
      if (r?.members) {
        setMembers(r.members);
      } else {
        await load();
      }
      setMsg(null);
    } catch (e: any) {
      setMsg({
        ok: false,
        text:
          e.code === "user_not_found"
            ? "No registered user has that email."
            : e.code === "already_member"
            ? "Already a member."
            : e.message,
      });
    }
  };
  return (
    <>
      <Msg ok={msg?.ok} text={msg?.text ?? null} />
      {canManage && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await post(`/workspaces/${current.id}/members`, {
                email,
                role,
              });
              setEmail("");
              return r;
            });
          }}
        >
          <input
            type="email"
            required
            placeholder="Add member by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            aria-label="Role"
          >
            <option value="MEMBER">Member</option>
            {current.role === "OWNER" && <option value="ADMIN">Admin</option>}
          </select>
          <button className="btn primary">Add</button>
        </form>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId}>
              <td>
                <div className="strong">
                  {m.displayName}
                  {m.userId === user?.id ? " (you)" : ""}
                </div>
                <div className="muted small">{m.email}</div>
              </td>
              <td>
                {canManage &&
                m.role !== "OWNER" &&
                (current.role === "OWNER" || m.role === "MEMBER") ? (
                  <select
                    value={m.role}
                    aria-label={`Role of ${m.displayName}`}
                    onChange={(e) =>
                      run(() =>
                        patch(`/workspaces/${current.id}/members/${m.userId}`, {
                          role: e.target.value,
                        }),
                      )
                    }
                  >
                    <option value="MEMBER">Member</option>
                    {current.role === "OWNER" && (
                      <option value="ADMIN">Admin</option>
                    )}
                  </select>
                ) : (
                  m.role
                )}
              </td>
              <td className="right">
                {m.role !== "OWNER" &&
                  (m.userId === user?.id ||
                    (canManage &&
                      (current.role === "OWNER" || m.role === "MEMBER"))) && (
                    <button
                      className="btn ghost danger small"
                      onClick={() =>
                        run(async () => {
                          await del(
                            `/workspaces/${current.id}/members/${m.userId}`,
                          );
                        })
                      }
                    >
                      {m.userId === user?.id ? "Leave" : "Remove"}
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

const AuditTab = () => {
  const { current } = useWorkspace();
  const [logs, setLogs] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (current) {
      get(`/workspaces/${current.id}/audit`)
        .then((r) => setLogs(r.logs))
        .catch((e) =>
          setErr(
            e.status === 403
              ? "Only admins can view the audit log."
              : e.message,
          ),
        );
    }
  }, [current]);
  if (err) {
    return <p className="muted">{err}</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>When</th>
          <th>Action</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {logs?.map((l) => (
          <tr key={l.id}>
            <td className="muted small">{timeAgo(l.createdAt)}</td>
            <td>
              <code>{l.action}</code>
            </td>
            <td className="muted small">
              {l.targetType ? `${l.targetType} ${l.targetId ?? ""}` : ""}{" "}
              {Object.keys(l.meta ?? {}).length ? JSON.stringify(l.meta) : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

import { useCallback, useEffect, useState } from "react";

import { del, get, post } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../layout/WorkspaceContext";

import { timeAgo } from "./util";

interface Key {
  id: string;
  kind: "personal" | "workspace";
  name: string;
  workspaceId: string | null;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const SCOPES: Array<[string, string]> = [
  ["workspace:read", "Read workspace info and folders"],
  ["scene:read", "Read scenes"],
  ["scene:create", "Create scenes"],
  ["scene:write", "Edit scenes"],
  ["scene:delete", "Move scenes to trash"],
  ["scene:export", "Export scenes"],
  ["diagram:create", "Create diagrams and wireframes"],
];
const PRESETS: Record<string, string[]> = {
  "Read only": ["workspace:read", "scene:read", "scene:export"],
  "Read & write": [
    "workspace:read",
    "scene:read",
    "scene:create",
    "scene:write",
    "scene:export",
    "diagram:create",
  ],
  Everything: SCOPES.map(([s]) => s),
};

const copy = (text: string) =>
  navigator.clipboard?.writeText(text).catch(() => {});

const KeySection = ({
  title,
  description,
  listPath,
  createPath,
  restrictWorkspaceId,
}: {
  title: string;
  description: string;
  listPath: string;
  createPath: string;
  /** personal keys: offer to lock the key to this workspace */
  restrictWorkspaceId?: string;
}) => {
  const { features } = useAuth();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(
    new Set(PRESETS["Read & write"]),
  );
  const [expires, setExpires] = useState("");
  const [restrict, setRestrict] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fresh, setFresh] = useState<{ name: string; secret: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setKeys((await get(listPath)).keys);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }, [listPath]);
  useEffect(() => {
    setKeys(null);
    void load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post(createPath, {
        name,
        scopes: [...scopes],
        ...(expires ? { expiresInDays: Number(expires) } : {}),
        ...(restrictWorkspaceId && restrict
          ? { workspaceId: restrictWorkspaceId }
          : {}),
      });
      setFresh({ name: r.key.name, secret: r.secret });
      setName("");
      await load();
    } catch (e: any) {
      setMsg({
        ok: false,
        text: e.code === "too_many_keys" ? e.message : e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (k: Key) => {
    if (
      !window.confirm(
        `Rotate “${k.name}”? The current secret stops working immediately.`,
      )
    ) {
      return;
    }
    try {
      const r = await post(`/api-keys/${k.id}/rotate`);
      setFresh({ name: r.key.name, secret: r.secret });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };
  const revoke = async (k: Key) => {
    if (
      !window.confirm(
        `Revoke “${k.name}”? Anything using it will lose access immediately.`,
      )
    ) {
      return;
    }
    try {
      await del(`/api-keys/${k.id}`);
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  const baseUrl = window.location.origin;
  const mcpSnippet = fresh
    ? JSON.stringify(
        {
          mcpServers: {
            "excalidraw-workspace": {
              command: "node",
              args: ["<path-to-repo>/server/bin/mcp-stdio.mjs"],
              env: { EW_URL: baseUrl, EW_API_KEY: fresh.secret },
            },
          },
        },
        null,
        2,
      )
    : "";

  return (
    <section className="form">
      <h3>{title}</h3>
      <p className="muted small">{description}</p>
      {msg && (
        <div className={msg.ok ? "notice" : "form-error"} role="status">
          {msg.text}
        </div>
      )}
      {fresh && (
        <div className="secret-box" role="status">
          <strong>
            Copy “{fresh.name}” now — you won’t be able to see it again.
          </strong>
          <div className="row" style={{ marginBottom: 0 }}>
            <input
              readOnly
              className="mono"
              value={fresh.secret}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="New API key"
            />
            <button className="btn small" onClick={() => copy(fresh.secret)}>
              Copy
            </button>
            <button className="btn small ghost" onClick={() => setFresh(null)}>
              Done
            </button>
          </div>
          <details>
            <summary className="small">Use it</summary>
            <pre className="code">{`curl -H "Authorization: Bearer ${fresh.secret}" ${baseUrl}/public/v1/me`}</pre>
            {features?.mcp && (
              <>
                <p className="small muted">
                  MCP client config (e.g. Claude Desktop) — set the path to this
                  repo’s bridge script:
                </p>
                <pre className="code">{mcpSnippet}</pre>
              </>
            )}
          </details>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. “CI bot”"
            required
            maxLength={80}
            aria-label="Key name"
          />
          <select
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            aria-label="Expiry"
          >
            <option value="">No expiry</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
          <button className="btn primary" disabled={busy || scopes.size === 0}>
            Create key
          </button>
        </div>
        <div className="row">
          {Object.entries(PRESETS).map(([label, list]) => (
            <button
              type="button"
              key={label}
              className="btn small"
              onClick={() => setScopes(new Set(list))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="scope-grid">
          {SCOPES.map(([s, label]) => (
            <label key={s} className="check">
              <input
                type="checkbox"
                checked={scopes.has(s)}
                onChange={(e) => {
                  const n = new Set(scopes);
                  if (e.target.checked) {
                    n.add(s);
                  } else {
                    n.delete(s);
                  }
                  setScopes(n);
                }}
              />
              <span>
                <code>{s}</code> <span className="muted small">{label}</span>
              </span>
            </label>
          ))}
        </div>
        {restrictWorkspaceId && (
          <label className="check">
            <input
              type="checkbox"
              checked={restrict}
              onChange={(e) => setRestrict(e.target.checked)}
            />
            Only allow this key to access the current workspace
          </label>
        )}
      </form>
      {keys && keys.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Scopes</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ opacity: k.revokedAt ? 0.5 : 1 }}>
                <td>
                  <div className="strong">{k.name}</div>
                  <div className="muted small mono">{k.prefix}…</div>
                  <div className="muted small">
                    {k.revokedAt
                      ? "Revoked"
                      : k.expiresAt
                      ? `Expires ${new Date(k.expiresAt).toLocaleDateString()}`
                      : "No expiry"}
                  </div>
                </td>
                <td className="small">
                  {k.scopes.map((s) => (
                    <code key={s} className="chip">
                      {s}
                    </code>
                  ))}
                </td>
                <td className="muted small">
                  {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "never"}
                </td>
                <td className="right">
                  {!k.revokedAt && (
                    <>
                      <button
                        className="btn ghost small"
                        onClick={() => void rotate(k)}
                      >
                        Rotate
                      </button>
                      <button
                        className="btn ghost danger small"
                        onClick={() => void revoke(k)}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {keys && keys.length === 0 && <p className="muted small">No keys yet.</p>}
    </section>
  );
};

export const ApiKeysSettings = () => {
  const { current } = useWorkspace();
  if (!current) {
    return null;
  }
  const isAdmin = current.role !== "MEMBER";
  return (
    <>
      <KeySection
        title="Personal API keys"
        description="Act as you, with your own permissions. Use them for scripts and personal tools."
        listPath="/me/api-keys"
        createPath="/me/api-keys"
        restrictWorkspaceId={current.id}
      />
      {isAdmin ? (
        <KeySection
          title={`Workspace API keys — ${current.name}`}
          description="Service keys for integrations and AI agents. They can only reach this workspace's shared scenes (never private ones) and stop working if their creator leaves the workspace."
          listPath={`/workspaces/${current.id}/api-keys`}
          createPath={`/workspaces/${current.id}/api-keys`}
        />
      ) : (
        <p className="muted small">
          Workspace keys are managed by workspace admins.
        </p>
      )}
    </>
  );
};

import { useCallback, useEffect, useState } from "react";

import { get, post, put } from "../api/client";
import { useWorkspace } from "../layout/WorkspaceContext";

import type { Member } from "../api/types";

interface ProviderInfo {
  id: string;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string | null;
  needsKey: boolean;
  customBaseUrl: boolean;
}

interface View {
  configured: boolean;
  source: string;
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string | null;
  keySource: "workspace" | "instance" | "none";
  keyLast4: string | null;
  workspaceDailyLimit: number | null;
  userDailyLimit: number | null;
  effectiveLimits: { workspace: number; user: number };
  allowedMembers: "all" | string[];
  instanceDefaults: { provider: string | null; hasKey: boolean };
}

const limitLabel = (n: number) => (n === 0 ? "unlimited" : String(n));

export const AiSettings = () => {
  const { current } = useWorkspace();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [usage, setUsage] = useState<{
    workspace: number;
    perUser: { userId: string; count: number }[];
  } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [wsLimit, setWsLimit] = useState("");
  const [userLimit, setUserLimit] = useState("");
  const [everyone, setEveryone] = useState(true);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  const apply = useCallback((v: View) => {
    setView(v);
    setEnabled(v.enabled);
    setProvider(v.provider);
    setModel(v.model);
    setBaseUrl(v.baseUrl ?? "");
    setWsLimit(
      v.workspaceDailyLimit === null ? "" : String(v.workspaceDailyLimit),
    );
    setUserLimit(v.userDailyLimit === null ? "" : String(v.userDailyLimit));
    setEveryone(v.allowedMembers === "all");
    setAllowed(new Set(v.allowedMembers === "all" ? [] : v.allowedMembers));
    setApiKey("");
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }
    Promise.all([
      get("/ai/providers"),
      get(`/workspaces/${current.id}/ai/settings`),
      get(`/workspaces/${current.id}/members`),
      get(`/workspaces/${current.id}/ai/usage`),
    ])
      .then(([p, s, m, u]) => {
        setProviders(p.providers);
        apply(s);
        setMembers(m.members);
        setUsage(u);
      })
      .catch((e) =>
        setMsg({
          ok: false,
          text:
            e.status === 403
              ? "Only workspace admins can manage AI settings."
              : e.message,
        }),
      );
  }, [current, apply]);

  if (!current || !view) {
    return msg ? (
      <div className="form-error">{msg.text}</div>
    ) : (
      <p className="muted">Loading…</p>
    );
  }
  const info = providers.find((p) => p.id === provider);

  const num = (s: string) =>
    s.trim() === "" ? null : Math.max(0, Math.floor(Number(s)));

  const save = async (extra: object = {}) => {
    setBusy(true);
    setMsg(null);
    try {
      const v: View = await put(`/workspaces/${current.id}/ai/settings`, {
        enabled,
        provider,
        model: model.trim() || undefined,
        baseUrl: info?.customBaseUrl ? baseUrl.trim() || null : undefined,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        workspaceDailyLimit: num(wsLimit),
        userDailyLimit: num(userLimit),
        allowedMembers: everyone ? "all" : [...allowed],
        ...extra,
      });
      apply(v);
      setMsg({ ok: true, text: "AI settings saved." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post(`/workspaces/${current.id}/ai/test`);
      setMsg({
        ok: true,
        text: `Connection works (${r.provider} · ${r.model}).`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {msg && (
        <div className={msg.ok ? "notice" : "form-error"} role="status">
          {msg.text}
        </div>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h3>AI diagram generation</h3>
        <p className="muted small">
          Members can turn a text description into an editable diagram. Requests
          go from this server straight to the provider you choose; nothing is
          sent to Excalidraw. Converting Mermaid to a diagram never uses AI.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable AI in this workspace
        </label>
        <label>
          Provider
          <select
            value={provider}
            onChange={(e) => {
              const p = providers.find((x) => x.id === e.target.value);
              setProvider(e.target.value);
              setModel(p?.defaultModel ?? "");
              setBaseUrl("");
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={info?.defaultModel}
            maxLength={200}
          />
        </label>
        {info?.customBaseUrl && (
          <label>
            Endpoint URL
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={info.defaultBaseUrl ?? ""}
            />
            <small className="muted">
              OpenAI-compatible base URL. Cloud-metadata and link-local
              addresses are always blocked.
            </small>
          </label>
        )}
        {(info?.needsKey ?? true) && (
          <label>
            API key (bring your own)
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder={
                view.keySource === "workspace"
                  ? `Saved · ends in ${view.keyLast4} — leave blank to keep`
                  : view.keySource === "instance"
                  ? "Using the server's default key — paste one to override"
                  : "Paste a key"
              }
            />
            <small className="muted">
              Stored encrypted on the server and never shown again or sent to
              browsers.
            </small>
          </label>
        )}
        {view.keySource === "workspace" && (
          <button
            type="button"
            className="btn ghost danger small"
            onClick={() => void save({ clearApiKey: true })}
          >
            Remove saved key
          </button>
        )}
        <div className="row">
          <label style={{ flex: 1 }}>
            Requests per day — workspace
            <input
              type="number"
              min={0}
              value={wsLimit}
              onChange={(e) => setWsLimit(e.target.value)}
              placeholder={`default: ${limitLabel(
                view.effectiveLimits.workspace,
              )}`}
            />
          </label>
          <label style={{ flex: 1 }}>
            Requests per day — each member
            <input
              type="number"
              min={0}
              value={userLimit}
              onChange={(e) => setUserLimit(e.target.value)}
              placeholder={`default: ${limitLabel(view.effectiveLimits.user)}`}
            />
          </label>
        </div>
        <small className="muted">
          Empty = server default · 0 = unlimited. Counted per UTC day; failed
          requests are not counted.
        </small>
        <fieldset className="fieldset">
          <legend>Who can use AI</legend>
          <label className="check">
            <input
              type="radio"
              checked={everyone}
              onChange={() => setEveryone(true)}
            />{" "}
            All workspace members
          </label>
          <label className="check">
            <input
              type="radio"
              checked={!everyone}
              onChange={() => setEveryone(false)}
            />{" "}
            Only selected members (admins always can)
          </label>
          {!everyone && (
            <div className="checklist">
              {members
                .filter((m) => m.role === "MEMBER")
                .map((m) => (
                  <label key={m.userId} className="check">
                    <input
                      type="checkbox"
                      checked={allowed.has(m.userId)}
                      onChange={(e) => {
                        const n = new Set(allowed);
                        if (e.target.checked) {
                          n.add(m.userId);
                        } else {
                          n.delete(m.userId);
                        }
                        setAllowed(n);
                      }}
                    />
                    {m.displayName}{" "}
                    <span className="muted small">{m.email}</span>
                  </label>
                ))}
              {members.every((m) => m.role !== "MEMBER") && (
                <span className="muted small">No regular members yet.</span>
              )}
            </div>
          )}
        </fieldset>
        <div className="row" style={{ marginBottom: 0 }}>
          <button className="btn primary" disabled={busy}>
            Save
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !view.configured}
            onClick={() => void test()}
          >
            Test connection
          </button>
          <span className="muted small">
            {view.configured ? "Configured" : "Not configured yet"}
          </span>
        </div>
      </form>
      {usage && (
        <div className="form">
          <h3>Usage today</h3>
          <p>
            <strong>{usage.workspace}</strong> workspace request
            {usage.workspace === 1 ? "" : "s"} of{" "}
            {limitLabel(view.effectiveLimits.workspace)}
          </p>
          {usage.perUser.length > 0 && (
            <ul className="people">
              {usage.perUser.map((u) => (
                <li key={u.userId}>
                  <span>
                    {members.find((m) => m.userId === u.userId)?.displayName ??
                      u.userId}
                  </span>
                  <span className="muted">
                    {u.count} / {limitLabel(view.effectiveLimits.user)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
};

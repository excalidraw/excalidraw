import { useCallback, useEffect, useState } from "react";

import { ApiError, del, get, patch, post, put } from "../api/client";

import { Modal } from "./Modal";

import type { SceneFull, ShareState } from "../api/types";

const linkUrl = (token: string, kind: "share" | "embed" = "share") =>
  `${window.location.origin}/${kind}/${token}`;

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const ShareDialog = ({
  scene,
  onClose,
  onVisibilityChange,
}: {
  scene: Pick<SceneFull, "id" | "name" | "visibility">;
  onClose: () => void;
  onVisibilityChange: (v: "workspace" | "private") => void;
}) => {
  const [state, setState] = useState<ShareState | null>(null);
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"VIEW" | "EDIT">("VIEW");
  const [linkLevel, setLinkLevel] = useState<"VIEW" | "EDIT">("VIEW");
  const [expires, setExpires] = useState<number | "">("");
  const [visibility, setVisibility] = useState(scene.visibility);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await get(`/scenes/${scene.id}/shares`));
    } catch (e: any) {
      setError(
        e instanceof ApiError && e.status === 403
          ? "Only the scene owner can manage sharing."
          : e.message,
      );
    }
  }, [scene.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<any>) => {
    setError(null);
    try {
      const res = await fn();
      if (res?.permissions) {
        setState(res);
      } else {
        await load();
      }
    } catch (e: any) {
      setError(
        e.code === "user_not_found" ? "No user with that email." : e.message,
      );
    }
  };

  const doCopy = async (key: string, text: string) => {
    if (await copy(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <Modal title={`Share “${scene.name}”`} onClose={onClose} wide>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {!state ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="share">
          <section>
            <h3>Visibility</h3>
            <select
              value={visibility}
              onChange={(e) => {
                const v = e.target.value as typeof visibility;
                void run(async () => {
                  await patch(`/scenes/${scene.id}`, { visibility: v });
                  setVisibility(v);
                  onVisibilityChange(v);
                });
              }}
            >
              <option value="workspace">
                Everyone in the workspace can edit
              </option>
              <option value="private">Private — only people below</option>
            </select>
          </section>

          <section>
            <h3>People</h3>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await put(`/scenes/${scene.id}/permissions`, {
                    email,
                    level,
                  });
                  setEmail("");
                  return r;
                });
              }}
            >
              <input
                type="email"
                required
                placeholder="Invite by email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                aria-label="Permission"
              >
                <option value="VIEW">Can view</option>
                <option value="EDIT">Can edit</option>
              </select>
              <button className="btn primary">Invite</button>
            </form>
            <ul className="people">
              {state.permissions.map((p) => (
                <li key={p.userId}>
                  <div>
                    <div className="strong">{p.displayName}</div>
                    <div className="muted small">{p.email}</div>
                  </div>
                  <select
                    value={p.level}
                    aria-label={`Permission for ${p.displayName}`}
                    onChange={(e) =>
                      run(() =>
                        put(`/scenes/${scene.id}/permissions`, {
                          email: p.email,
                          level: e.target.value,
                        }),
                      )
                    }
                  >
                    <option value="VIEW">Can view</option>
                    <option value="EDIT">Can edit</option>
                  </select>
                  <button
                    className="btn ghost danger small"
                    onClick={() =>
                      run(() =>
                        del(`/scenes/${scene.id}/permissions/${p.userId}`).then(
                          () => get(`/scenes/${scene.id}/shares`),
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
              {state.permissions.length === 0 && (
                <li className="muted small">Not shared with anyone yet.</li>
              )}
            </ul>
          </section>

          <section>
            <h3>Links</h3>
            <div className="row">
              <select
                value={linkLevel}
                onChange={(e) => setLinkLevel(e.target.value as any)}
                aria-label="Link permission"
              >
                <option value="VIEW">Anyone with the link can view</option>
                <option value="EDIT">Anyone with the link can edit</option>
              </select>
              <select
                value={expires}
                onChange={(e) =>
                  setExpires(e.target.value ? Number(e.target.value) : "")
                }
                aria-label="Expiry"
              >
                <option value="">Never expires</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
              <button
                className="btn primary"
                onClick={() =>
                  run(() =>
                    post(`/scenes/${scene.id}/links`, {
                      level: linkLevel,
                      expiresInDays: expires || undefined,
                    }),
                  )
                }
              >
                Create link
              </button>
            </div>
            <ul className="people">
              {state.links.map((l) => (
                <li key={l.id} className="link-row">
                  <div className="grow">
                    <div className="strong">
                      {l.level === "EDIT" ? "Edit link" : "View-only link"}
                    </div>
                    <input
                      readOnly
                      className="mono"
                      value={linkUrl(l.token)}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Link URL"
                    />
                    <div className="muted small">
                      {l.expiresAt
                        ? `Expires ${new Date(
                            l.expiresAt,
                          ).toLocaleDateString()}`
                        : "No expiry"}
                    </div>
                  </div>
                  <div className="stack">
                    <button
                      className="btn small"
                      onClick={() => doCopy(l.id, linkUrl(l.token))}
                    >
                      {copied === l.id ? "Copied ✓" : "Copy link"}
                    </button>
                    {l.level === "VIEW" && (
                      <button
                        className="btn small"
                        onClick={() =>
                          doCopy(
                            `${l.id}e`,
                            `<iframe src="${linkUrl(
                              l.token,
                              "embed",
                            )}" width="800" height="600" style="border:0" allowfullscreen></iframe>`,
                          )
                        }
                      >
                        {copied === `${l.id}e` ? "Copied ✓" : "Copy embed"}
                      </button>
                    )}
                    <button
                      className="btn ghost danger small"
                      onClick={() =>
                        run(() =>
                          del(`/scenes/${scene.id}/links/${l.id}`).then(() =>
                            get(`/scenes/${scene.id}/shares`),
                          ),
                        )
                      }
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
              {state.links.length === 0 && (
                <li className="muted small">No active links.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
};

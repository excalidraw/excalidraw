import http from "node:http";

import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { authed, makeTestApp, register } from "./helpers";

import type { AddressInfo } from "node:net";
import type { TestApp } from "./helpers";

// tiny OpenAI-compatible server so `prompt` diagrams can be tested end to end
let llmHits = 0;
const llm = http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    llmHits++;
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content:
                "```mermaid\nflowchart LR\nA[From AI] --> B[Result]\n```",
            },
          },
        ],
      })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({
        choices: [{ delta: {}, finish_reason: "stop" }],
      })}\n\ndata: [DONE]\n\n`,
    );
    res.end();
  });
});

let t: TestApp;
let port: number;
let llmUrl = "";
beforeAll(async () => {
  await new Promise<void>((r) => llm.listen(0, "127.0.0.1", r));
  llmUrl = `http://127.0.0.1:${(llm.address() as AddressInfo).port}/v1`;
  t = await makeTestApp();
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  port = (t.app.server.address() as AddressInfo).port;
});
afterAll(async () => {
  await t.close();
  llm.closeAllConnections();
  await new Promise((r) => llm.close(r));
});

const call = (
  cookie: string | undefined,
  method: string,
  url: string,
  payload?: unknown,
) =>
  t.app.inject({
    method: method as any,
    url: `/api/v1${url}`,
    headers: authed(cookie),
    payload: payload as any,
  });

/** Public API call with a bearer key and NO cookie / CSRF header. */
const api = (
  key: string | null,
  method: string,
  url: string,
  payload?: unknown,
  app: TestApp = t,
) =>
  app.app.inject({
    method: method as any,
    url: `/public/v1${url}`,
    headers: key ? { authorization: `Bearer ${key}` } : {},
    payload: payload as any,
  });

/** keys are ewk_<10 chars>_<43 chars>; base64url can contain '_' so never split on it */
const secretPart = (k: string) => k.slice(15);
const prefixOf = (k: string) => k.slice(0, 14);

const ALL = [
  "workspace:read",
  "scene:read",
  "scene:create",
  "scene:write",
  "scene:delete",
  "scene:export",
  "diagram:create",
];

const setup = async () => {
  const owner = await register(t);
  const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  const mkKey = async (
    over: object = {},
    path = `/workspaces/${ws.id}/api-keys`,
  ) => {
    const res = await call(owner.cookie, "POST", path, {
      name: "test",
      scopes: ALL,
      ...over,
    });
    return { res, secret: res.json().secret as string, key: res.json().key };
  };
  return { owner, ws, mkKey };
};

const el = (id: string, extra: object = {}) => ({
  id,
  type: "rectangle",
  version: 1,
  versionNonce: 1,
  x: 0,
  y: 0,
  width: 50,
  height: 30,
  isDeleted: false,
  ...extra,
});

describe("key lifecycle and secrecy", () => {
  it("returns the secret exactly once and never stores or logs it", async () => {
    const { owner, ws, mkKey } = await setup();
    const { res, secret, key } = await mkKey({ name: "CI bot" });
    expect(res.statusCode).toBe(201);
    expect(secret).toMatch(/^ewk_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]{43}$/);
    expect(key).toMatchObject({
      name: "CI bot",
      kind: "workspace",
      workspaceId: ws.id,
    });
    expect(JSON.stringify(key)).not.toContain(secretPart(secret));

    const list = (
      await call(owner.cookie, "GET", `/workspaces/${ws.id}/api-keys`)
    ).json();
    expect(list.keys).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(secretPart(secret));

    const raw = await t.database.c.apiKeys.findOne({});
    expect(JSON.stringify(raw)).not.toContain(secretPart(secret));
    expect(raw!.secretHash).toMatch(/^[0-9a-f]{64}$/);

    const logs = JSON.stringify(
      (await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`)).json()
        .logs,
    );
    expect(logs).toContain("API_KEY_CREATED");
    expect(logs).not.toContain(secretPart(secret));
  });

  it("validates scopes and enforces who may create workspace keys", async () => {
    const { owner, ws, mkKey } = await setup();
    const member = await register(t);
    const outsider = await register(t);
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: member.body.email,
    });
    expect(
      (await mkKey({ scopes: ["scene:read", "root:everything"] })).res
        .statusCode,
    ).toBe(400);
    expect((await mkKey({ scopes: [] })).res.statusCode).toBe(400);
    expect((await mkKey({ name: "" })).res.statusCode).toBe(400);
    expect(
      (
        await call(member.cookie, "POST", `/workspaces/${ws.id}/api-keys`, {
          name: "x",
          scopes: ["scene:read"],
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call(member.cookie, "GET", `/workspaces/${ws.id}/api-keys`))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await call(outsider.cookie, "POST", `/workspaces/${ws.id}/api-keys`, {
          name: "x",
          scopes: ["scene:read"],
        })
      ).statusCode,
    ).toBe(404);
    // members can still hold personal keys
    expect(
      (
        await call(member.cookie, "POST", "/me/api-keys", {
          name: "mine",
          scopes: ["scene:read"],
        })
      ).statusCode,
    ).toBe(201);
  });

  it("caps active keys per owner", async () => {
    const u = await register(t);
    for (let i = 0; i < 25; i++) {
      expect(
        (
          await call(u.cookie, "POST", "/me/api-keys", {
            name: `k${i}`,
            scopes: ["scene:read"],
          })
        ).statusCode,
      ).toBe(201);
    }
    const over = await call(u.cookie, "POST", "/me/api-keys", {
      name: "k26",
      scopes: ["scene:read"],
    });
    expect(over.statusCode).toBe(409);
    expect(over.json().error).toBe("too_many_keys");
  });

  it("rotate replaces the secret immediately; revoke kills the key; others cannot manage it", async () => {
    const { owner, ws, mkKey } = await setup();
    const other = await register(t);
    const { secret, key } = await mkKey();
    expect((await api(secret, "GET", "/me")).statusCode).toBe(200);

    const rotated = (
      await call(owner.cookie, "POST", `/api-keys/${key.id}/rotate`)
    ).json();
    expect(rotated.key.id).toBe(key.id);
    expect(rotated.secret).not.toBe(secret);
    expect((await api(secret, "GET", "/me")).statusCode).toBe(401); // old secret dead at once
    expect((await api(rotated.secret, "GET", "/me")).statusCode).toBe(200);

    expect(
      (await call(other.cookie, "DELETE", `/api-keys/${key.id}`)).statusCode,
    ).toBe(404);
    expect(
      (await call(owner.cookie, "DELETE", `/api-keys/${key.id}`)).statusCode,
    ).toBe(204);
    expect((await api(rotated.secret, "GET", "/me")).statusCode).toBe(401);
    expect(
      (await call(owner.cookie, "POST", `/api-keys/${key.id}/rotate`))
        .statusCode,
    ).toBe(409);
    const logs = (await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`))
      .json()
      .logs.map((l: any) => l.action);
    expect(logs).toEqual(
      expect.arrayContaining([
        "API_KEY_CREATED",
        "API_KEY_ROTATED",
        "API_KEY_REVOKED",
      ]),
    );
  });

  it("personal keys are private to their owner", async () => {
    const a = await register(t);
    const b = await register(t);
    const k = (
      await call(a.cookie, "POST", "/me/api-keys", {
        name: "mine",
        scopes: ["scene:read"],
      })
    ).json().key;
    expect((await call(b.cookie, "GET", "/me/api-keys")).json().keys).toEqual(
      [],
    );
    expect(
      (await call(b.cookie, "DELETE", `/api-keys/${k.id}`)).statusCode,
    ).toBe(404);
  });

  it("records last use", async () => {
    const { mkKey } = await setup();
    const { secret, key } = await mkKey();
    await api(secret, "GET", "/me");
    await new Promise((r) => setTimeout(r, 100));
    expect(
      (await t.database.c.apiKeys.findOne({ _id: new ObjectId(key.id) }))!
        .lastUsedAt,
    ).toBeInstanceOf(Date);
  });
});

describe("authentication", () => {
  it("rejects missing, malformed, unknown, revoked and expired keys with one identical response", async () => {
    const { mkKey, owner, ws } = await setup();
    const good = await mkKey();
    const expired = await mkKey({ expiresInDays: 1 });
    await t.database.c.apiKeys.updateOne(
      { _id: new ObjectId(expired.key.id) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const revoked = await mkKey();
    await call(owner.cookie, "DELETE", `/api-keys/${revoked.key.id}`);
    const wrongSecret = `${prefixOf(good.secret)}_${"A".repeat(43)}`;

    const bodies = new Set<string>();
    for (const k of [
      null,
      "garbage",
      "ewk_short",
      wrongSecret,
      `ewk_${"x".repeat(10)}_${"y".repeat(43)}`,
      expired.secret,
      revoked.secret,
    ]) {
      const r = await api(k, "GET", "/me");
      expect(r.statusCode, String(k)).toBe(401);
      expect(r.headers["www-authenticate"]).toContain("Bearer");
      bodies.add(r.body);
    }
    expect(bodies.size).toBe(1);
    expect((await api(good.secret, "GET", "/me")).statusCode).toBe(200);
    void ws;
  });

  it("a browser session cookie does not authenticate the public API", async () => {
    const { owner, ws } = await setup();
    const res = await t.app.inject({
      method: "GET",
      url: "/public/v1/scenes",
      headers: authed(owner.cookie),
    });
    expect(res.statusCode).toBe(401);
    void ws;
  });

  it("keys die with their owner's disabled account or lost membership", async () => {
    const { owner, ws } = await setup();
    const member = await register(t);
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: member.body.email,
      role: "ADMIN",
    });
    const wk = (
      await call(member.cookie, "POST", `/workspaces/${ws.id}/api-keys`, {
        name: "svc",
        scopes: ALL,
      })
    ).json().secret;
    const pk = (
      await call(member.cookie, "POST", "/me/api-keys", {
        name: "mine",
        scopes: ALL,
      })
    ).json().secret;
    expect((await api(wk, "GET", "/workspace")).statusCode).toBe(200);
    // removed from the workspace -> its service key stops working; personal key still works elsewhere
    await call(
      owner.cookie,
      "DELETE",
      `/workspaces/${ws.id}/members/${member.res.json().user.id}`,
    );
    expect((await api(wk, "GET", "/workspace")).statusCode).toBe(401);
    expect((await api(pk, "GET", "/me")).statusCode).toBe(200);
    await t.database.c.users.updateOne(
      { emailLower: member.body.email },
      { $set: { status: "disabled" } },
    );
    expect((await api(pk, "GET", "/me")).statusCode).toBe(401);
  });

  it("bearer requests need no CSRF header, and a browser cookie next to a key is simply ignored", async () => {
    const { owner, mkKey } = await setup();
    const other = await register(t);
    const { secret } = await mkKey();
    expect(
      (await api(secret, "POST", "/scenes", { name: "no csrf header" }))
        .statusCode,
    ).toBe(201);
    // cookie of a DIFFERENT user next to the key: the key's identity wins, the cookie has no effect
    const mixed = await t.app.inject({
      method: "POST",
      url: "/public/v1/scenes",
      headers: {
        authorization: `Bearer ${secret}`,
        cookie: `ew_session=${other.cookie}`,
      },
      payload: { name: "mixed" },
    });
    expect(mixed.statusCode).toBe(201);
    const ownerId = owner.res.json().user.id;
    expect(mixed.json().scene.ownerId).toBe(ownerId);
    // and with no key at all, a cookie never authenticates
    const cookieOnly = await t.app.inject({
      method: "POST",
      url: "/public/v1/scenes",
      headers: { cookie: `ew_session=${owner.cookie}` },
      payload: { name: "x" },
    });
    expect(cookieOnly.statusCode).toBe(401);
  });
});

describe("scopes", () => {
  it("every operation requires its own scope", async () => {
    const { mkKey } = await setup();
    const full = await mkKey();
    const table: Array<[string, string, (id: string) => string, unknown?]> = [
      ["workspace:read", "GET", () => "/workspace"],
      ["scene:read", "GET", () => "/scenes"],
      ["scene:read", "GET", (id) => `/scenes/${id}`],
      ["scene:create", "POST", () => "/scenes", { name: "n" }],
      [
        "scene:write",
        "PUT",
        (id) => `/scenes/${id}/data`,
        { baseVersion: 1, elements: [] },
      ],
      [
        "scene:write",
        "POST",
        (id) => `/scenes/${id}/elements`,
        { elements: [el("a")] },
      ],
      ["scene:export", "GET", (id) => `/scenes/${id}/export`],
      ["scene:delete", "DELETE", (id) => `/scenes/${id}`],
      [
        "diagram:create",
        "POST",
        () => "/diagrams/mermaid",
        { source: "graph TD\nA-->B" },
      ],
      [
        "diagram:create",
        "POST",
        (id) => `/scenes/${id}/diagram`,
        { mermaid: "graph TD\nA-->B" },
      ],
    ];
    for (const [scope, method, urlOf, body] of table) {
      // a fresh scene per row: earlier rows (e.g. delete) must not affect later ones
      const url = urlOf(
        (await api(full.secret, "POST", "/scenes", { name: "s" })).json().scene
          .id,
      );
      const without = await mkKey({ scopes: ALL.filter((s) => s !== scope) });
      const r = await api(without.secret, method, url, body);
      expect(r.statusCode, `${method} ${url} without ${scope}`).toBe(403);
      expect(r.json().error).toBe("insufficient_scope");
      const only = await mkKey({
        scopes: [
          scope,
          ...(scope === "diagram:create" && url.includes("/scenes/")
            ? ["scene:write"]
            : []),
        ],
      });
      const ok = await api(only.secret, method, url, body);
      expect(ok.statusCode, `${method} ${url} with ${scope}`).toBeLessThan(300);
    }
  });
});

describe("workspace confinement", () => {
  it("a workspace key sees only its workspace's shared scenes", async () => {
    const a = await setup();
    const b = await setup();
    const ka = await a.mkKey();
    const kb = await b.mkKey();
    const sa = (
      await api(ka.secret, "POST", "/scenes", { name: "A scene" })
    ).json().scene;
    const priv = (
      await call(a.owner.cookie, "POST", `/workspaces/${a.ws.id}/scenes`, {
        name: "private",
        visibility: "private",
      })
    ).json().scene;

    // other workspace's key: uniform 404 for everything
    for (const [m, u] of [
      ["GET", `/scenes/${sa.id}`],
      ["GET", `/scenes/${sa.id}/export`],
      ["DELETE", `/scenes/${sa.id}`],
    ] as const) {
      expect((await api(kb.secret, m, u)).statusCode, `${m} ${u}`).toBe(404);
    }
    expect(
      (
        await api(kb.secret, "PUT", `/scenes/${sa.id}/data`, {
          baseVersion: 1,
          elements: [],
        })
      ).statusCode,
    ).toBe(404);
    expect((await api(kb.secret, "GET", "/scenes")).json().scenes).toEqual([]);
    expect(
      (await api(kb.secret, "GET", `/workspace?workspaceId=${a.ws.id}`))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await api(kb.secret, "POST", "/scenes", {
          workspaceId: a.ws.id,
          name: "sneaky",
        })
      ).statusCode,
    ).toBe(403);
    // private scenes are invisible even inside the workspace
    expect((await api(ka.secret, "GET", `/scenes/${priv.id}`)).statusCode).toBe(
      404,
    );
    expect(
      (await api(ka.secret, "GET", "/scenes"))
        .json()
        .scenes.map((s: any) => s.name),
    ).toEqual(["A scene"]);
  });

  it("personal keys act as their owner: need workspaceId, honour membership and private scenes", async () => {
    const a = await setup();
    const b = await setup();
    const pk = (
      await call(a.owner.cookie, "POST", "/me/api-keys", {
        name: "p",
        scopes: ALL,
      })
    ).json().secret;
    expect((await api(pk, "GET", "/scenes")).statusCode).toBe(400); // ambiguous workspace
    expect(
      (await api(pk, "GET", `/scenes?workspaceId=${b.ws.id}`)).statusCode,
    ).toBe(404); // not a member there
    const priv = (
      await call(a.owner.cookie, "POST", `/workspaces/${a.ws.id}/scenes`, {
        name: "mine only",
        visibility: "private",
      })
    ).json().scene;
    expect((await api(pk, "GET", `/scenes/${priv.id}`)).statusCode).toBe(200); // owner may read own private scene
    const list = (await api(pk, "GET", `/scenes?workspaceId=${a.ws.id}`))
      .json()
      .scenes.map((s: any) => s.name);
    expect(list).toContain("mine only");

    // restricting the key to one workspace makes any other id a hard error
    const restricted = (
      await call(a.owner.cookie, "POST", "/me/api-keys", {
        name: "r",
        scopes: ALL,
        workspaceId: a.ws.id,
      })
    ).json().secret;
    expect((await api(restricted, "GET", "/scenes")).statusCode).toBe(200);
    expect(
      (await api(restricted, "GET", `/scenes?workspaceId=${b.ws.id}`))
        .statusCode,
    ).toBe(403);
  });

  it("a personal key cannot exceed its owner's rights on shared scenes", async () => {
    const a = await setup();
    const viewer = await register(t);
    const scene = (
      await call(a.owner.cookie, "POST", `/workspaces/${a.ws.id}/scenes`, {
        name: "shared",
        visibility: "private",
      })
    ).json().scene;
    await call(a.owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: viewer.body.email,
      level: "VIEW",
    });
    const vk = (
      await call(viewer.cookie, "POST", "/me/api-keys", {
        name: "v",
        scopes: ALL,
      })
    ).json().secret;
    expect((await api(vk, "GET", `/scenes/${scene.id}`)).statusCode).toBe(200);
    expect(
      (
        await api(vk, "PUT", `/scenes/${scene.id}/data`, {
          baseVersion: 1,
          elements: [el("x")],
        })
      ).statusCode,
    ).toBe(403); // VIEW grant + write scope != write
    expect(
      (
        await api(vk, "POST", `/scenes/${scene.id}/elements`, {
          elements: [el("x")],
        })
      ).statusCode,
    ).toBe(403);
    expect((await api(vk, "DELETE", `/scenes/${scene.id}`)).statusCode).toBe(
      403,
    );
  });
});

describe("operations", () => {
  it("create / read / list / search / delete", async () => {
    const { mkKey, ws } = await setup();
    const { secret } = await mkKey();
    const folder = (
      await t.app.inject({
        method: "GET",
        url: "/public/v1/workspace",
        headers: { authorization: `Bearer ${secret}` },
      })
    ).json();
    expect(folder.workspace.id).toBe(ws.id);
    const made = await api(secret, "POST", "/scenes", {
      name: "Roadmap",
      data: {
        elements: [el("a", { type: "text", text: "quarterly plan" })],
        appState: { viewBackgroundColor: "#fff", evil: 1 },
      },
    });
    expect(made.statusCode).toBe(201);
    const id = made.json().scene.id;
    const got = (await api(secret, "GET", `/scenes/${id}`)).json().scene;
    expect(got.data.elements).toHaveLength(1);
    expect(got.data.appState).toEqual({ viewBackgroundColor: "#fff" });
    expect(
      (await api(secret, "GET", "/scenes?q=quarterly"))
        .json()
        .scenes.map((s: any) => s.id),
    ).toEqual([id]);
    expect(
      (await api(secret, "GET", "/scenes?q=.*")).json().scenes,
    ).toHaveLength(0);
    expect((await api(secret, "DELETE", `/scenes/${id}`)).statusCode).toBe(204);
    expect((await api(secret, "GET", `/scenes/${id}`)).statusCode).toBe(404);
    expect(
      (
        await api(secret, "POST", "/scenes", {
          name: "x",
          folderId: new ObjectId().toHexString(),
        })
      ).statusCode,
    ).toBe(404);
  });

  it("replace uses optimistic versions and tombstones removed elements", async () => {
    const { mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (
      await api(secret, "POST", "/scenes", {
        data: { elements: [el("keep"), el("drop")], appState: {} },
      })
    ).json().scene.id;
    const ok = await api(secret, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [el("keep", { version: 2 }), el("new")],
    });
    expect(ok.statusCode).toBe(200);
    const els = (await api(secret, "GET", `/scenes/${id}`)).json().scene.data
      .elements;
    const drop = els.find((e: any) => e.id === "drop");
    expect(drop.isDeleted).toBe(true);
    expect(drop.version).toBe(2);
    const stale = await api(secret, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [],
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: "version_conflict",
      version: 2,
    });
  });

  it("append merges by version and survives concurrent writers", async () => {
    const { mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (
      await api(secret, "POST", "/scenes", {
        data: { elements: [el("a")], appState: {} },
      })
    ).json().scene.id;
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        api(secret, "POST", `/scenes/${id}/elements`, {
          elements: [el(`n${i}`)],
        }),
      ),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const els = (await api(secret, "GET", `/scenes/${id}`)).json().scene.data
      .elements;
    expect(els.map((e: any) => e.id).sort()).toEqual(
      ["a", ...Array.from({ length: 8 }, (_, i) => `n${i}`)].sort(),
    );
    // an older version never overwrites a newer one
    await api(secret, "POST", `/scenes/${id}/elements`, {
      elements: [el("a", { version: 5, x: 500 })],
    });
    await api(secret, "POST", `/scenes/${id}/elements`, {
      elements: [el("a", { version: 3, x: 1 })],
    });
    expect(
      (await api(secret, "GET", `/scenes/${id}`))
        .json()
        .scene.data.elements.find((e: any) => e.id === "a").x,
    ).toBe(500);
  });

  it("adds a Mermaid diagram below existing content, without AI", async () => {
    const { mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (
      await api(secret, "POST", "/scenes", {
        data: { elements: [el("a", { y: 100, height: 40 })], appState: {} },
      })
    ).json().scene.id;
    const before = llmHits;
    const res = await api(secret, "POST", `/scenes/${id}/diagram`, {
      mermaid: "graph TD\nA[One] --> B[Two]",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ nodeCount: 2, edgeCount: 1 });
    expect(llmHits).toBe(before);
    const els = (await api(secret, "GET", `/scenes/${id}`)).json().scene.data
      .elements;
    expect(
      els
        .filter((e: any) => e.type === "text")
        .map((e: any) => e.text)
        .sort(),
    ).toEqual(["One", "Two"]);
    const added = els.filter((e: any) => e.id.startsWith("d"));
    expect(Math.min(...added.map((e: any) => e.y))).toBeGreaterThanOrEqual(140); // below the existing shape
    expect(
      (
        await api(secret, "POST", `/scenes/${id}/diagram`, {
          mermaid: "sequenceDiagram\nA->>B: hi",
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await api(secret, "POST", `/scenes/${id}/diagram`, {})).statusCode,
    ).toBe(400);
    expect(
      (
        await api(secret, "POST", `/scenes/${id}/diagram`, {
          mermaid: "graph TD\nA-->B",
          prompt: "both",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("prompt diagrams go through the workspace AI gates and daily limits", async () => {
    const { owner, ws, mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (await api(secret, "POST", "/scenes", {})).json().scene.id;
    expect(
      (
        await api(secret, "POST", `/scenes/${id}/diagram`, { prompt: "a flow" })
      ).json().error,
    ).toBe("ai_disabled");
    await call(owner.cookie, "PUT", `/workspaces/${ws.id}/ai/settings`, {
      enabled: true,
      provider: "local",
      model: "m",
      baseUrl: llmUrl,
      workspaceDailyLimit: 1,
    });
    const ok = await api(secret, "POST", `/scenes/${id}/diagram`, {
      prompt: "a flow",
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().mermaid).toContain("From AI");
    const limited = await api(secret, "POST", `/scenes/${id}/diagram`, {
      prompt: "again",
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toBe("ai_limit_reached");
  });

  it("exports the native .excalidraw format, optionally with images", async () => {
    const { mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (
      await api(secret, "POST", "/scenes", {
        data: {
          elements: [el("a")],
          appState: { viewBackgroundColor: "#eee" },
        },
      })
    ).json().scene.id;
    const res = await api(secret, "GET", `/scenes/${id}/export`);
    expect(res.headers["content-type"]).toContain("excalidraw");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.json()).toMatchObject({
      type: "excalidraw",
      version: 2,
      appState: { viewBackgroundColor: "#eee" },
      files: {},
    });
    expect(res.json().elements).toHaveLength(1);
  });

  it("propagates API writes to editors connected to the scene in real time", async () => {
    const { owner, ws, mkKey } = await setup();
    const { secret } = await mkKey();
    const id = (
      await api(secret, "POST", "/scenes", {
        data: { elements: [el("a")], appState: {} },
      })
    ).json().scene.id;
    const events: any[] = [];
    const sock = new WebSocket(`ws://127.0.0.1:${port}/api/v1/collab/${id}`, {
      headers: { cookie: `ew_session=${owner.cookie}` },
    });
    sock.on("message", (d) => events.push(JSON.parse(d.toString())));
    await new Promise((r) => sock.on("open", r));
    await new Promise((r) => setTimeout(r, 200));
    await api(secret, "POST", `/scenes/${id}/elements`, {
      elements: [el("from-api")],
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(
      events.some(
        (e) =>
          e.t === "elements" &&
          e.elements.some((x: any) => x.id === "from-api"),
      ),
    ).toBe(true);
    sock.close();
    void ws;
  });

  it("audits API activity with the key prefix but no secret", async () => {
    const { owner, ws, mkKey } = await setup();
    const { secret } = await mkKey();
    await api(secret, "POST", "/scenes", { name: "audited" });
    const logs = (
      await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`)
    ).json().logs;
    const created = logs.find((l: any) => l.action === "SCENE_CREATED");
    expect(created.meta).toMatchObject({ via: `api_key:${prefixOf(secret)}` });
    expect(JSON.stringify(logs)).not.toContain(secretPart(secret));
  });
});

describe("rate limiting", () => {
  it("limits per key, not per IP", async () => {
    const limited = await makeTestApp({ API_RATE_LIMIT_PER_MINUTE: "5" });
    try {
      const owner = await register(limited);
      const ws = (
        await limited.app.inject({
          method: "GET",
          url: "/api/v1/workspaces",
          headers: authed(owner.cookie),
        })
      ).json().workspaces[0];
      const mk = async () =>
        (
          await limited.app.inject({
            method: "POST",
            url: `/api/v1/workspaces/${ws.id}/api-keys`,
            headers: authed(owner.cookie),
            payload: { name: "k", scopes: ["scene:read"] },
          })
        ).json().secret as string;
      const [k1, k2] = [await mk(), await mk()];
      const codes = [];
      for (let i = 0; i < 8; i++) {
        codes.push(
          (await api(k1, "GET", "/me", undefined, limited)).statusCode,
        );
      }
      expect(codes.filter((c) => c === 200)).toHaveLength(5);
      expect(codes.filter((c) => c === 429).length).toBe(3);
      expect((await api(k2, "GET", "/me", undefined, limited)).statusCode).toBe(
        200,
      ); // other key unaffected
    } finally {
      await limited.close();
    }
  });
});

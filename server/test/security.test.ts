import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import { loadConfig } from "../src/config";
import { scrubUrl } from "../src/security/logScrub";
import { hasUnsafeKeys } from "../src/security/objectKeys";

import { authed, csrfHeaders, makeTestApp, register } from "./helpers";

import type { AddressInfo } from "node:net";

const OID = "0123456789abcdef01234567";
const TOKEN = "A".repeat(43);
const fillParams = (url: string) =>
  url
    .replace(/:token/g, TOKEN)
    .replace(/:fileId/g, "file1")
    .replace(/:[A-Za-z]*[iI]d\b/g, OID);

describe("route inventory", () => {
  it("every route requires authentication except an explicit allow-list", async () => {
    const t = await makeTestApp({ ENABLE_MCP: "true" });
    try {
      const routes = t.app.routeTable.filter(
        (r) => !r.url.includes("/collab/") && r.method !== "OPTIONS",
      );
      expect(routes.length).toBeGreaterThan(80); // the sweep is actually looking at something

      // intentionally reachable without a session, with the statuses they must give an anonymous caller
      const PUBLIC: Array<[RegExp, number[]]> = [
        [/^\/health$/, [200]],
        [/^\/api\/v1\/config$/, [200]],
        [/^\/api\/v1\/auth\/(register|login)$/, [400]],
        [/^\/api\/v1\/auth\/logout$/, [204]],
        [/^\/api\/v1\/share\/:token(\/|$)/, [404]], // capability URLs: unknown token -> 404
        [/^\/mcp$/, [401, 405]], // bearer key required
        [/^\/public\/v1\//, [401]], // bearer key required
      ];

      const offenders: string[] = [];
      for (const r of routes) {
        const url = fillParams(r.url);
        const res = await t.app.inject({
          method: r.method as any,
          url,
          headers: csrfHeaders,
          payload: ["POST", "PUT", "PATCH"].includes(r.method) ? {} : undefined,
        });
        const allowed = PUBLIC.find(([re]) => re.test(r.url));
        const ok = allowed
          ? allowed[1].includes(res.statusCode)
          : res.statusCode === 401;
        if (!ok) {
          offenders.push(
            `${r.method} ${r.url} -> ${res.statusCode}${
              allowed ? "" : " (expected 401)"
            }`,
          );
        }
      }
      expect(offenders).toEqual([]);
    } finally {
      await t.close();
    }
  });

  it("every state-changing cookie route rejects requests without the CSRF header", async () => {
    const t = await makeTestApp();
    try {
      const u = await register(t);
      const unsafe = t.app.routeTable.filter(
        (r) =>
          ["POST", "PUT", "PATCH", "DELETE"].includes(r.method) &&
          r.url.startsWith("/api/v1/"),
      );
      expect(unsafe.length).toBeGreaterThan(30);
      const offenders: string[] = [];
      for (const r of unsafe) {
        const res = await t.app.inject({
          method: r.method as any,
          url: fillParams(r.url),
          headers: {
            cookie: `ew_session=${u.cookie}`,
            "content-type": "application/json",
          },
          payload: "{}",
        });
        if (
          res.statusCode !== 403 ||
          res.json().error !== "csrf_header_required"
        ) {
          offenders.push(`${r.method} ${r.url} -> ${res.statusCode}`);
        }
      }
      expect(offenders).toEqual([]);
      // a foreign Origin is refused even with the header
      const evil = await t.app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        headers: { ...authed(u.cookie), origin: "https://evil.example" },
        payload: { name: "x" },
      });
      expect(evil.statusCode).toBe(403);
    } finally {
      await t.close();
    }
  });
});

describe("headers and cookies", () => {
  it("sends hardening headers on every response; HSTS only when cookies are Secure", async () => {
    const plain = await makeTestApp();
    const secure = await makeTestApp({ COOKIE_SECURE: "true" });
    try {
      const r = await plain.app.inject({ method: "GET", url: "/health" });
      expect(r.headers).toMatchObject({
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "same-origin",
        "cache-control": "no-store",
        "cross-origin-resource-policy": "same-site",
      });
      expect(r.headers["strict-transport-security"]).toBeUndefined();
      const s = await secure.app.inject({ method: "GET", url: "/health" });
      expect(s.headers["strict-transport-security"]).toContain(
        "max-age=31536000",
      );
      const reg = await register(secure);
      expect(String(reg.res.headers["set-cookie"])).toMatch(/Secure/i);
      expect(String(reg.res.headers["set-cookie"])).toMatch(/HttpOnly/i);
    } finally {
      await plain.close();
      await secure.close();
    }
  });

  it("CORS reflects only configured origins and never a wildcard with credentials", async () => {
    const t = await makeTestApp();
    try {
      const ok = await t.app.inject({
        method: "OPTIONS",
        url: "/api/v1/auth/me",
        headers: { origin: "http://localhost:3002" },
      });
      expect(ok.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3002",
      );
      expect(ok.headers["access-control-allow-credentials"]).toBe("true");
      const bad = await t.app.inject({
        method: "OPTIONS",
        url: "/api/v1/auth/me",
        headers: { origin: "https://evil.example" },
      });
      expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
      expect(bad.headers["access-control-allow-credentials"]).toBeUndefined();
    } finally {
      await t.close();
    }
  });
});

describe("injection", () => {
  it("rejects NoSQL operator objects where strings are expected", async () => {
    const t = await makeTestApp();
    try {
      const u = await register(t);
      const login = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: csrfHeaders,
        payload: { email: { $ne: null }, password: { $ne: null } },
      });
      expect(login.statusCode).toBe(400);
      const ws = (
        await t.app.inject({
          method: "GET",
          url: "/api/v1/workspaces",
          headers: authed(u.cookie),
        })
      ).json().workspaces[0];
      const post = (payload: unknown) =>
        t.app.inject({
          method: "POST",
          url: `/api/v1/workspaces/${ws.id}/scenes`,
          headers: authed(u.cookie),
          payload: payload as any,
        });
      expect((await post({ name: { $gt: "" } })).statusCode).toBe(400);
      expect((await post({ folderId: { $ne: null } })).statusCode).toBe(400);
      // query strings cannot smuggle operators either (?q[$ne]=x is just a weird string key)
      const list = await t.app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${ws.id}/scenes?q[$ne]=x&sort[$gt]=1`,
        headers: authed(u.cookie),
      });
      expect([200, 400]).toContain(list.statusCode);
      if (list.statusCode === 200) {
        expect(list.json().scenes).toEqual([]);
      }
      // regex metacharacters in search are literal
      await post({ name: "plain" });
      const re = await t.app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${ws.id}/scenes?q=${encodeURIComponent(
          "(a+)+$",
        )}`,
        headers: authed(u.cookie),
      });
      expect(re.statusCode).toBe(200);
      expect(re.json().scenes).toEqual([]);
    } finally {
      await t.close();
    }
  });

  it("refuses operator-style ($) field names in scenes, libraries and realtime payloads", async () => {
    const t = await makeTestApp();
    try {
      await t.app.listen({ port: 0, host: "127.0.0.1" });
      const port = (t.app.server.address() as AddressInfo).port;
      const u = await register(t);
      const call = (m: string, url: string, payload?: unknown) =>
        t.app.inject({
          method: m as any,
          url: `/api/v1${url}`,
          headers: authed(u.cookie),
          payload: payload as any,
        });
      const ws = (await call("GET", "/workspaces")).json().workspaces[0];
      const scene = (
        await call("POST", `/workspaces/${ws.id}/scenes`, {})
      ).json().scene;
      const bad = {
        id: "a",
        type: "rectangle",
        version: 1,
        versionNonce: 1,
        $set: { admin: true },
      };
      expect(
        (
          await call("PUT", `/scenes/${scene.id}/data`, {
            baseVersion: 1,
            elements: [bad],
            appState: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call("POST", `/workspaces/${ws.id}/scenes`, {
            data: { elements: [bad], appState: {} },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call("PUT", "/libraries/personal", {
            items: [{ id: "i", elements: [bad] }],
          })
        ).statusCode,
      ).toBe(400);

      const events: any[] = [];
      const sock = new WebSocket(
        `ws://127.0.0.1:${port}/api/v1/collab/${scene.id}`,
        { headers: { cookie: `ew_session=${u.cookie}` } },
      );
      sock.on("message", (d) => events.push(JSON.parse(d.toString())));
      await new Promise((r) => sock.on("open", r));
      await new Promise((r) => setTimeout(r, 150));
      const other = new WebSocket(
        `ws://127.0.0.1:${port}/api/v1/collab/${scene.id}`,
        { headers: { cookie: `ew_session=${u.cookie}` } },
      );
      const seen: any[] = [];
      other.on("message", (d) => seen.push(JSON.parse(d.toString())));
      await new Promise((r) => other.on("open", r));
      await new Promise((r) => setTimeout(r, 150));
      sock.send(
        JSON.stringify({
          t: "elements",
          elements: [
            bad,
            { id: "ok", type: "rectangle", version: 1, versionNonce: 1 },
          ],
        }),
      );
      await new Promise((r) => setTimeout(r, 200));
      const relayed = seen
        .filter((e) => e.t === "elements")
        .flatMap((e) => e.elements.map((x: any) => x.id));
      expect(relayed).toEqual(["ok"]);
      sock.close();
      other.close();
    } finally {
      await t.close();
    }
  });

  it("hasUnsafeKeys", () => {
    expect(hasUnsafeKeys({ a: 1 })).toBe(false);
    expect(hasUnsafeKeys({ $where: "x" })).toBe(true);
    expect(hasUnsafeKeys(JSON.parse('{"__proto__": {"x": 1}}'))).toBe(true);
    expect(hasUnsafeKeys(null)).toBe(false);
    expect(hasUnsafeKeys("$x")).toBe(false);
  });
});

describe("secrets in logs", () => {
  it("scrubUrl removes share tokens and credential query params", () => {
    const tok = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
    expect(scrubUrl(`/api/v1/share/${tok}/files/f1`)).toBe(
      "/api/v1/share/[token]/files/f1",
    );
    expect(scrubUrl(`/api/v1/collab/share/${tok}`)).toBe(
      "/api/v1/collab/share/[token]",
    );
    expect(scrubUrl("/x?token=abc&y=1&access_token=zzz")).toBe(
      "/x?token=[redacted]&y=1&access_token=[redacted]",
    );
    expect(scrubUrl("/api/v1/scenes/123")).toBe("/api/v1/scenes/123");
  });
});

describe("production configuration guard", () => {
  const base = {
    NODE_ENV: "production",
    ALLOWED_ORIGINS: "https://draw.example.com",
  };
  it("refuses placeholder secrets and insecure cookies", () => {
    expect(() =>
      loadConfig({
        ...base,
        SESSION_SECRET: "change-me-change-me-change-me-change-me",
      }),
    ).toThrow(/placeholder/);
    expect(() =>
      loadConfig({
        ...base,
        SESSION_SECRET: "k".repeat(48),
        COOKIE_SECURE: "false",
      }),
    ).toThrow(/COOKIE_SECURE/);
    expect(() =>
      loadConfig({
        ...base,
        SESSION_SECRET: "k".repeat(48),
        ALLOWED_ORIGINS: "http://localhost:3002",
      }),
    ).toThrow(/ALLOWED_ORIGINS/);
  });
  it("boots with good settings; the LAN opt-out and TRUST_PROXY are explicit", () => {
    const ok = loadConfig({ ...base, SESSION_SECRET: "k".repeat(48) });
    expect(ok.cookieSecure).toBe(true);
    expect(ok.trustProxy).toBe(false);
    expect(
      loadConfig({
        ...base,
        SESSION_SECRET: "k".repeat(48),
        COOKIE_SECURE: "false",
        ALLOW_INSECURE_COOKIES: "true",
      }).cookieSecure,
    ).toBe(false);
    expect(
      loadConfig({
        ...base,
        SESSION_SECRET: "k".repeat(48),
        TRUST_PROXY: "true",
      }).trustProxy,
    ).toBe(true);
    expect(
      loadConfig({ ...base, SESSION_SECRET: "k".repeat(48), TRUST_PROXY: "2" })
        .trustProxy,
    ).toBe(2);
  });
  it("requires a strong session secret everywhere", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "development", SESSION_SECRET: "short" }),
    ).toThrow();
  });
});

describe("resource limits", () => {
  it("caps simultaneous realtime connections per user", async () => {
    const t = await makeTestApp();
    try {
      await t.app.listen({ port: 0, host: "127.0.0.1" });
      const port = (t.app.server.address() as AddressInfo).port;
      const u = await register(t);
      const ws = (
        await t.app.inject({
          method: "GET",
          url: "/api/v1/workspaces",
          headers: authed(u.cookie),
        })
      ).json().workspaces[0];
      const scene = (
        await t.app.inject({
          method: "POST",
          url: `/api/v1/workspaces/${ws.id}/scenes`,
          headers: authed(u.cookie),
          payload: {},
        })
      ).json().scene;
      const socks: WebSocket[] = [];
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) {
        const s = new WebSocket(
          `ws://127.0.0.1:${port}/api/v1/collab/${scene.id}`,
          { headers: { cookie: `ew_session=${u.cookie}` } },
        );
        s.on("close", (c) => codes.push(c));
        s.on("error", () => {});
        socks.push(s);
        await new Promise((r) => setTimeout(r, 40));
      }
      await new Promise((r) => setTimeout(r, 400));
      expect(codes.filter((c) => c === 4429).length).toBe(2); // 10 allowed, 2 refused
      socks.forEach((s) => s.close());
    } finally {
      await t.close();
    }
  });

  it("rejects oversized request bodies", async () => {
    const t = await makeTestApp();
    try {
      const u = await register(t);
      const big = "x".repeat(1.2 * 1024 * 1024);
      const res = await t.app.inject({
        method: "PATCH",
        url: "/api/v1/me",
        headers: authed(u.cookie),
        payload: { displayName: big },
      });
      expect(res.statusCode).toBe(413);
    } finally {
      await t.close();
    }
  });
});

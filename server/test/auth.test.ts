import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../src/security/password";
import { redact } from "../src/repos/audit";

import {
  authed,
  cookieFrom,
  csrfHeaders,
  makeTestApp,
  register,
} from "./helpers";

import type { TestApp } from "./helpers";

let t: TestApp;
beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(async () => {
  await t.close();
});

describe("password hashing", () => {
  it("never stores plaintext and verifies correctly", async () => {
    const h = await hashPassword("s3cret-password");
    expect(h).not.toContain("s3cret-password");
    expect(await verifyPassword("s3cret-password", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("registration", () => {
  it("registers, sets an HttpOnly cookie and stores only a hash", async () => {
    const { res, body } = await register(t);
    expect(res.statusCode).toBe(201);
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const json = res.json();
    expect(json.user.email).toBe(body.email);
    expect(json.user.passwordHash).toBeUndefined();

    const doc = await t.database.c.users.findOne({ emailLower: body.email });
    expect(doc!.passwordHash).not.toContain(body.password);
    const session = await t.database.c.sessions.findOne({ userId: doc!._id });
    expect(session!.tokenHash).not.toBe(cookieFrom(res as any));
  });

  it("rejects duplicate emails case-insensitively", async () => {
    const { body } = await register(t);
    const { res } = await register(t, { email: body.email.toUpperCase() });
    expect(res.statusCode).toBe(409);
  });

  it("validates input", async () => {
    const { res } = await register(t, { password: "short" });
    expect(res.statusCode).toBe(400);
    const r2 = await register(t, { email: "not-an-email" });
    expect(r2.res.statusCode).toBe(400);
  });
});

describe("login/logout/me", () => {
  it("logs in, reads /me, logs out and the session dies", async () => {
    const { body } = await register(t);
    const login = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: csrfHeaders,
      payload: { email: body.email, password: body.password },
    });
    expect(login.statusCode).toBe(200);
    const cookie = cookieFrom(login as any);

    const me = await t.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authed(cookie),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.lastLoginAt).not.toBeNull();

    const out = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: authed(cookie),
    });
    expect(out.statusCode).toBe(204);
    const after = await t.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authed(cookie),
    });
    expect(after.statusCode).toBe(401);
  });

  it("gives the same error for wrong password and unknown user", async () => {
    const { body } = await register(t);
    const bad = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: csrfHeaders,
      payload: { email: body.email, password: "nope-nope-nope" },
    });
    const unknown = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: csrfHeaders,
      payload: { email: "ghost@example.com", password: "nope-nope-nope" },
    });
    expect(bad.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(bad.json()).toEqual(unknown.json());
  });

  it("blocks unauthenticated and forged/expired sessions", async () => {
    const none = await t.app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(none.statusCode).toBe(401);
    const forged = await t.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authed("forged-token"),
    });
    expect(forged.statusCode).toBe(401);

    const { cookie } = await register(t);
    await t.database.c.sessions.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await t.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authed(cookie),
    });
    expect(expired.statusCode).toBe(401);
  });

  it("refuses disabled accounts", async () => {
    const { body, cookie } = await register(t);
    await t.database.c.users.updateOne(
      { emailLower: body.email },
      { $set: { status: "disabled" } },
    );
    const me = await t.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authed(cookie),
    });
    expect(me.statusCode).toBe(401);
    const login = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: csrfHeaders,
      payload: { email: body.email, password: body.password },
    });
    expect(login.statusCode).toBe(401);
  });
});

describe("CSRF and origin protection", () => {
  it("rejects state-changing requests without the custom header", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "a@b.co", password: "x" },
    });
    expect(res.statusCode).toBe(403);
  });
  it("rejects disallowed origins", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { ...csrfHeaders, origin: "https://evil.example" },
      payload: { email: "a@b.co", password: "x" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("profile and password", () => {
  it("updates profile and validates avatar URL scheme", async () => {
    const { cookie } = await register(t);
    const ok = await t.app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: authed(cookie),
      payload: {
        displayName: "New Name",
        avatarUrl: "https://example.com/a.png",
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.displayName).toBe("New Name");
    const bad = await t.app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: authed(cookie),
      payload: { avatarUrl: ["java", "script:alert(1)"].join("") },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("changes password, revokes other sessions, keeps current", async () => {
    const { body, cookie } = await register(t);
    const other = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: csrfHeaders,
      payload: { email: body.email, password: body.password },
    });
    const otherCookie = cookieFrom(other as any);

    const wrong = await t.app.inject({
      method: "POST",
      url: "/api/v1/me/password",
      headers: authed(cookie),
      payload: { currentPassword: "bad", newPassword: "a brand new password" },
    });
    expect(wrong.statusCode).toBe(403);

    const ok = await t.app.inject({
      method: "POST",
      url: "/api/v1/me/password",
      headers: authed(cookie),
      payload: {
        currentPassword: body.password,
        newPassword: "a brand new password",
      },
    });
    expect(ok.statusCode).toBe(204);
    expect(
      (
        await t.app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: authed(cookie),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await t.app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: authed(otherCookie),
        })
      ).statusCode,
    ).toBe(401);
  });
});

describe("rate limiting", () => {
  it("throttles repeated login attempts", async () => {
    const limited = await makeTestApp({ AUTH_RATE_LIMIT_MAX: "3" });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await limited.app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          headers: csrfHeaders,
          payload: { email: "x@example.com", password: "whatever-pass" },
        });
        codes.push(r.statusCode);
      }
      expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
      expect(codes.slice(3)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe("infrastructure", () => {
  it("creates TTL + unique indexes", async () => {
    const idx = await t.database.c.sessions.indexes();
    expect(idx.some((i) => i.expireAfterSeconds === 0)).toBe(true);
    const uidx = await t.database.c.users.indexes();
    expect(uidx.some((i) => i.unique && i.key.emailLower === 1)).toBe(true);
  });
  it("enforces the collection validator", async () => {
    await expect(
      t.database.db.collection("users").insertOne({ email: 1 }),
    ).rejects.toThrow();
  });
  it("audit redaction strips credentials", () => {
    expect(redact({ password: "x", nested: { apiKey: "y", ok: 1 } })).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]", ok: 1 },
    });
  });
  it("exposes feature flags", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/config" });
    expect(res.json().features.mcp).toBe(false);
  });
});

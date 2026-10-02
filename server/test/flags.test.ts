import { describe, expect, it } from "vitest";

import { authed, makeTestApp, register } from "./helpers";

describe("ENABLE_WORKSPACES=false (single-user mode)", () => {
  it("keeps the personal workspace but blocks creating shared workspaces and managing members", async () => {
    const t = await makeTestApp({ ENABLE_WORKSPACES: "false" });
    try {
      const owner = await register(t);
      const other = await register(t);
      const call = (
        c: string | undefined,
        method: string,
        url: string,
        payload?: unknown,
      ) =>
        t.app.inject({
          method: method as any,
          url: `/api/v1${url}`,
          headers: authed(c),
          payload: payload as any,
        });
      const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
        .workspaces[0];
      expect(ws.role).toBe("OWNER");
      // everything else still works: scenes, folders, sharing by link
      expect(
        (
          await call(owner.cookie, "POST", `/workspaces/${ws.id}/scenes`, {
            name: "solo",
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await call(owner.cookie, "POST", `/workspaces/${ws.id}/folders`, {
            name: "f",
          })
        ).statusCode,
      ).toBe(201);

      const create = await call(owner.cookie, "POST", "/workspaces", {
        name: "Team",
      });
      expect(create.statusCode).toBe(404);
      expect(create.json().error).toBe("feature_disabled");
      expect(
        (
          await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
            email: other.body.email,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await call(
            owner.cookie,
            "PATCH",
            `/workspaces/${ws.id}/members/${other.res.json().user.id}`,
            { role: "ADMIN" },
          )
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await call(
            owner.cookie,
            "DELETE",
            `/workspaces/${ws.id}/members/${other.res.json().user.id}`,
          )
        ).statusCode,
      ).toBe(404);
      expect(
        (await t.app.inject({ method: "GET", url: "/api/v1/config" })).json()
          .features.workspaces,
      ).toBe(false);
    } finally {
      await t.close();
    }
  });
});

describe("client telemetry", () => {
  it("accepts failure reports from signed-in users, scrubs credentials, and rejects junk", async () => {
    const t = await makeTestApp();
    try {
      const u = await register(t);
      const logged: any[] = [];
      const orig = t.app.log.warn.bind(t.app.log);
      (t.app.log as any).warn = (obj: any, msg: string) => {
        logged.push(obj);
        return orig(obj, msg);
      };
      const post = (c: string | undefined, payload: unknown) =>
        t.app.inject({
          method: "POST",
          url: "/api/v1/telemetry",
          headers: authed(c),
          payload: payload as any,
        });
      const ok = await post(u.cookie, {
        type: "save_failure",
        message: `PUT failed https://x/share/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?token=abc123 ewk_abcdefghij_${"Z".repeat(
          43,
        )}`,
        context: { status: 503 },
      });
      expect(ok.statusCode).toBe(204);
      const entry = logged.find((l) => l.telemetry);
      expect(entry.telemetry.type).toBe("save_failure");
      expect(entry.telemetry.message).not.toContain("abc123");
      expect(entry.telemetry.message).not.toContain("AAAAAAAAAAAAAAAAAAAA");
      expect(entry.telemetry.message).not.toContain("ZZZZZZZZZZ");
      expect(
        (await post(u.cookie, { type: "nope", message: "x" })).statusCode,
      ).toBe(400);
      expect(
        (
          await post(u.cookie, {
            type: "client_error",
            message: "x".repeat(401),
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await post(u.cookie, {
            type: "client_error",
            message: "x",
            context: { nested: { a: 1 } },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await t.app.inject({
            method: "POST",
            url: "/api/v1/telemetry",
            headers: { "x-requested-with": "excalidraw-workspace" },
            payload: { type: "client_error", message: "x" },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await t.close();
    }
  });
});

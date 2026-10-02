import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authed, makeTestApp, register } from "./helpers";

import type { TestApp } from "./helpers";

let t: TestApp;
beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(async () => {
  await t.close();
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

describe("workspaces", () => {
  it("creates a personal workspace on registration and lists it", async () => {
    const { cookie } = await register(t, { displayName: "Ada" });
    const res = await call(cookie, "GET", "/workspaces");
    expect(res.json().workspaces).toHaveLength(1);
    expect(res.json().workspaces[0].role).toBe("OWNER");
  });

  it("creates additional workspaces with unique slugs", async () => {
    const { cookie } = await register(t);
    const a = await call(cookie, "POST", "/workspaces", {
      name: "Team Rocket",
    });
    const b = await call(cookie, "POST", "/workspaces", {
      name: "Team Rocket",
    });
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().workspace.slug).not.toBe(b.json().workspace.slug);
  });

  it("hides workspaces from non-members (404, not 403)", async () => {
    const owner = await register(t);
    const outsider = await register(t);
    const ws = (
      await call(owner.cookie, "POST", "/workspaces", { name: "Secret" })
    ).json().workspace;
    for (const [m, u] of [
      ["GET", ""],
      ["PATCH", ""],
      ["DELETE", ""],
      ["GET", "/members"],
    ] as const) {
      const r = await call(
        outsider.cookie,
        m,
        `/workspaces/${ws.id}${u}`,
        m === "PATCH" ? { name: "x" } : undefined,
      );
      expect(r.statusCode).toBe(404);
    }
    expect(
      (await call(owner.cookie, "GET", "/workspaces/not-an-id")).statusCode,
    ).toBe(404);
    expect(
      (
        await t.app.inject({
          method: "GET",
          url: `/api/v1/workspaces/${ws.id}`,
        })
      ).statusCode,
    ).toBe(401);
  });
});

describe("membership and roles", () => {
  it("owner adds members, roles are enforced", async () => {
    const owner = await register(t);
    const admin = await register(t);
    const member = await register(t);
    const ws = (
      await call(owner.cookie, "POST", "/workspaces", { name: "Org" })
    ).json().workspace;

    expect(
      (
        await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
          email: admin.body.email,
          role: "ADMIN",
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await call(admin.cookie, "POST", `/workspaces/${ws.id}/members`, {
          email: member.body.email,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await call(admin.cookie, "POST", `/workspaces/${ws.id}/members`, {
          email: member.body.email,
        })
      ).statusCode,
    ).toBe(409);

    // member can read but not manage/rename/delete
    expect(
      (await call(member.cookie, "GET", `/workspaces/${ws.id}/members`)).json()
        .members,
    ).toHaveLength(3);
    expect(
      (
        await call(member.cookie, "PATCH", `/workspaces/${ws.id}`, {
          name: "Hax",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(member.cookie, "POST", `/workspaces/${ws.id}/members`, {
          email: owner.body.email,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call(member.cookie, "GET", `/workspaces/${ws.id}/audit`))
        .statusCode,
    ).toBe(403);
    // admin can rename but not delete or mint admins
    expect(
      (
        await call(admin.cookie, "PATCH", `/workspaces/${ws.id}`, {
          name: "Renamed",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(admin.cookie, "DELETE", `/workspaces/${ws.id}`)).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          admin.cookie,
          "PATCH",
          `/workspaces/${ws.id}/members/${member.res.json().user.id}`,
          { role: "ADMIN" },
        )
      ).statusCode,
    ).toBe(403);
    // nobody can demote/remove the owner
    expect(
      (
        await call(
          admin.cookie,
          "PATCH",
          `/workspaces/${ws.id}/members/${owner.res.json().user.id}`,
          { role: "MEMBER" },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          admin.cookie,
          "DELETE",
          `/workspaces/${ws.id}/members/${owner.res.json().user.id}`,
        )
      ).statusCode,
    ).toBe(403);
    // admin cannot remove another admin; owner can
    expect(
      (
        await call(
          owner.cookie,
          "PATCH",
          `/workspaces/${ws.id}/members/${member.res.json().user.id}`,
          { role: "ADMIN" },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          admin.cookie,
          "DELETE",
          `/workspaces/${ws.id}/members/${member.res.json().user.id}`,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          owner.cookie,
          "DELETE",
          `/workspaces/${ws.id}/members/${member.res.json().user.id}`,
        )
      ).statusCode,
    ).toBe(204);
    // removed user loses access
    expect(
      (await call(member.cookie, "GET", `/workspaces/${ws.id}`)).statusCode,
    ).toBe(404);
  });

  it("members can leave; owner cannot; unknown user email -> 404", async () => {
    const owner = await register(t);
    const m = await register(t);
    const ws = (
      await call(owner.cookie, "POST", "/workspaces", { name: "Leave" })
    ).json().workspace;
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: m.body.email,
    });
    expect(
      (
        await call(
          m.cookie,
          "DELETE",
          `/workspaces/${ws.id}/members/${m.res.json().user.id}`,
        )
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await call(
          owner.cookie,
          "DELETE",
          `/workspaces/${ws.id}/members/${owner.res.json().user.id}`,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
          email: "nobody@example.com",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("records audit logs without leaking secrets", async () => {
    const owner = await register(t);
    const m = await register(t);
    const ws = (
      await call(owner.cookie, "POST", "/workspaces", { name: "Audit" })
    ).json().workspace;
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: m.body.email,
    });
    const logs = (
      await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`)
    ).json().logs;
    expect(logs.map((l: any) => l.action)).toEqual(
      expect.arrayContaining(["WORKSPACE_CREATED", "USER_INVITED"]),
    );
    expect(JSON.stringify(logs)).not.toMatch(/password/i);
  });

  it("owner can delete a workspace, cascading memberships", async () => {
    const owner = await register(t);
    const ws = (
      await call(owner.cookie, "POST", "/workspaces", { name: "Bye" })
    ).json().workspace;
    expect(
      (await call(owner.cookie, "DELETE", `/workspaces/${ws.id}`)).statusCode,
    ).toBe(204);
    expect(
      await t.database.c.workspaceMembers.countDocuments({
        workspaceId: new (await import("mongodb")).ObjectId(ws.id),
      }),
    ).toBe(0);
  });
});

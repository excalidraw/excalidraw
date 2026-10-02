import { ObjectId } from "mongodb";
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

const item = (id: string, extra: object = {}) => ({
  id,
  status: "unpublished",
  created: 1700000000000,
  elements: [
    { id: `${id}-el`, type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
  ],
  ...extra,
});

describe("personal library", () => {
  it("starts empty, replaces atomically, preserves order and removes dropped items", async () => {
    const u = await register(t);
    expect(
      (await call(u.cookie, "GET", "/libraries/personal")).json().items,
    ).toEqual([]);
    await call(u.cookie, "PUT", "/libraries/personal", {
      items: [item("a"), item("b"), item("c")],
    });
    expect(
      (await call(u.cookie, "GET", "/libraries/personal"))
        .json()
        .items.map((i: any) => i.id),
    ).toEqual(["a", "b", "c"]);
    const res = await call(u.cookie, "PUT", "/libraries/personal", {
      items: [item("c"), item("a", { name: "Renamed" }), item("d")],
    });
    expect(res.json().items.map((i: any) => i.id)).toEqual(["c", "a", "d"]);
    expect(res.json().items[1].name).toBe("Renamed");
    expect(
      await t.database.c.libraryItems.countDocuments({ itemId: "b" }),
    ).toBe(0);
  });

  it("is private to its owner and requires authentication", async () => {
    const a = await register(t);
    const b = await register(t);
    await call(a.cookie, "PUT", "/libraries/personal", {
      items: [item("mine")],
    });
    expect(
      (await call(b.cookie, "GET", "/libraries/personal")).json().items,
    ).toEqual([]);
    expect(
      (await t.app.inject({ method: "GET", url: "/api/v1/libraries/personal" }))
        .statusCode,
    ).toBe(401);
  });

  it("imports by merging (existing items win) and reports how many were added", async () => {
    const u = await register(t);
    await call(u.cookie, "PUT", "/libraries/personal", {
      items: [item("a", { name: "keep me" })],
    });
    const res = await call(u.cookie, "POST", "/libraries/personal/import", {
      items: [item("a", { name: "overwrite?" }), item("b"), item("b")],
    });
    expect(res.json().added).toBe(1);
    expect(res.json().items.map((i: any) => [i.id, i.name])).toEqual([
      ["a", "keep me"],
      ["b", undefined],
    ]);
  });

  it("validates items and neutralises unsafe links", async () => {
    const u = await register(t);
    const bad = (items: unknown[]) =>
      call(u.cookie, "PUT", "/libraries/personal", { items });
    expect((await bad([{ id: "x", elements: [] }])).statusCode).toBe(400);
    expect(
      (await bad([{ id: "", elements: [{ id: "e", type: "rectangle" }] }]))
        .statusCode,
    ).toBe(400);
    expect(
      (await bad([{ id: "x", elements: [{ type: "rectangle" }] }])).statusCode,
    ).toBe(400);
    expect(
      (await call(u.cookie, "PUT", "/libraries/personal", { items: "nope" }))
        .statusCode,
    ).toBe(400);
    await call(u.cookie, "PUT", "/libraries/personal", {
      items: [
        item("l", {
          elements: [
            { id: "e", type: "rectangle", link: ["java", "script:x"].join("") },
          ],
        }),
      ],
    });
    expect(
      (await call(u.cookie, "GET", "/libraries/personal")).json().items[0]
        .elements[0].link,
    ).toBeNull();
  });

  it("enforces the item-count limit and deletes on request", async () => {
    const u = await register(t);
    const many = Array.from({ length: 1001 }, (_, i) => item(`i${i}`));
    expect(
      (await call(u.cookie, "PUT", "/libraries/personal", { items: many }))
        .statusCode,
    ).toBe(400);
    await call(u.cookie, "PUT", "/libraries/personal", { items: [item("a")] });
    expect(
      (await call(u.cookie, "DELETE", "/libraries/personal")).statusCode,
    ).toBe(204);
    expect(
      (await call(u.cookie, "GET", "/libraries/personal")).json().items,
    ).toEqual([]);
  });
});

describe("workspace library", () => {
  it("is shared with members, hidden from outsiders, and audited", async () => {
    const owner = await register(t);
    const member = await register(t);
    const outsider = await register(t);
    const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
      .workspaces[0];
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: member.body.email,
    });

    expect(
      (
        await call(owner.cookie, "PUT", `/workspaces/${ws.id}/library`, {
          items: [item("shared")],
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(member.cookie, "GET", `/workspaces/${ws.id}/library`))
        .json()
        .items.map((i: any) => i.id),
    ).toEqual(["shared"]);
    expect(
      (
        await call(
          member.cookie,
          "POST",
          `/workspaces/${ws.id}/library/import`,
          { items: [item("by-member")] },
        )
      ).json().added,
    ).toBe(1);
    expect(
      (await call(outsider.cookie, "GET", `/workspaces/${ws.id}/library`))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await call(outsider.cookie, "PUT", `/workspaces/${ws.id}/library`, {
          items: [],
        })
      ).statusCode,
    ).toBe(404);

    const logs = (await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`))
      .json()
      .logs.map((l: any) => l.action);
    expect(logs).toEqual(
      expect.arrayContaining(["LIBRARY_UPDATED", "LIBRARY_IMPORTED"]),
    );
    // a workspace library never leaks into personal libraries
    expect(
      (await call(owner.cookie, "GET", "/libraries/personal")).json().items,
    ).toEqual([]);
  });

  it("is removed with the workspace", async () => {
    const u = await register(t);
    const ws = (
      await call(u.cookie, "POST", "/workspaces", { name: "Temp" })
    ).json().workspace;
    await call(u.cookie, "PUT", `/workspaces/${ws.id}/library`, {
      items: [item("gone")],
    });
    await call(u.cookie, "DELETE", `/workspaces/${ws.id}`);
    expect(
      await t.database.c.libraries.countDocuments({
        ownerId: new ObjectId(ws.id),
      }),
    ).toBe(0);
    expect(
      await t.database.c.libraryItems.countDocuments({ itemId: "gone" }),
    ).toBe(0);
  });
});

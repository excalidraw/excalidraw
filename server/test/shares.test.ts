import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authed, csrfHeaders, makeTestApp, register } from "./helpers";

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
const anon = (method: string, url: string, payload?: unknown) =>
  t.app.inject({
    method: method as any,
    url: `/api/v1${url}`,
    headers: csrfHeaders,
    payload: payload as any,
  });

const el = (id: string) => ({
  id,
  type: "rectangle",
  version: 1,
  x: 0,
  y: 0,
  width: 5,
  height: 5,
  isDeleted: false,
});

const setup = async () => {
  const owner = await register(t);
  const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  const scene = (
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/scenes`, {
      name: "Shared",
    })
  ).json().scene;
  await call(owner.cookie, "PUT", `/scenes/${scene.id}/data`, {
    baseVersion: 1,
    elements: [el("a")],
    appState: {},
  });
  return { owner, ws, scene };
};

describe("per-user sharing", () => {
  it("VIEW users can read but never write; EDIT users can write; revoke removes access", async () => {
    const { owner, scene } = await setup();
    const viewer = await register(t);
    const editor = await register(t);

    expect(
      (await call(viewer.cookie, "GET", `/scenes/${scene.id}`)).statusCode,
    ).toBe(404); // not shared yet
    expect(
      (
        await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
          email: viewer.body.email,
          level: "VIEW",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
          email: editor.body.email,
          level: "EDIT",
        })
      ).statusCode,
    ).toBe(200);

    // viewer: read ok, every mutation blocked SERVER-SIDE
    const read = await call(viewer.cookie, "GET", `/scenes/${scene.id}`);
    expect(read.statusCode).toBe(200);
    expect(read.json().scene.access).toBe("VIEW");
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(9),
    ]).toString("base64");
    const blocked: [string, string, unknown][] = [
      [
        "PUT",
        `/scenes/${scene.id}/data`,
        { baseVersion: 2, elements: [], appState: {} },
      ],
      ["PATCH", `/scenes/${scene.id}`, { name: "hax" }],
      ["DELETE", `/scenes/${scene.id}`, undefined],
      [
        "PUT",
        `/scenes/${scene.id}/files/f1`,
        { mimeType: "image/png", dataBase64: png },
      ],
      [
        "PUT",
        `/scenes/${scene.id}/permissions`,
        { email: viewer.body.email, level: "EDIT" },
      ],
      ["POST", `/scenes/${scene.id}/links`, { level: "EDIT" }],
      ["GET", `/scenes/${scene.id}/shares`, undefined],
    ];
    for (const [m, u, p] of blocked) {
      expect((await call(viewer.cookie, m, u, p)).statusCode, `${m} ${u}`).toBe(
        403,
      );
    }
    expect(
      (await call(viewer.cookie, "GET", `/scenes/${scene.id}`)).json().scene
        .data.elements,
    ).toHaveLength(1);

    // editor: can write, cannot delete/share
    expect(
      (
        await call(editor.cookie, "PUT", `/scenes/${scene.id}/data`, {
          baseVersion: 2,
          elements: [el("a"), el("b")],
          appState: {},
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(editor.cookie, "DELETE", `/scenes/${scene.id}`)).statusCode,
    ).toBe(403);

    // appears in "shared with me"
    expect(
      (await call(viewer.cookie, "GET", "/scenes/shared"))
        .json()
        .scenes.map((s: any) => s.id),
    ).toEqual([scene.id]);

    // change permission, then revoke
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: editor.body.email,
      level: "VIEW",
    });
    expect(
      (
        await call(editor.cookie, "PUT", `/scenes/${scene.id}/data`, {
          baseVersion: 3,
          elements: [],
          appState: {},
        })
      ).statusCode,
    ).toBe(403);
    const list = (
      await call(
        owner.cookie,
        "DELETE",
        `/scenes/${scene.id}/permissions/${viewer.res.json().user.id}`,
      )
    ).json();
    expect(list.permissions).toHaveLength(1);
    expect(
      (await call(viewer.cookie, "GET", `/scenes/${scene.id}`)).statusCode,
    ).toBe(404);
  });

  it("validates targets", async () => {
    const { owner, scene } = await setup();
    expect(
      (
        await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
          email: "ghost@example.com",
          level: "VIEW",
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
          email: owner.body.email,
          level: "VIEW",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
          email: "x@y.co",
          level: "ADMIN",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("audits sharing actions", async () => {
    const { owner, ws, scene } = await setup();
    const other = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: other.body.email,
      level: "VIEW",
    });
    await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {});
    const logs = (await call(owner.cookie, "GET", `/workspaces/${ws.id}/audit`))
      .json()
      .logs.map((l: any) => l.action);
    expect(logs).toEqual(
      expect.arrayContaining(["SCENE_SHARED", "SHARE_LINK_CREATED"]),
    );
  });
});

describe("share links", () => {
  it("read-only link: anonymous read works, writes are rejected, revoke kills it", async () => {
    const { owner, scene } = await setup();
    const created = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {
        level: "VIEW",
      })
    ).json().link;
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.token).not.toContain(scene.id); // not derived from DB ids

    const view = await anon("GET", `/share/${created.token}`);
    expect(view.statusCode).toBe(200);
    expect(view.json().level).toBe("VIEW");
    expect(view.json().scene.data.elements).toHaveLength(1);
    expect(JSON.stringify(view.json())).not.toContain(scene.id);

    const write = await anon("PUT", `/share/${created.token}/data`, {
      baseVersion: 2,
      elements: [],
      appState: {},
    });
    expect(write.statusCode).toBe(403);
    expect(
      (await call(owner.cookie, "GET", `/scenes/${scene.id}`)).json().scene.data
        .elements,
    ).toHaveLength(1);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(9),
    ]).toString("base64");
    expect(
      (
        await anon("PUT", `/share/${created.token}/files/x`, {
          mimeType: "image/png",
          dataBase64: png,
        })
      ).statusCode,
    ).toBe(403);

    // owner can re-copy the link later
    expect(
      (await call(owner.cookie, "GET", `/scenes/${scene.id}/shares`)).json()
        .links[0].token,
    ).toBe(created.token);
    // tokens are not stored in plaintext
    const raw = await t.database.c.shareLinks.findOne({});
    expect(JSON.stringify(raw)).not.toContain(created.token);

    expect(
      (
        await call(
          owner.cookie,
          "DELETE",
          `/scenes/${scene.id}/links/${created.id}`,
        )
      ).statusCode,
    ).toBe(204);
    expect((await anon("GET", `/share/${created.token}`)).statusCode).toBe(404);
  });

  it("edit link allows anonymous saves with version checks", async () => {
    const { owner, scene } = await setup();
    const link = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {
        level: "EDIT",
      })
    ).json().link;
    const ok = await anon("PUT", `/share/${link.token}/data`, {
      baseVersion: 2,
      elements: [el("a"), el("z")],
      appState: {},
    });
    expect(ok.statusCode).toBe(200);
    const stale = await anon("PUT", `/share/${link.token}/data`, {
      baseVersion: 2,
      elements: [],
      appState: {},
    });
    expect(stale.statusCode).toBe(409);
  });

  it("rejects malformed, unknown, expired links, and links to trashed scenes uniformly", async () => {
    const { owner, scene } = await setup();
    expect((await anon("GET", "/share/short")).statusCode).toBe(404);
    expect((await anon("GET", `/share/${"A".repeat(43)}`)).statusCode).toBe(
      404,
    );
    const link = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {
        expiresInDays: 1,
      })
    ).json().link;
    expect((await anon("GET", `/share/${link.token}`)).statusCode).toBe(200);
    await t.database.c.shareLinks.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await anon("GET", `/share/${link.token}`)).statusCode).toBe(404);

    const l2 = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {})
    ).json().link;
    await call(owner.cookie, "DELETE", `/scenes/${scene.id}`);
    expect((await anon("GET", `/share/${l2.token}`)).statusCode).toBe(404);
  });

  it("serves images through links with a sandboxing CSP", async () => {
    const { owner, scene } = await setup();
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(9),
    ]).toString("base64");
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/files/pic`, {
      mimeType: "image/png",
      dataBase64: png,
    });
    const link = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {})
    ).json().link;
    const res = await anon("GET", `/share/${link.token}/files/pic`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(
      (await anon("GET", `/share/${link.token}/files/nope`)).statusCode,
    ).toBe(404);
  });

  it("only the scene owner can manage links", async () => {
    const { owner, scene } = await setup();
    const other = await register(t);
    expect(
      (await call(other.cookie, "POST", `/scenes/${scene.id}/links`, {}))
        .statusCode,
    ).toBe(404);
    const link = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {})
    ).json().link;
    expect(
      (
        await call(
          other.cookie,
          "DELETE",
          `/scenes/${scene.id}/links/${link.id}`,
        )
      ).statusCode,
    ).toBe(404);
  });
});

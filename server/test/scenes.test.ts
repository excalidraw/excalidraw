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

const setup = async () => {
  const user = await register(t);
  const ws = (await call(user.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  return { ...user, ws };
};

const rect = (id: string, extra: object = {}) => ({
  id,
  type: "rectangle",
  version: 1,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  isDeleted: false,
  ...extra,
});
const text = (id: string, s: string) => ({
  ...rect(id),
  type: "text",
  text: s,
});

describe("scene CRUD + autosave", () => {
  it("creates, loads, saves with versioning, and reloads content", async () => {
    const u = await setup();
    const created = await call(
      u.cookie,
      "POST",
      `/workspaces/${u.ws.id}/scenes`,
      { name: "Plan" },
    );
    expect(created.statusCode).toBe(201);
    const id = created.json().scene.id;
    expect(created.json().scene.version).toBe(1);

    const save = await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [rect("a"), text("b", "hello world")],
      appState: { viewBackgroundColor: "#fff", scrollX: 999, evil: "x" },
    });
    expect(save.statusCode).toBe(200);
    expect(save.json().version).toBe(2);

    const loaded = (await call(u.cookie, "GET", `/scenes/${id}`)).json().scene;
    expect(loaded.data.elements).toHaveLength(2);
    expect(loaded.data.appState).toEqual({ viewBackgroundColor: "#fff" }); // whitelisted only
    expect(loaded.version).toBe(2);
  });

  it("detects concurrent edits with 409 and returns the server copy", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {})
    ).json().scene.id;
    await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [rect("a")],
      appState: {},
    });
    const stale = await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [rect("z")],
      appState: {},
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().version).toBe(2);
    expect(stale.json().data.elements[0].id).toBe("a");
    // retry against the new version succeeds
    const retry = await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 2,
      elements: [rect("a"), rect("z")],
      appState: {},
    });
    expect(retry.statusCode).toBe(200);
  });

  it("only one of two racing saves wins", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {})
    ).json().scene.id;
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        call(u.cookie, "PUT", `/scenes/${id}/data`, {
          baseVersion: 1,
          elements: [rect(`r${n}`)],
          appState: {},
        }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(3);
  });

  it("validates payloads and neutralises javascript: links", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {})
    ).json().scene.id;
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/data`, {
          baseVersion: 1,
          elements: "nope",
          appState: {},
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/data`, {
          baseVersion: 1,
          elements: [],
          appState: {},
          thumbnail: "http://evil",
        })
      ).statusCode,
    ).toBe(400);
    await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [
        rect("a", { link: ["java", "script:alert(1)"].join("") }),
        rect("b", { link: "https://ok.example" }),
      ],
      appState: {},
    });
    const els = (await call(u.cookie, "GET", `/scenes/${id}`)).json().scene.data
      .elements;
    expect(els[0].link).toBeNull();
    expect(els[1].link).toBe("https://ok.example");
  });

  it("renames, duplicates (with files) and serves thumbnails with ETag", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {
        name: "Orig",
      })
    ).json().scene.id;
    expect(
      (
        await call(u.cookie, "PATCH", `/scenes/${id}`, { name: "Renamed" })
      ).json().scene.name,
    ).toBe("Renamed");

    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(20),
    ]).toString("base64");
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/files/img1`, {
          mimeType: "image/png",
          dataBase64: png,
        })
      ).statusCode,
    ).toBe(204);
    await call(u.cookie, "PUT", `/scenes/${id}/data`, {
      baseVersion: 1,
      elements: [{ ...rect("i"), type: "image", fileId: "img1" }],
      appState: {},
      thumbnail: `data:image/png;base64,${png}`,
    });
    const th = await t.app.inject({
      method: "GET",
      url: `/api/v1/scenes/${id}/thumbnail`,
      headers: authed(u.cookie),
    });
    expect(th.statusCode).toBe(200);
    expect(th.headers["content-type"]).toContain("image/png");
    const th2 = await t.app.inject({
      method: "GET",
      url: `/api/v1/scenes/${id}/thumbnail`,
      headers: {
        ...authed(u.cookie),
        "if-none-match": String(th.headers.etag),
      },
    });
    expect(th2.statusCode).toBe(304);

    const dup = (await call(u.cookie, "POST", `/scenes/${id}/duplicate`)).json()
      .scene;
    expect(dup.id).not.toBe(id);
    expect(dup.name).toBe("Renamed (copy)");
    const file = await t.app.inject({
      method: "GET",
      url: `/api/v1/scenes/${dup.id}/files/img1`,
      headers: authed(u.cookie),
    });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-security-policy"]).toContain("sandbox");
  });

  it("rejects bad uploads (type, magic bytes, id, size)", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {})
    ).json().scene.id;
    const b64 = Buffer.from("<html><script>alert(1)</script>").toString(
      "base64",
    );
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/files/x`, {
          mimeType: "text/html",
          dataBase64: b64,
        })
      ).statusCode,
    ).toBe(415);
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/files/x`, {
          mimeType: "image/png",
          dataBase64: b64,
        })
      ).statusCode,
    ).toBe(415);
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/files/..%2Fetc`, {
          mimeType: "image/png",
          dataBase64: b64,
        })
      ).statusCode,
    ).toBe(400);
    const big = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(4.2 * 1024 * 1024),
    ]).toString("base64");
    expect(
      (
        await call(u.cookie, "PUT", `/scenes/${id}/files/big`, {
          mimeType: "image/png",
          dataBase64: big,
        })
      ).statusCode,
    ).toBe(413);
  });
});

describe("authorization", () => {
  it("non-members get 404 for everything about a scene", async () => {
    const a = await setup();
    const b = await setup();
    const id = (
      await call(a.cookie, "POST", `/workspaces/${a.ws.id}/scenes`, {})
    ).json().scene.id;
    const probes: [string, string, unknown?][] = [
      ["GET", `/scenes/${id}`],
      ["GET", `/scenes/${id}/thumbnail`],
      ["PATCH", `/scenes/${id}`, { name: "x" }],
      [
        "PUT",
        `/scenes/${id}/data`,
        { baseVersion: 1, elements: [], appState: {} },
      ],
      ["DELETE", `/scenes/${id}`],
      ["POST", `/scenes/${id}/duplicate`],
      ["POST", `/workspaces/${a.ws.id}/scenes`, {}],
      ["GET", `/workspaces/${a.ws.id}/scenes`],
    ];
    for (const [m, u, p] of probes) {
      expect((await call(b.cookie, m, u, p)).statusCode, `${m} ${u}`).toBe(404);
    }
  });

  it("private scenes are invisible to other workspace members", async () => {
    const owner = await setup();
    const other = await register(t);
    await call(owner.cookie, "POST", `/workspaces/${owner.ws.id}/members`, {
      email: other.body.email,
    });
    const pub = (
      await call(owner.cookie, "POST", `/workspaces/${owner.ws.id}/scenes`, {
        name: "pub",
      })
    ).json().scene.id;
    const priv = (
      await call(owner.cookie, "POST", `/workspaces/${owner.ws.id}/scenes`, {
        name: "priv",
        visibility: "private",
      })
    ).json().scene.id;

    expect((await call(other.cookie, "GET", `/scenes/${pub}`)).statusCode).toBe(
      200,
    );
    expect(
      (await call(other.cookie, "GET", `/scenes/${priv}`)).statusCode,
    ).toBe(404);
    const list = (
      await call(other.cookie, "GET", `/workspaces/${owner.ws.id}/scenes`)
    ).json().scenes;
    expect(list.map((s: any) => s.name)).toEqual(["pub"]);
    // members can edit workspace scenes but not delete someone else's
    expect(
      (
        await call(other.cookie, "PUT", `/scenes/${pub}/data`, {
          baseVersion: 1,
          elements: [rect("x")],
          appState: {},
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(other.cookie, "DELETE", `/scenes/${pub}`)).statusCode,
    ).toBe(403);
    // ...and cannot flip visibility
    expect(
      (
        await call(other.cookie, "PATCH", `/scenes/${pub}`, {
          visibility: "private",
        })
      ).statusCode,
    ).toBe(403);
  });
});

describe("folders", () => {
  it("nests, moves scenes, prevents cycles/duplicates, and delete preserves content", async () => {
    const u = await setup();
    const w = u.ws.id;
    const mk = async (name: string, parentId?: string) =>
      (
        await call(u.cookie, "POST", `/workspaces/${w}/folders`, {
          name,
          parentId,
        })
      ).json().folder;
    const marketing = await mk("Marketing");
    const web = await mk("Website", marketing.id);
    expect(
      (
        await call(u.cookie, "POST", `/workspaces/${w}/folders`, {
          name: "marketing",
        })
      ).statusCode,
    ).toBe(409);

    // cycle: moving Marketing under Website
    expect(
      (
        await call(u.cookie, "PATCH", `/folders/${marketing.id}`, {
          parentId: web.id,
        })
      ).statusCode,
    ).toBe(400);

    const s = (
      await call(u.cookie, "POST", `/workspaces/${w}/scenes`, {
        name: "Home",
        folderId: web.id,
      })
    ).json().scene;
    const inFolder = (
      await call(u.cookie, "GET", `/workspaces/${w}/scenes?folderId=${web.id}`)
    ).json().scenes;
    expect(inFolder.map((x: any) => x.id)).toEqual([s.id]);

    // move to root, then back
    await call(u.cookie, "PATCH", `/scenes/${s.id}`, { folderId: null });
    expect(
      (
        await call(u.cookie, "GET", `/workspaces/${w}/scenes?folderId=root`)
      ).json().scenes,
    ).toHaveLength(1);
    await call(u.cookie, "PATCH", `/scenes/${s.id}`, { folderId: web.id });

    // deleting Marketing lifts Website to root; scene stays in Website
    expect(
      (await call(u.cookie, "DELETE", `/folders/${marketing.id}`)).statusCode,
    ).toBe(204);
    const folders = (
      await call(u.cookie, "GET", `/workspaces/${w}/folders`)
    ).json().folders;
    expect(folders).toHaveLength(1);
    expect(folders[0].parentId).toBeNull();
    expect(
      (await call(u.cookie, "GET", `/scenes/${s.id}`)).json().scene.folderId,
    ).toBe(web.id);
  });

  it("cannot move scenes into a folder from another workspace", async () => {
    const a = await setup();
    const b = await setup();
    const folderB = (
      await call(b.cookie, "POST", `/workspaces/${b.ws.id}/folders`, {
        name: "F",
      })
    ).json().folder;
    const sceneA = (
      await call(a.cookie, "POST", `/workspaces/${a.ws.id}/scenes`, {})
    ).json().scene;
    expect(
      (
        await call(a.cookie, "PATCH", `/scenes/${sceneA.id}`, {
          folderId: folderB.id,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call(a.cookie, "PATCH", `/folders/${folderB.id}`, { name: "hax" }))
        .statusCode,
    ).toBe(404);
  });
});

describe("trash, search, sort, pagination", () => {
  it("soft deletes, lists trash, restores, and purges permanently", async () => {
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {
        name: "Doomed",
      })
    ).json().scene.id;
    expect(
      (await call(u.cookie, "DELETE", `/scenes/${id}/permanent`)).statusCode,
    ).toBe(409); // must trash first
    expect((await call(u.cookie, "DELETE", `/scenes/${id}`)).statusCode).toBe(
      204,
    );
    expect((await call(u.cookie, "GET", `/scenes/${id}`)).statusCode).toBe(404);
    expect(
      (await call(u.cookie, "GET", `/workspaces/${u.ws.id}/scenes`)).json()
        .scenes,
    ).toHaveLength(0);
    expect(
      (
        await call(u.cookie, "GET", `/workspaces/${u.ws.id}/scenes?view=trash`)
      ).json().scenes,
    ).toHaveLength(1);
    expect(
      (await call(u.cookie, "POST", `/scenes/${id}/restore`)).statusCode,
    ).toBe(200);
    expect((await call(u.cookie, "GET", `/scenes/${id}`)).statusCode).toBe(200);
    await call(u.cookie, "DELETE", `/scenes/${id}`);
    expect(
      (await call(u.cookie, "DELETE", `/scenes/${id}/permanent`)).statusCode,
    ).toBe(204);
    expect(
      await t.database.c.scenes.countDocuments({
        _id: new ObjectId(id),
      }),
    ).toBe(0);
  });

  it("purges expired trash automatically", async () => {
    const { purgeExpiredTrash } = await import("../src/repos/scenes");
    const u = await setup();
    const id = (
      await call(u.cookie, "POST", `/workspaces/${u.ws.id}/scenes`, {})
    ).json().scene.id;
    await call(u.cookie, "DELETE", `/scenes/${id}`);
    await t.database.c.scenes.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(Date.now() - 40 * 86_400_000) } },
    );
    const n = await purgeExpiredTrash(
      t.database,
      t.app.storage,
      30 * 86_400_000,
    );
    expect(n).toBe(1);
    expect(
      await t.database.c.scenes.countDocuments({ _id: new ObjectId(id) }),
    ).toBe(0);
  });

  it("searches by name, in-scene text, folder and owner; sorts; paginates", async () => {
    const u = await setup();
    const w = u.ws.id;
    const folder = (
      await call(u.cookie, "POST", `/workspaces/${w}/folders`, {
        name: "Roadmap",
      })
    ).json().folder;
    const names = ["Alpha", "bravo", "Charlie", "delta"];
    const ids: string[] = [];
    for (const n of names) {
      ids.push(
        (
          await call(u.cookie, "POST", `/workspaces/${w}/scenes`, { name: n })
        ).json().scene.id,
      );
    }
    await call(u.cookie, "PUT", `/scenes/${ids[2]}/data`, {
      baseVersion: 1,
      elements: [text("t", "kubernetes cluster")],
      appState: {},
    });
    await call(u.cookie, "PATCH", `/scenes/${ids[3]}`, { folderId: folder.id });

    const q = async (qs: string) =>
      (await call(u.cookie, "GET", `/workspaces/${w}/scenes?${qs}`)).json();
    expect((await q("q=alph")).scenes.map((s: any) => s.name)).toEqual([
      "Alpha",
    ]);
    expect((await q("q=KUBERNETES")).scenes.map((s: any) => s.name)).toEqual([
      "Charlie",
    ]);
    expect((await q("q=roadmap")).scenes.map((s: any) => s.name)).toEqual([
      "delta",
    ]);
    expect((await q("q=Tester")).scenes).toHaveLength(4); // owner display name
    expect((await q("q=.*")).scenes).toHaveLength(0); // regex is escaped
    expect(
      (await q("sort=name&dir=asc")).scenes.map((s: any) => s.name),
    ).toEqual(
      names.sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase())),
    );

    const p1 = await q("sort=name&dir=asc&limit=3");
    expect(p1.scenes).toHaveLength(3);
    expect(p1.hasMore).toBe(true);
    const p2 = await q("sort=name&dir=asc&limit=3&offset=3");
    expect(p2.scenes).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    // list payloads never include drawing data
    expect(p1.scenes[0].data).toBeUndefined();
    expect((await q("view=recent")).scenes.length).toBeLessThanOrEqual(20);
    expect((await q("view=mine")).scenes).toHaveLength(4);
  });
});

describe("workspace deletion cascades to scenes", () => {
  it("removes scenes, folders and stored files", async () => {
    const u = await setup();
    const ws = (
      await call(u.cookie, "POST", "/workspaces", { name: "Temp" })
    ).json().workspace;
    const id = (
      await call(u.cookie, "POST", `/workspaces/${ws.id}/scenes`, {})
    ).json().scene.id;
    await call(u.cookie, "POST", `/workspaces/${ws.id}/folders`, { name: "F" });
    expect(
      (await call(u.cookie, "DELETE", `/workspaces/${ws.id}`)).statusCode,
    ).toBe(204);
    expect((await call(u.cookie, "GET", `/scenes/${id}`)).statusCode).toBe(404);
    expect(
      await t.database.c.folders.countDocuments({
        workspaceId: new ObjectId(ws.id),
      }),
    ).toBe(0);
  });
});

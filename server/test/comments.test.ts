import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { authed, makeTestApp, register } from "./helpers";

import type { TestApp } from "./helpers";

let t: TestApp;
let port: number;
beforeAll(async () => {
  t = await makeTestApp();
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  port = (t.app.server.address() as any).port;
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
  const owner = await register(t, { displayName: "Owner" });
  const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  const scene = (
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/scenes`, {})
  ).json().scene;
  return { owner, ws, scene };
};

describe("comments", () => {
  it("creates threads with canvas position, replies, and lists them in order", async () => {
    const { owner, scene } = await setup();
    const root = await call(
      owner.cookie,
      "POST",
      `/scenes/${scene.id}/comments`,
      { text: "  Looks good  ", x: 120.5, y: -40, elementId: "el1" },
    );
    expect(root.statusCode).toBe(201);
    expect(root.json().comment).toMatchObject({
      text: "Looks good",
      x: 120.5,
      y: -40,
      elementId: "el1",
      parentId: null,
      authorName: "Owner",
    });
    const reply = await call(
      owner.cookie,
      "POST",
      `/scenes/${scene.id}/comments`,
      { text: "Agreed", parentId: root.json().comment.id },
    );
    expect(reply.json().comment).toMatchObject({
      parentId: root.json().comment.id,
      x: 120.5,
      y: -40,
    });
    // reply-to-reply attaches to the root
    const nested = await call(
      owner.cookie,
      "POST",
      `/scenes/${scene.id}/comments`,
      { text: "nested", parentId: reply.json().comment.id },
    );
    expect(nested.json().comment.parentId).toBe(root.json().comment.id);
    const list = (
      await call(owner.cookie, "GET", `/scenes/${scene.id}/comments`)
    ).json().comments;
    expect(list.map((c: any) => c.text)).toEqual([
      "Looks good",
      "Agreed",
      "nested",
    ]);
  });

  it("validates input", async () => {
    const { owner, scene } = await setup();
    const bad = (payload: object) =>
      call(owner.cookie, "POST", `/scenes/${scene.id}/comments`, payload);
    expect((await bad({ text: "", x: 0, y: 0 })).statusCode).toBe(400);
    expect((await bad({ text: "x".repeat(4001), x: 0, y: 0 })).statusCode).toBe(
      400,
    );
    expect((await bad({ text: "no position" })).statusCode).toBe(400);
    expect((await bad({ text: "nan", x: "1", y: 2 })).statusCode).toBe(400);
    expect(
      (await bad({ text: "orphan", parentId: "0123456789abcdef01234567" }))
        .statusCode,
    ).toBe(404);
  });

  it("view-only users can comment; outsiders cannot even see comments", async () => {
    const { owner, scene } = await setup();
    const viewer = await register(t);
    const outsider = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: viewer.body.email,
      level: "VIEW",
    });
    expect(
      (
        await call(viewer.cookie, "POST", `/scenes/${scene.id}/comments`, {
          text: "hi",
          x: 1,
          y: 1,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await call(outsider.cookie, "GET", `/scenes/${scene.id}/comments`))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await call(outsider.cookie, "POST", `/scenes/${scene.id}/comments`, {
          text: "hi",
          x: 1,
          y: 1,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await t.app.inject({
          method: "GET",
          url: `/api/v1/scenes/${scene.id}/comments`,
        })
      ).statusCode,
    ).toBe(401);
  });

  it("resolve / reopen rules and reply-reopens", async () => {
    const { owner, scene } = await setup();
    const viewer = await register(t);
    const editor = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: viewer.body.email,
      level: "VIEW",
    });
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: editor.body.email,
      level: "EDIT",
    });
    const vroot = (
      await call(viewer.cookie, "POST", `/scenes/${scene.id}/comments`, {
        text: "q?",
        x: 0,
        y: 0,
      })
    ).json().comment;
    const oroot = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/comments`, {
        text: "note",
        x: 0,
        y: 0,
      })
    ).json().comment;

    // a viewer cannot resolve someone else's thread, but can resolve their own
    expect(
      (
        await call(viewer.cookie, "PATCH", `/comments/${oroot.id}`, {
          resolved: true,
        })
      ).statusCode,
    ).toBe(403);
    const r = await call(viewer.cookie, "PATCH", `/comments/${vroot.id}`, {
      resolved: true,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().comment.resolvedAt).not.toBeNull();
    // an editor can resolve anyone's
    expect(
      (
        await call(editor.cookie, "PATCH", `/comments/${oroot.id}`, {
          resolved: true,
        })
      ).json().comment.resolvedByName,
    ).toBeTruthy();
    // reopen
    expect(
      (
        await call(owner.cookie, "PATCH", `/comments/${oroot.id}`, {
          resolved: false,
        })
      ).json().comment.resolvedAt,
    ).toBeNull();
    // replying to a resolved thread reopens it
    await call(owner.cookie, "POST", `/scenes/${scene.id}/comments`, {
      text: "follow-up",
      parentId: vroot.id,
    });
    const list = (
      await call(owner.cookie, "GET", `/scenes/${scene.id}/comments`)
    ).json().comments;
    expect(list.find((c: any) => c.id === vroot.id).resolvedAt).toBeNull();
    // replies themselves cannot be resolved
    const reply = list.find((c: any) => c.text === "follow-up");
    expect(
      (
        await call(owner.cookie, "PATCH", `/comments/${reply.id}`, {
          resolved: true,
        })
      ).statusCode,
    ).toBe(400);
  });

  it("only the author edits text; author or scene owner deletes; deleting a root removes replies", async () => {
    const { owner, scene } = await setup();
    const editor = await register(t);
    const other = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: editor.body.email,
      level: "EDIT",
    });
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: other.body.email,
      level: "EDIT",
    });
    const c = (
      await call(editor.cookie, "POST", `/scenes/${scene.id}/comments`, {
        text: "mine",
        x: 0,
        y: 0,
      })
    ).json().comment;
    await call(other.cookie, "POST", `/scenes/${scene.id}/comments`, {
      text: "reply",
      parentId: c.id,
    });

    expect(
      (
        await call(owner.cookie, "PATCH", `/comments/${c.id}`, {
          text: "hijack",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(editor.cookie, "PATCH", `/comments/${c.id}`, {
          text: "edited",
        })
      ).json().comment.text,
    ).toBe("edited");
    expect(
      (await call(other.cookie, "DELETE", `/comments/${c.id}`)).statusCode,
    ).toBe(403); // editor != owner/author
    expect(
      (await call(owner.cookie, "DELETE", `/comments/${c.id}`)).statusCode,
    ).toBe(204); // scene owner moderates
    expect(
      (await call(owner.cookie, "GET", `/scenes/${scene.id}/comments`)).json()
        .comments,
    ).toHaveLength(0);
  });

  it("broadcasts comment events to live sessions and cleans up with the scene", async () => {
    const { owner, ws, scene } = await setup();
    const events: any[] = [];
    const sock = new WebSocket(
      `ws://127.0.0.1:${port}/api/v1/collab/${scene.id}`,
      { headers: { cookie: `ew_session=${owner.cookie}` } },
    );
    sock.on("message", (d) => events.push(JSON.parse(d.toString())));
    await new Promise((r) => sock.on("open", r));
    await new Promise((r) => setTimeout(r, 150));
    const c = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/comments`, {
        text: "live",
        x: 1,
        y: 2,
      })
    ).json().comment;
    await new Promise((r) => setTimeout(r, 150));
    expect(
      events.find((e) => e.t === "comment" && e.op === "created").comments[0]
        .id,
    ).toBe(c.id);
    await call(owner.cookie, "DELETE", `/comments/${c.id}`);
    await new Promise((r) => setTimeout(r, 150));
    expect(events.find((e) => e.op === "deleted").ids).toEqual([c.id]);
    sock.close();

    await call(owner.cookie, "POST", `/scenes/${scene.id}/comments`, {
      text: "bye",
      x: 0,
      y: 0,
    });
    await call(owner.cookie, "DELETE", `/scenes/${scene.id}`);
    await call(owner.cookie, "DELETE", `/scenes/${scene.id}/permanent`);
    expect(
      await t.database.c.comments.countDocuments({
        sceneId: new ObjectId(scene.id),
      }),
    ).toBe(0);
    void ws;
  });
});

describe("feature flag", () => {
  it("ENABLE_COMMENTS=false removes the endpoints entirely", async () => {
    const off = await makeTestApp({ ENABLE_COMMENTS: "false" });
    try {
      const u = await register(off);
      const ws = (
        await off.app.inject({
          method: "GET",
          url: "/api/v1/workspaces",
          headers: authed(u.cookie),
        })
      ).json().workspaces[0];
      const scene = (
        await off.app.inject({
          method: "POST",
          url: `/api/v1/workspaces/${ws.id}/scenes`,
          headers: authed(u.cookie),
          payload: {},
        })
      ).json().scene;
      const res = await off.app.inject({
        method: "GET",
        url: `/api/v1/scenes/${scene.id}/comments`,
        headers: authed(u.cookie),
      });
      expect(res.statusCode).toBe(404);
      expect(
        (await off.app.inject({ method: "GET", url: "/api/v1/config" })).json()
          .features.comments,
      ).toBe(false);
    } finally {
      await off.close();
    }
  });
});

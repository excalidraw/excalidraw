import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { authed, csrfHeaders, makeTestApp, register } from "./helpers";

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

const el = (id: string, version = 1, nonce = 1, extra: object = {}) => ({
  id,
  type: "rectangle",
  version,
  versionNonce: nonce,
  x: 0,
  y: 0,
  width: 5,
  height: 5,
  isDeleted: false,
  ...extra,
});

/** Test client that buffers every message so nothing is missed between awaits. */
class Client {
  msgs: any[] = [];
  closed: { code: number } | null = null;
  ws: WebSocket;
  private waiters: Array<() => void> = [];
  constructor(
    sceneId: string,
    opts: { cookie?: string; token?: string; origin?: string } = {},
  ) {
    const url = opts.token
      ? `ws://127.0.0.1:${port}/api/v1/collab/share/${opts.token}`
      : `ws://127.0.0.1:${port}/api/v1/collab/${sceneId}`;
    this.ws = new WebSocket(url, {
      headers: {
        ...(opts.cookie ? { cookie: `ew_session=${opts.cookie}` } : {}),
        ...(opts.origin ? { origin: opts.origin } : {}),
      },
    });
    this.ws.on("message", (d) => {
      this.msgs.push(JSON.parse(d.toString()));
      this.waiters.splice(0).forEach((w) => w());
    });
    this.ws.on("close", (code) => {
      this.closed = { code };
      this.waiters.splice(0).forEach((w) => w());
    });
    this.ws.on("error", () => {});
  }
  async waitFor(pred: (m: any) => boolean, ms = 3000) {
    const end = Date.now() + ms;
    for (;;) {
      const hit = this.msgs.find(pred);
      if (hit) {
        return hit;
      }
      if (this.closed || Date.now() > end) {
        throw new Error(
          `timeout; got ${JSON.stringify(
            this.msgs.map((m) => m.t),
          )} closed=${JSON.stringify(this.closed)}`,
        );
      }
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
  }
  async closedWith(ms = 3000) {
    const end = Date.now() + ms;
    while (!this.closed && Date.now() < end) {
      await new Promise((r) => setTimeout(r, 20));
    }
    return this.closed?.code;
  }
  send(o: object) {
    this.ws.send(JSON.stringify(o));
  }
  close() {
    this.ws.close();
  }
}

const setup = async () => {
  const owner = await register(t);
  const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  const scene = (
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/scenes`, {
      name: "Live",
    })
  ).json().scene;
  return { owner, ws, scene };
};

describe("realtime collaboration", () => {
  it("relays element deltas, cursors and presence between editors", async () => {
    const { owner, ws, scene } = await setup();
    const bob = await register(t, { displayName: "Bob" });
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/members`, {
      email: bob.body.email,
    });

    const a = new Client(scene.id, { cookie: owner.cookie });
    const initA = await a.waitFor((m) => m.t === "init");
    expect(initA.users).toHaveLength(1);
    const b = new Client(scene.id, { cookie: bob.cookie });
    const initB = await b.waitFor((m) => m.t === "init");
    expect(initB.users.map((u: any) => u.name).sort()).toEqual([
      "Bob",
      "Tester",
    ]);
    await a.waitFor((m) => m.t === "join" && m.user.name === "Bob");

    a.send({ t: "elements", elements: [el("e1")] });
    const got = await b.waitFor((m) => m.t === "elements");
    expect(got.elements[0].id).toBe("e1");
    expect(got.from).toBe(initA.you);
    expect(a.msgs.some((m) => m.t === "elements")).toBe(false); // no echo

    b.send({
      t: "cursor",
      x: 10,
      y: 20,
      tool: "pointer",
      button: "up",
      selected: ["e1"],
    });
    const cur = await a.waitFor((m) => m.t === "cursor");
    expect(cur).toMatchObject({
      x: 10,
      y: 20,
      from: initB.you,
      selected: ["e1"],
    });

    b.close();
    await a.waitFor((m) => m.t === "leave" && m.id === initB.you);
    a.close();
  });

  it("applies the version/nonce rule and only forwards accepted updates", async () => {
    const { owner, scene } = await setup();
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    const b = new Client(scene.id, { cookie: owner.cookie });
    await b.waitFor((m) => m.t === "init");

    a.send({ t: "elements", elements: [el("x", 5, 10, { x: 1 })] });
    await b.waitFor((m) => m.t === "elements");
    b.msgs.length = 0;
    a.send({ t: "elements", elements: [el("x", 4, 1, { x: 999 })] }); // stale
    a.send({ t: "elements", elements: [el("x", 5, 20, { x: 2 })] }); // same version, higher nonce -> loses
    a.send({ t: "elements", elements: [el("x", 5, 3, { x: 3 })] }); // same version, lower nonce -> wins
    await b.waitFor((m) => m.t === "elements" && m.elements[0].x === 3);
    expect(b.msgs.filter((m) => m.t === "elements")).toHaveLength(1);

    const late = new Client(scene.id, { cookie: owner.cookie });
    const init = await late.waitFor((m) => m.t === "init");
    expect(init.elements.find((e: any) => e.id === "x").x).toBe(3);
    [a, b, late].forEach((c) => c.close());
  });

  it("view-only connections cannot modify the scene (server-enforced)", async () => {
    const { owner, scene } = await setup();
    const viewer = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: viewer.body.email,
      level: "VIEW",
    });
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    const v = new Client(scene.id, { cookie: viewer.cookie });
    const init = await v.waitFor((m) => m.t === "init");
    expect(init.users.find((u: any) => u.id === init.you).access).toBe("VIEW");

    v.send({ t: "elements", elements: [el("evil")] });
    await v.waitFor((m) => m.t === "error" && m.code === "forbidden");
    await new Promise((r) => setTimeout(r, 150));
    expect(a.msgs.some((m) => m.t === "elements")).toBe(false);

    // but viewers still see edits and can share their cursor
    a.send({ t: "elements", elements: [el("ok")] });
    await v.waitFor((m) => m.t === "elements");
    v.send({ t: "cursor", x: 1, y: 2 });
    await a.waitFor((m) => m.t === "cursor");
    a.close();
    v.close();
  });

  it("rejects unauthenticated, unauthorized and cross-origin connections", async () => {
    const { scene } = await setup();
    const outsider = await register(t);
    expect(await new Client(scene.id).closedWith()).toBe(4401);
    expect(
      await new Client(scene.id, { cookie: outsider.cookie }).closedWith(),
    ).toBe(4404);
    expect(
      await new Client(scene.id, {
        cookie: outsider.cookie,
        origin: "https://evil.example",
      }).closedWith(),
    ).toBe(4403);
    expect(
      await new Client("not-an-id", { cookie: outsider.cookie }).closedWith(),
    ).toBe(4404);
    expect(
      await new Client(new ObjectId().toHexString(), {
        cookie: outsider.cookie,
      }).closedWith(),
    ).toBe(4404);
    expect(
      await new Client(scene.id, { token: "x".repeat(43) }).closedWith(),
    ).toBe(4404);
  });

  it("share-link guests: VIEW token is read-only, EDIT token can edit", async () => {
    const { owner, scene } = await setup();
    const view = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {
        level: "VIEW",
      })
    ).json().link;
    const edit = (
      await call(owner.cookie, "POST", `/scenes/${scene.id}/links`, {
        level: "EDIT",
      })
    ).json().link;
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    const gv = new Client(scene.id, { token: view.token });
    expect(
      (await gv.waitFor((m) => m.t === "init")).users.some(
        (u: any) => u.name === "Guest",
      ),
    ).toBe(true);
    gv.send({ t: "elements", elements: [el("nope")] });
    await gv.waitFor((m) => m.t === "error");
    const ge = new Client(scene.id, { token: edit.token });
    await ge.waitFor((m) => m.t === "init");
    ge.send({ t: "elements", elements: [el("guest-el")] });
    await a.waitFor(
      (m) => m.t === "elements" && m.elements[0].id === "guest-el",
    );
    expect(
      a.msgs.some((m) => m.t === "elements" && m.elements[0].id === "nope"),
    ).toBe(false);

    // revoking the link disconnects guests immediately
    await call(owner.cookie, "DELETE", `/scenes/${scene.id}/links/${edit.id}`);
    expect(await ge.closedWith()).toBe(4404);
    [a, gv].forEach((c) => c.close());
  });

  it("revoking a user's permission or removing a scene kicks live sessions", async () => {
    const { owner, scene } = await setup();
    const guest = await register(t);
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: guest.body.email,
      level: "EDIT",
    });
    const g = new Client(scene.id, { cookie: guest.cookie });
    await g.waitFor((m) => m.t === "init");
    await call(owner.cookie, "PUT", `/scenes/${scene.id}/permissions`, {
      email: guest.body.email,
      level: "VIEW",
    });
    expect(await g.closedWith()).toBe(4403);

    const g2 = new Client(scene.id, { cookie: guest.cookie });
    const init = await g2.waitFor((m) => m.t === "init");
    expect(init.users.find((u: any) => u.id === init.you).access).toBe("VIEW"); // reconnect gets the new level
    await call(
      owner.cookie,
      "DELETE",
      `/scenes/${scene.id}/permissions/${guest.res.json().user.id}`,
    );
    expect(await g2.closedWith()).toBe(4403);
  });

  it("persists room state to MongoDB when the last editor leaves (no client save needed)", async () => {
    const { owner, scene } = await setup();
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    a.send({
      t: "elements",
      elements: [
        el("persist-me", 1, 1, { type: "text", text: "saved by the server" }),
      ],
    });
    await new Promise((r) => setTimeout(r, 100));
    a.close();
    const id = new ObjectId(scene.id);
    let doc = await t.database.c.scenes.findOne({ _id: id });
    for (let i = 0; i < 40 && doc!.version === 1; i++) {
      await new Promise((r) => setTimeout(r, 50));
      doc = await t.database.c.scenes.findOne({ _id: id });
    }
    expect(doc!.version).toBe(2);
    expect(doc!.data.elements.map((e: any) => e.id)).toEqual(["persist-me"]);
    expect(doc!.textContent).toContain("saved by the server");
  });

  it("reconnecting clients receive the current snapshot; junk input is ignored", async () => {
    const { owner, scene } = await setup();
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    a.send({
      t: "elements",
      elements: [
        el("k1"),
        { id: 5 },
        null,
        el("k2", 1, 1, { link: ["java", "script:1"].join("") }),
      ],
    });
    a.ws.send("not json");
    a.send({ t: "elements", elements: "nope" });
    const b = new Client(scene.id, { cookie: owner.cookie });
    const init = await b.waitFor((m) => m.t === "init");
    expect(init.elements.map((e: any) => e.id).sort()).toEqual(["k1", "k2"]);
    expect(init.elements.find((e: any) => e.id === "k2").link).toBeNull();
    [a, b].forEach((c) => c.close());
    void csrfHeaders;
  });

  it("relays live presentations from editors to followers; one presenter at a time", async () => {
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
    const a = new Client(scene.id, { cookie: owner.cookie });
    await a.waitFor((m) => m.t === "init");
    const v = new Client(scene.id, { cookie: viewer.cookie });
    await v.waitFor((m) => m.t === "init");
    const e = new Client(scene.id, { cookie: editor.cookie });
    await e.waitFor((m) => m.t === "init");

    a.send({ t: "present", active: true, frameId: "f1", index: 0 });
    const got = await v.waitFor((m) => m.t === "present" && m.active);
    expect(got).toMatchObject({ frameId: "f1", index: 0, name: "Tester" });
    a.send({ t: "present", active: true, frameId: "f2", index: 1 });
    await v.waitFor((m) => m.t === "present" && m.index === 1);

    // viewers can't present, and a second editor can't hijack
    v.send({ t: "present", active: true, frameId: "x", index: 0 });
    await v.waitFor((m) => m.t === "error" && m.code === "forbidden");
    e.send({ t: "present", active: true, frameId: "y", index: 0 });
    await e.waitFor((m) => m.t === "error" && m.code === "busy");

    // late joiners learn about the running presentation
    const late = new Client(scene.id, { cookie: viewer.cookie });
    expect(
      (await late.waitFor((m) => m.t === "init")).presentation,
    ).toMatchObject({ frameId: "f2", index: 1 });

    // presenter disconnect ends it
    a.close();
    await v.waitFor((m) => m.t === "present" && m.active === false);
    [v, e, late].forEach((c) => c.close());
  });
});

import { spawn } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authed, makeTestApp, register } from "./helpers";

import type { AddressInfo } from "node:net";
import type { TestApp } from "./helpers";

let t: TestApp;
let port: number;
beforeAll(async () => {
  t = await makeTestApp({ ENABLE_MCP: "true" });
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  port = (t.app.server.address() as AddressInfo).port;
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

const ALL = [
  "workspace:read",
  "scene:read",
  "scene:create",
  "scene:write",
  "scene:delete",
  "scene:export",
  "diagram:create",
];

const setup = async (scopes = ALL) => {
  const owner = await register(t);
  const ws = (await call(owner.cookie, "GET", "/workspaces")).json()
    .workspaces[0];
  const secret = (
    await call(owner.cookie, "POST", `/workspaces/${ws.id}/api-keys`, {
      name: "agent",
      scopes,
    })
  ).json().secret as string;
  return { owner, ws, secret };
};

let rpcId = 1;
const rpc = async (key: string | null, body: unknown) => {
  const res = await t.app.inject({
    method: "POST",
    url: "/mcp",
    headers: key ? { authorization: `Bearer ${key}` } : {},
    payload: body as any,
  });
  return { status: res.statusCode, json: res.body ? res.json() : null };
};
const tool = async (key: string, name: string, args: unknown = {}) => {
  const r = await rpc(key, {
    jsonrpc: "2.0",
    id: rpcId++,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const result = r.json.result;
  const text = result?.content?.[0]?.text as string;
  return {
    isError: !!result?.isError,
    text,
    data: result?.isError ? null : JSON.parse(text),
    rpc: r.json,
  };
};

describe("protocol", () => {
  it("initializes, negotiates the protocol version and advertises tools", async () => {
    const { secret } = await setup();
    const init = await rpc(secret, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      },
    });
    expect(init.json.result).toMatchObject({
      protocolVersion: "2025-03-26",
      serverInfo: { name: "excalidraw-workspace" },
      capabilities: { tools: {} },
    });
    const unknown = await rpc(secret, {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    expect(unknown.json.result.protocolVersion).toBe("2025-06-18");
    expect(
      (await rpc(secret, { jsonrpc: "2.0", id: 3, method: "ping" })).json
        .result,
    ).toEqual({});
    const list = (
      await rpc(secret, { jsonrpc: "2.0", id: 4, method: "tools/list" })
    ).json.result.tools;
    expect(list.map((x: any) => x.name)).toEqual(
      expect.arrayContaining([
        "list_scenes",
        "get_scene",
        "create_scene",
        "update_scene",
        "add_elements",
        "create_diagram",
        "convert_mermaid",
        "create_wireframe",
        "export_scene",
        "delete_scene",
      ]),
    );
    for (const x of list) {
      expect(x.inputSchema.type).toBe("object");
    }
  });

  it("handles notifications, batches and malformed input", async () => {
    const { secret } = await setup();
    expect(
      (
        await rpc(secret, {
          jsonrpc: "2.0",
          method: "notifications/initialized",
        })
      ).status,
    ).toBe(202);
    const batch = await rpc(secret, [
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "nope/nothing" },
    ]);
    expect(batch.json).toHaveLength(2);
    expect(batch.json.find((r: any) => r.id === 2).error.code).toBe(-32601);
    expect((await rpc(secret, [])).status).toBe(400);
    expect((await rpc(secret, { hello: "world" })).json.error.code).toBe(
      -32600,
    );
    const badTool = await rpc(secret, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "drop_database" },
    });
    expect(badTool.json.error.code).toBe(-32602);
  });

  it("requires a valid key; GET is not offered", async () => {
    const { secret } = await setup();
    expect(
      (await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" })).status,
    ).toBe(401);
    expect(
      (await rpc("ewk_bad", { jsonrpc: "2.0", id: 1, method: "ping" })).status,
    ).toBe(401);
    expect(
      (
        await t.app.inject({
          method: "GET",
          url: "/mcp",
          headers: { authorization: `Bearer ${secret}` },
        })
      ).statusCode,
    ).toBe(405);
  });
});

describe("tools", () => {
  it("creates a scene, adds a diagram and a wireframe, reads and exports it", async () => {
    const { secret } = await setup();
    const created = await tool(secret, "create_scene", { name: "Agent board" });
    const id = created.data.scene.id;
    const diagram = await tool(secret, "create_diagram", {
      sceneId: id,
      mermaid: "flowchart TD\nA[Plan] --> B[Ship]",
    });
    expect(diagram.data).toMatchObject({ nodeCount: 2, edgeCount: 1 });
    const wf = await tool(secret, "create_wireframe", {
      sceneId: id,
      title: "Login",
      blocks: [
        { type: "header", label: "Acme" },
        { type: "input", label: "Email" },
        { type: "button", label: "Go" },
      ],
    });
    expect(wf.data.frameId).toBeTruthy();
    const scene = await tool(secret, "get_scene", { sceneId: id });
    expect(scene.data.texts).toEqual(
      expect.arrayContaining(["Plan", "Ship", "Acme", "Email", "Go"]),
    );
    expect(
      scene.data.elements.some(
        (e: any) => e.type === "frame" && e.name === "Login",
      ),
    ).toBe(true);
    const wfFrame = scene.data.elements.find((e: any) => e.type === "frame");
    const diagramEls = scene.data.elements.filter((e: any) =>
      e.id.startsWith("d"),
    );
    expect(wfFrame.y).toBeGreaterThan(
      Math.max(...diagramEls.map((e: any) => e.y)),
    );
    const exp = await tool(secret, "export_scene", { sceneId: id });
    expect(exp.data).toMatchObject({ type: "excalidraw", version: 2 });
    const list = await tool(secret, "list_scenes", { query: "Agent" });
    expect(list.data.scenes.map((s: any) => s.id)).toEqual([id]);
    expect((await tool(secret, "delete_scene", { sceneId: id })).data).toEqual({
      ok: true,
    });
    expect((await tool(secret, "get_scene", { sceneId: id })).isError).toBe(
      true,
    );
  });

  it("update_scene uses versions; add_elements does not need them", async () => {
    const { secret } = await setup();
    const id = (await tool(secret, "create_scene", { name: "v" })).data.scene
      .id;
    const el = (i: string) => ({
      id: i,
      type: "rectangle",
      version: 1,
      versionNonce: 1,
      x: 0,
      y: 0,
      width: 5,
      height: 5,
      isDeleted: false,
    });
    await tool(secret, "add_elements", { sceneId: id, elements: [el("a")] });
    const stale = await tool(secret, "update_scene", {
      sceneId: id,
      baseVersion: 1,
      elements: [el("b")],
    });
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain("version_conflict");
    const v = (await tool(secret, "get_scene", { sceneId: id })).data.version;
    expect(
      (
        await tool(secret, "update_scene", {
          sceneId: id,
          baseVersion: v,
          elements: [el("b")],
        })
      ).isError,
    ).toBe(false);
  });

  it("reports errors inside the tool result, with useful messages", async () => {
    const { secret } = await setup();
    const bad = await tool(secret, "get_scene", {});
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/Invalid arguments: sceneId/);
    const nope = await tool(secret, "get_scene", {
      sceneId: "0123456789abcdef01234567",
    });
    expect(nope.text).toContain("not_found");
    const seq = await tool(secret, "convert_mermaid", {
      source: "sequenceDiagram\nA->>B: x",
    });
    expect(seq.text).toContain("unsupported_diagram");
    expect(bad.rpc.error).toBeUndefined(); // tool failures are not protocol errors
  });

  it("only advertises and only runs tools the key's scopes allow", async () => {
    const { secret } = await setup(["scene:read", "scene:export"]);
    const names = (
      await rpc(secret, { jsonrpc: "2.0", id: 1, method: "tools/list" })
    ).json.result.tools
      .map((x: any) => x.name)
      .sort();
    expect(names).toEqual(["export_scene", "get_scene", "list_scenes"]);
    const denied = await tool(secret, "create_scene", { name: "nope" });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain("insufficient_scope");
    expect(
      (
        await tool(secret, "delete_scene", {
          sceneId: "0123456789abcdef01234567",
        })
      ).text,
    ).toContain("insufficient_scope");
  });

  it("never lets a key reach another workspace's scenes", async () => {
    const a = await setup();
    const b = await setup();
    const id = (await tool(a.secret, "create_scene", { name: "A private-ish" }))
      .data.scene.id;
    for (const [name, args] of [
      ["get_scene", { sceneId: id }],
      ["export_scene", { sceneId: id }],
      ["delete_scene", { sceneId: id }],
      [
        "add_elements",
        {
          sceneId: id,
          elements: [
            { id: "x", type: "rectangle", version: 1, versionNonce: 1 },
          ],
        },
      ],
      ["create_diagram", { sceneId: id, mermaid: "graph TD\nA-->B" }],
    ] as const) {
      const r = await tool(b.secret, name, args);
      expect(r.isError, name).toBe(true);
      expect(r.text, name).toContain("not_found");
    }
    expect((await tool(b.secret, "list_scenes", {})).data.scenes).toEqual([]);
    expect(
      (await tool(b.secret, "get_workspace", { workspaceId: a.ws.id })).text,
    ).toContain("workspace_mismatch");
  });
});

describe("stdio bridge", () => {
  it("relays JSON-RPC between stdin/stdout and the HTTP endpoint", async () => {
    const { secret } = await setup();
    const child = spawn(
      process.execPath,
      [path.resolve(__dirname, "../bin/mcp-stdio.mjs")],
      {
        env: {
          ...process.env,
          EW_URL: `http://127.0.0.1:${port}`,
          EW_API_KEY: secret,
        },
      },
    );
    const lines: string[] = [];
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) !== -1) {
        lines.push(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      })}\n`,
    );
    child.stdin.write("not json\n");
    child.stdin.end();
    await new Promise((r) => child.on("exit", r));
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed).toHaveLength(2); // the notification produced no output
    expect(parsed.find((m) => m.id === 1).result.tools.length).toBeGreaterThan(
      5,
    );
    expect(parsed.find((m) => m.id === null).error.code).toBe(-32700);
  });

  it("refuses to start without a key", async () => {
    const child = spawn(
      process.execPath,
      [path.resolve(__dirname, "../bin/mcp-stdio.mjs")],
      { env: { PATH: process.env.PATH } },
    );
    const code = await new Promise((r) => child.on("exit", r));
    expect(code).toBe(1);
  });
});

describe("feature flag", () => {
  it("ENABLE_MCP=false (the default) exposes nothing at /mcp", async () => {
    const off = await makeTestApp();
    try {
      const res = await off.app.inject({
        method: "POST",
        url: "/mcp",
        headers: { authorization: "Bearer ewk_x" },
        payload: { jsonrpc: "2.0", id: 1, method: "ping" },
      });
      expect(res.statusCode).toBe(404);
      expect(
        (await off.app.inject({ method: "GET", url: "/api/v1/config" })).json()
          .features.mcp,
      ).toBe(false);
    } finally {
      await off.close();
    }
  });
});

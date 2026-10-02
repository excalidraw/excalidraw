import { z } from "zod";

import { authenticateApiKey, bearerOf } from "../apiKeys";
import { generateMermaid } from "../ai/generate";
import { buildWireframe, MAX_BLOCKS } from "../diagram/wireframe";
import { HttpError } from "../http";
import {
  addDiagramToScene,
  appendElements,
  convertMermaid,
  createScene,
  exportScene,
  getScene,
  getWorkspace,
  listScenes,
  loadScene,
  replaceSceneData,
  requireScope,
  trashScene,
} from "../publicOps";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiPrincipal } from "../apiKeys";
import type { ApiScope } from "../db";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_RESULT_CHARS = 200_000;

interface Tool {
  name: string;
  description: string;
  scopes: ApiScope[];
  inputSchema: Record<string, unknown>;
  run: (
    app: FastifyInstance,
    req: FastifyRequest,
    p: ApiPrincipal,
    args: any,
  ) => Promise<unknown> | unknown;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const str = (description: string) => ({ type: "string", description });
const wsProp = str(
  "Workspace id. Optional for workspace-scoped keys; required for personal keys that span workspaces.",
);
const elementsProp = {
  type: "array",
  items: { type: "object" },
  description: "Excalidraw elements (native format).",
};

const sceneId = z.object({ sceneId: z.string() });

const TOOLS: Tool[] = [
  {
    name: "get_workspace",
    description: "Workspace name and its folders.",
    scopes: ["workspace:read"],
    inputSchema: obj({ workspaceId: wsProp }),
    run: (app, _r, p, a) =>
      getWorkspace(
        app,
        p,
        z.object({ workspaceId: z.string().optional() }).parse(a).workspaceId,
      ),
  },
  {
    name: "list_scenes",
    description:
      "List scenes (drawings) newest first, optionally filtered by text or folder. Returns metadata only.",
    scopes: ["scene:read"],
    inputSchema: obj({
      workspaceId: wsProp,
      query: str("Search in names and text on the canvas."),
      folderId: str("Folder id, or 'root'."),
      limit: { type: "integer", minimum: 1, maximum: 100 },
      offset: { type: "integer", minimum: 0 },
    }),
    run: (app, _r, p, a) => {
      const x = z
        .object({
          workspaceId: z.string().optional(),
          query: z.string().max(100).optional(),
          folderId: z.string().optional(),
          limit: z.number().int().optional(),
          offset: z.number().int().optional(),
        })
        .parse(a);
      return listScenes(app, p, {
        workspaceId: x.workspaceId,
        q: x.query,
        folderId: x.folderId,
        limit: x.limit,
        offset: x.offset,
      });
    },
  },
  {
    name: "get_scene",
    description:
      "Read a scene including its elements (Excalidraw native format) and the text found on the canvas. Large scenes are truncated.",
    scopes: ["scene:read"],
    inputSchema: obj({ sceneId: str("Scene id.") }, ["sceneId"]),
    run: async (app, req, p, a) => {
      const { scene } = await getScene(app, req, p, sceneId.parse(a).sceneId);
      const els = ((scene as any).data?.elements ?? []) as any[];
      const live = els.filter((e) => !e.isDeleted);
      const texts = live.filter((e) => e.type === "text").map((e) => e.text);
      const { data: _d, ...meta } = scene as any;
      let payload: any = {
        scene: meta,
        version: meta.version,
        elementCount: live.length,
        texts,
        elements: els,
        appState: (scene as any).data?.appState,
      };
      if (JSON.stringify(payload).length > MAX_RESULT_CHARS) {
        payload = {
          ...payload,
          elements: live.slice(0, 150),
          truncated: true,
          note: `Showing 150 of ${live.length} elements. Use export_scene for everything.`,
        };
      }
      return payload;
    },
  },
  {
    name: "create_scene",
    description: "Create a new scene, optionally with initial elements.",
    scopes: ["scene:create"],
    inputSchema: obj({
      workspaceId: wsProp,
      name: str("Scene name."),
      folderId: str("Folder id."),
      elements: elementsProp,
    }),
    run: (app, req, p, a) => {
      const x = z
        .object({
          workspaceId: z.string().optional(),
          name: z.string().max(200).optional(),
          folderId: z.string().optional(),
          elements: z.array(z.record(z.unknown())).optional(),
        })
        .parse(a);
      return createScene(app, req, p, {
        workspaceId: x.workspaceId,
        name: x.name,
        folderId: x.folderId,
        data: x.elements ? { elements: x.elements, appState: {} } : undefined,
      });
    },
  },
  {
    name: "update_scene",
    description:
      "Replace ALL elements of a scene (elements you omit are removed). Needs the scene's current version; use add_elements to add without replacing.",
    scopes: ["scene:write"],
    inputSchema: obj(
      {
        sceneId: str("Scene id."),
        baseVersion: {
          type: "integer",
          minimum: 1,
          description: "Version from get_scene.",
        },
        elements: elementsProp,
      },
      ["sceneId", "baseVersion", "elements"],
    ),
    run: (app, req, p, a) => {
      const x = z
        .object({
          sceneId: z.string(),
          baseVersion: z.number().int().min(1),
          elements: z.array(z.record(z.unknown())),
        })
        .parse(a);
      return replaceSceneData(app, req, p, x.sceneId, {
        baseVersion: x.baseVersion,
        elements: x.elements as any[],
      });
    },
  },
  {
    name: "add_elements",
    description:
      "Add (or update by id) elements in a scene without touching the rest. Safe to call while people are editing.",
    scopes: ["scene:write"],
    inputSchema: obj({ sceneId: str("Scene id."), elements: elementsProp }, [
      "sceneId",
      "elements",
    ]),
    run: (app, req, p, a) => {
      const x = z
        .object({
          sceneId: z.string(),
          elements: z.array(z.record(z.unknown())).min(1).max(5000),
        })
        .parse(a);
      return appendElements(app, req, p, x.sceneId, x.elements as any[]);
    },
  },
  {
    name: "convert_mermaid",
    description:
      "Convert Mermaid flowchart source into Excalidraw elements without saving anything. No AI involved.",
    scopes: ["diagram:create"],
    inputSchema: obj(
      { source: str("Mermaid source, e.g. 'flowchart TD\\nA --> B'.") },
      ["source"],
    ),
    run: (_a, _r, p, a) =>
      convertMermaid(
        p,
        z.object({ source: z.string().min(3).max(50_000) }).parse(a).source,
      ),
  },
  {
    name: "create_diagram",
    description:
      "Add a diagram to a scene, below its existing content. Give either Mermaid source (flowcharts, no AI) or a plain-language prompt (uses the workspace's configured AI and daily limits).",
    scopes: ["diagram:create", "scene:write"],
    inputSchema: obj(
      {
        sceneId: str("Scene id."),
        mermaid: str("Mermaid flowchart source."),
        prompt: str("What to draw, in words."),
      },
      ["sceneId"],
    ),
    run: async (app, req, p, a) => {
      const x = z
        .object({
          sceneId: z.string(),
          mermaid: z.string().min(3).max(50_000).optional(),
          prompt: z.string().min(3).max(4000).optional(),
        })
        .refine(
          (v) => !!v.mermaid !== !!v.prompt,
          "Provide exactly one of mermaid or prompt",
        )
        .parse(a);
      let mermaid = x.mermaid;
      if (x.prompt) {
        const scene = await loadScene(app, req, p, x.sceneId, "write", {
          projection: { data: 0, textContent: 0, thumbnail: 0 },
        });
        const role = (
          await app.database.c.workspaceMembers.findOne({
            workspaceId: scene.workspaceId,
            userId: p.userId,
          })
        )?.role;
        if (!role) {
          throw new HttpError(
            403,
            "forbidden",
            "The key's owner is no longer a member of this workspace.",
          );
        }
        mermaid = (
          await generateMermaid(
            app,
            { workspaceId: scene.workspaceId, userId: p.userId, role },
            x.prompt,
          )
        ).mermaid;
      }
      return {
        ...(await addDiagramToScene(app, req, p, x.sceneId, mermaid!)),
        mermaid,
      };
    },
  },
  {
    name: "create_wireframe",
    description:
      "Add a low-fidelity UI wireframe (a frame with stacked blocks) to a scene. Block types: header, nav, hero, heading, text, button, input, image, card, list, footer, divider.",
    scopes: ["diagram:create", "scene:write"],
    inputSchema: obj(
      {
        sceneId: str("Scene id."),
        title: str("Screen name shown on the frame."),
        device: { type: "string", enum: ["mobile", "tablet", "desktop"] },
        blocks: {
          type: "array",
          maxItems: MAX_BLOCKS,
          items: obj(
            {
              type: {
                type: "string",
                enum: [
                  "header",
                  "nav",
                  "hero",
                  "heading",
                  "text",
                  "button",
                  "input",
                  "image",
                  "card",
                  "list",
                  "footer",
                  "divider",
                ],
              },
              label: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              lines: { type: "integer" },
            },
            ["type"],
          ),
        },
      },
      ["sceneId", "blocks"],
    ),
    run: async (app, req, p, a) => {
      requireScope(p, "diagram:create");
      const x = z
        .object({
          sceneId: z.string(),
          title: z.string().max(80).optional(),
          device: z.enum(["mobile", "tablet", "desktop"]).optional(),
          blocks: z
            .array(
              z.object({
                type: z.enum([
                  "header",
                  "nav",
                  "hero",
                  "heading",
                  "text",
                  "button",
                  "input",
                  "image",
                  "card",
                  "list",
                  "footer",
                  "divider",
                ]),
                label: z.string().max(80).optional(),
                items: z.array(z.string().max(80)).max(20).optional(),
                lines: z.number().int().min(1).max(12).optional(),
              }),
            )
            .min(1)
            .max(MAX_BLOCKS),
        })
        .parse(a);
      const scene = await loadScene(app, req, p, x.sceneId, "write", {
        projection: { textContent: 0 },
      });
      const live = (scene.data.elements as any[]).filter((e) => !e.isDeleted);
      const origin = live.length
        ? {
            x: Math.min(...live.map((e) => e.x)),
            y: Math.max(...live.map((e) => e.y + (e.height ?? 0))) + 80,
          }
        : { x: 0, y: 0 };
      const wf = buildWireframe(
        { title: x.title, device: x.device, blocks: x.blocks },
        { origin, idPrefix: `wf${Date.now().toString(36)}` },
      );
      const els = wf.elements.map(({ index: _i, ...rest }) => rest);
      const out = await appendElements(app, req, p, x.sceneId, els);
      return {
        ...out,
        frameId: wf.frameId,
        width: wf.width,
        height: wf.height,
      };
    },
  },
  {
    name: "export_scene",
    description:
      "Export a scene as a native .excalidraw document (elements, appState and, optionally, embedded images).",
    scopes: ["scene:export"],
    inputSchema: obj(
      {
        sceneId: str("Scene id."),
        includeFiles: {
          type: "boolean",
          description: "Embed image files as data URLs.",
        },
      },
      ["sceneId"],
    ),
    run: (app, req, p, a) => {
      const x = z
        .object({ sceneId: z.string(), includeFiles: z.boolean().optional() })
        .parse(a);
      return exportScene(app, req, p, x.sceneId, {
        includeFiles: x.includeFiles,
      });
    },
  },
  {
    name: "delete_scene",
    description: "Move a scene to the trash (recoverable for 30 days).",
    scopes: ["scene:delete"],
    inputSchema: obj({ sceneId: str("Scene id.") }, ["sceneId"]),
    run: (app, req, p, a) => trashScene(app, req, p, sceneId.parse(a).sceneId),
  },
];

const rpcError = (id: unknown, code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});
const rpcOk = (id: unknown, result: unknown) => ({
  jsonrpc: "2.0",
  id,
  result,
});

/**
 * MCP server (Streamable HTTP, JSON responses). Authenticated by the same scoped API keys as
 * the REST API; every tool calls the shared, authorization-checking operations.
 */
export const mcpRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  if (!config.flags.mcp) {
    return;
  }

  const handle = async (
    req: FastifyRequest,
    p: ApiPrincipal,
    msg: any,
  ): Promise<unknown | null> => {
    const id = msg?.id;
    const isNotification = id === undefined || id === null;
    if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      // a malformed message always gets an answer (id null when it had none)
      return rpcError(id, -32600, "Invalid Request");
    }
    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return rpcOk(id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked)
            ? asked
            : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "excalidraw-workspace", version: "0.1.0" },
          instructions:
            "Tools operate on the scenes of one workspace, limited by this API key's scopes. Scene ids come from list_scenes.",
        });
      }
      case "ping":
        return rpcOk(id, {});
      case "tools/list":
        return rpcOk(id, {
          // only advertise what this key can actually call
          tools: TOOLS.filter((t) =>
            t.scopes.every((s) => p.scopes.has(s)),
          ).map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        });
      case "tools/call": {
        const tool = TOOLS.find((t) => t.name === msg.params?.name);
        if (!tool) {
          return rpcError(
            id,
            -32602,
            `Unknown tool: ${String(msg.params?.name).slice(0, 60)}`,
          );
        }
        const started = Date.now();
        try {
          const missing = tool.scopes.find((s) => !p.scopes.has(s));
          if (missing) {
            throw new HttpError(
              403,
              "insufficient_scope",
              `This API key lacks the "${missing}" scope.`,
            );
          }
          const out = await tool.run(app, req, p, msg.params?.arguments ?? {});
          let text = JSON.stringify(out);
          if (text.length > MAX_RESULT_CHARS * 2) {
            text = JSON.stringify({
              truncated: true,
              note: "Result too large; narrow the request or use export_scene.",
            });
          }
          return rpcOk(id, { content: [{ type: "text", text }] });
        } catch (e: any) {
          // Tool failures are reported inside the result so the model can react to them.
          const message =
            e?.name === "ZodError"
              ? `Invalid arguments: ${e.issues
                  .map(
                    (i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`,
                  )
                  .join("; ")}`
              : e instanceof HttpError
              ? `${e.code}: ${e.message}`
              : "Internal error";
          if (!(e instanceof HttpError) && e?.name !== "ZodError") {
            req.log.error(
              { tool: tool.name, err: e?.message },
              "mcp tool failed",
            );
          }
          return rpcOk(id, {
            isError: true,
            content: [{ type: "text", text: message }],
          });
        } finally {
          // never log arguments/results: they contain private drawing content
          req.log.info(
            {
              mcpTool: tool.name,
              ms: Date.now() - started,
              key: `ewk_${p.key.prefix}`,
            },
            "mcp tool call",
          );
        }
      }
      default:
        if (msg.method.startsWith("notifications/")) {
          return null;
        }
        return isNotification
          ? null
          : rpcError(
              id,
              -32601,
              `Method not found: ${String(msg.method).slice(0, 60)}`,
            );
    }
  };

  app.post(
    "/mcp",
    {
      bodyLimit: 12 * 1024 * 1024,
      config: {
        rateLimit: {
          max: config.apiRateLimit,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) =>
            (bearerOf(req) ?? "").slice(0, 15) || `ip:${req.ip}`,
        },
      },
    },
    async (req, reply) => {
      const raw = bearerOf(req);
      const principal = raw
        ? await authenticateApiKey(database, raw, config.encryptionKey)
        : null;
      if (!principal) {
        return reply
          .header("www-authenticate", 'Bearer realm="excalidraw-workspace"')
          .code(401)
          .send({ error: "invalid_api_key" });
      }
      const body = req.body as unknown;
      if (body === null || typeof body !== "object") {
        return reply.code(400).send(rpcError(null, -32700, "Parse error"));
      }
      if (Array.isArray(body)) {
        if (body.length === 0 || body.length > 50) {
          return reply.code(400).send(rpcError(null, -32600, "Invalid batch"));
        }
        const results = (
          await Promise.all(body.map((m) => handle(req, principal, m)))
        ).filter((r) => r !== null);
        return results.length ? results : reply.code(202).send();
      }
      const out = await handle(req, principal, body);
      return out === null ? reply.code(202).send() : out;
    },
  );

  // Server-initiated streams are not offered; clients should POST.
  app.get("/mcp", async (_req, reply) =>
    reply
      .code(405)
      .header("allow", "POST")
      .send({ error: "method_not_allowed" }),
  );
};

export const MCP_TOOL_NAMES = TOOLS.map((t) => t.name);

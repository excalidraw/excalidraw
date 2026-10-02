import { z } from "zod";

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
  resolveWorkspace,
  trashScene,
} from "../publicOps";
import { generateMermaid } from "../ai/generate";
import { authenticateApiKey, bearerOf } from "../apiKeys";
import { HttpError } from "../http";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiPrincipal } from "../apiKeys";

declare module "fastify" {
  interface FastifyRequest {
    apiPrincipal: ApiPrincipal | null;
  }
}

const BIG = 10 * 1024 * 1024 + 512 * 1024;

/**
 * Public REST API, authenticated ONLY by `Authorization: Bearer ewk_…` (cookies are ignored).
 * Every operation re-checks its scope and confinement in publicOps.
 */
export const publicApiRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  app.decorateRequest("apiPrincipal", null);

  const rateLimit = {
    config: {
      rateLimit: {
        max: config.apiRateLimit,
        timeWindow: "1 minute",
        // per key, not per IP: an agent fleet behind one NAT must not share a budget
        keyGenerator: (req: FastifyRequest) =>
          (bearerOf(req) ?? "").slice(0, 15) || `ip:${req.ip}`,
      },
    },
  };

  app.addHook("preHandler", async (req, reply) => {
    const raw = bearerOf(req);
    const principal = raw
      ? await authenticateApiKey(database, raw, config.encryptionKey)
      : null;
    if (!principal) {
      // identical response whether the key is missing, malformed, unknown, expired or revoked
      return reply
        .header("www-authenticate", 'Bearer realm="excalidraw-workspace"')
        .code(401)
        .send({ error: "invalid_api_key" });
    }
    req.apiPrincipal = principal;
  });

  const P = (req: FastifyRequest) => req.apiPrincipal!;

  app.get("/me", rateLimit, async (req) => {
    const p = P(req);
    const user = await database.c.users.findOne(
      { _id: p.userId },
      { projection: { displayName: 1 } },
    );
    return {
      key: {
        name: p.key.name,
        kind: p.key.kind,
        prefix: `ewk_${p.key.prefix}`,
        scopes: p.key.scopes,
        workspaceId: p.workspaceId?.toHexString() ?? null,
        expiresAt: p.key.expiresAt?.toISOString() ?? null,
      },
      user: {
        id: p.userId.toHexString(),
        displayName: user?.displayName ?? null,
      },
    };
  });

  app.get("/workspace", rateLimit, async (req) =>
    getWorkspace(app, P(req), (req.query as any).workspaceId),
  );

  app.get("/scenes", rateLimit, async (req) => {
    const q = z
      .object({
        workspaceId: z.string().optional(),
        q: z.string().max(100).optional(),
        folderId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).max(100_000).optional(),
      })
      .parse(req.query);
    return listScenes(app, P(req), q);
  });

  app.post("/scenes", { ...rateLimit, bodyLimit: BIG }, async (req, reply) => {
    const body = z
      .object({
        workspaceId: z.string().optional(),
        name: z.string().max(200).optional(),
        folderId: z.string().nullable().optional(),
        data: z.unknown().optional(),
      })
      .parse(req.body ?? {});
    return reply.code(201).send(await createScene(app, req, P(req), body));
  });

  app.get("/scenes/:id", rateLimit, async (req) =>
    getScene(app, req, P(req), (req.params as any).id),
  );

  app.put("/scenes/:id/data", { ...rateLimit, bodyLimit: BIG }, async (req) => {
    const body = z
      .object({
        baseVersion: z.number().int().min(1),
        elements: z.array(z.record(z.unknown())),
        appState: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    return replaceSceneData(
      app,
      req,
      P(req),
      (req.params as any).id,
      body as any,
    );
  });

  app.post(
    "/scenes/:id/elements",
    { ...rateLimit, bodyLimit: BIG },
    async (req) => {
      const body = z
        .object({ elements: z.array(z.record(z.unknown())).min(1).max(5000) })
        .parse(req.body);
      return appendElements(
        app,
        req,
        P(req),
        (req.params as any).id,
        body.elements,
      );
    },
  );

  app.post("/scenes/:id/diagram", rateLimit, async (req) => {
    const body = z
      .object({
        mermaid: z.string().min(3).max(50_000).optional(),
        prompt: z.string().min(3).max(4000).optional(),
      })
      .refine(
        (b) => !!b.mermaid !== !!b.prompt,
        "Provide exactly one of mermaid or prompt",
      )
      .parse(req.body);
    const p = P(req);
    let mermaid = body.mermaid;
    let remaining: number | null | undefined;
    if (body.prompt) {
      // prompt -> AI is checked like any member request (role, allow-list, daily limits)
      requireScope(p, "diagram:create");
      requireScope(p, "scene:write");
      const scene = await loadScene(
        app,
        req,
        p,
        (req.params as any).id,
        "write",
        { projection: { data: 0, textContent: 0, thumbnail: 0 } },
      );
      const role = (
        await database.c.workspaceMembers.findOne({
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
      const gen = await generateMermaid(
        app,
        { workspaceId: scene.workspaceId, userId: p.userId, role },
        body.prompt,
      );
      mermaid = gen.mermaid;
      remaining = gen.remaining;
    }
    const out = await addDiagramToScene(
      app,
      req,
      p,
      (req.params as any).id,
      mermaid!,
    );
    return {
      ...out,
      mermaid,
      ...(remaining !== undefined ? { aiRemaining: remaining } : {}),
    };
  });

  app.get("/scenes/:id/export", rateLimit, async (req, reply) => {
    const q = z
      .object({ includeFiles: z.enum(["true", "false"]).optional() })
      .parse(req.query);
    const doc = await exportScene(app, req, P(req), (req.params as any).id, {
      includeFiles: q.includeFiles === "true",
    });
    return reply
      .header("content-type", "application/vnd.excalidraw+json")
      .header("content-disposition", 'attachment; filename="scene.excalidraw"')
      .send(doc);
  });

  app.delete("/scenes/:id", rateLimit, async (req, reply) => {
    await trashScene(app, req, P(req), (req.params as any).id);
    return reply.code(204).send();
  });

  app.post("/diagrams/mermaid", rateLimit, async (req) => {
    const { source } = z
      .object({ source: z.string().min(3).max(50_000) })
      .parse(req.body);
    return convertMermaid(P(req), source);
  });

  void resolveWorkspace;
};

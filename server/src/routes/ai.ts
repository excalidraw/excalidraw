import { ObjectId } from "mongodb";
import { z } from "zod";

import { MermaidStreamFilter } from "../ai/mermaidStream";
import { generateMermaid } from "../ai/generate";
import { assertSafeBaseUrl, UnsafeUrlError } from "../ai/urlSafety";
import { DIAGRAM_SYSTEM_PROMPT } from "../ai/prompt";
import {
  complete,
  createProvider,
  PROVIDER_IDS,
  PROVIDERS,
  ProviderError,
} from "../ai/providers";
import {
  aiKeyPurpose,
  isConfigured,
  LimitReachedError,
  memberMayUse,
  reserveRequest,
  resolveAi,
  toProviderConfig,
  usageToday,
} from "../ai/service";
import {
  MermaidSyntaxError,
  mermaidToElements,
  UnsupportedDiagramError,
} from "../diagram/mermaid";
import {
  HttpError,
  requireUser,
  requireWorkspacePermission,
  sessionRateKey,
} from "../http";
import { writeAudit } from "../repos/audit";
import { encryptSecret } from "../security/crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EffectiveAi, Reservation } from "../ai/service";
import type { ChatMessage } from "../ai/providers";
import type { AiSettingsDoc } from "../db";

const MAX_MESSAGES = 30;
const MAX_TOTAL_CHARS = 24_000;

const messagesBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(12_000),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

const settingsBody = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(PROVIDER_IDS as unknown as [string, ...string[]]),
  model: z.string().trim().min(1).max(200).optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  apiKey: z.string().trim().min(8).max(500).optional(),
  clearApiKey: z.boolean().optional(),
  workspaceDailyLimit: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  userDailyLimit: z.number().int().min(0).max(1_000_000).nullable().optional(),
  allowedMembers: z
    .union([z.literal("all"), z.array(z.string().length(24)).max(500)])
    .optional(),
});

/** Chat history from the client: only user/assistant turns are trusted; our system prompt is always ours. */
const sanitizeMessages = (
  input: z.infer<typeof messagesBody>["messages"],
): ChatMessage[] => {
  const turns = input.filter(
    (m) => m.role !== "system" && m.content.trim() !== "",
  ) as ChatMessage[];
  while (turns.length && turns[0]!.role !== "user") {
    turns.shift(); // providers require the conversation to start with a user turn
  }
  const total = turns.reduce((n, m) => n + m.content.length, 0);
  if (turns.length === 0) {
    throw new HttpError(400, "empty_conversation");
  }
  if (total > MAX_TOTAL_CHARS) {
    throw new HttpError(413, "conversation_too_long");
  }
  return turns;
};

export const aiRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  if (!config.flags.ai) {
    return;
  }
  const guard = { preHandler: app.requireAuth };
  const fetchImpl = app.aiFetch;

  /** Resolves config and enforces workspace membership, allow-list and configuration. */
  const authorizeUse = async (req: FastifyRequest) => {
    const ctx = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "ai:use",
    );
    const eff = await resolveAi(database, config, ctx.workspaceId);
    if (!eff || !eff.enabled) {
      throw new HttpError(
        409,
        "ai_disabled",
        "AI is not enabled for this workspace.",
      );
    }
    if (!isConfigured(eff)) {
      throw new HttpError(
        409,
        "ai_not_configured",
        "AI is enabled but has no API key yet. Ask a workspace admin.",
      );
    }
    if (!memberMayUse(eff, ctx.user._id, ctx.role)) {
      throw new HttpError(
        403,
        "ai_not_allowed",
        "You are not allowed to use AI in this workspace.",
      );
    }
    return { ...ctx, eff };
  };

  const reserve = async (
    eff: EffectiveAi,
    ctx: { workspaceId: ObjectId; user: { _id: ObjectId } },
  ) => {
    try {
      return await reserveRequest(
        database,
        ctx.workspaceId,
        ctx.user._id,
        eff.limits,
      );
    } catch (e) {
      if (e instanceof LimitReachedError) {
        throw new HttpError(429, "ai_limit_reached", e.message);
      }
      throw e;
    }
  };

  const rateHeaders = (r: Reservation) => ({
    ...(r.limit !== null ? { "x-ratelimit-limit": String(r.limit) } : {}),
    ...(r.remaining !== null
      ? { "x-ratelimit-remaining": String(r.remaining) }
      : {}),
  });

  const providerFor = async (eff: EffectiveAi) => {
    if (eff.baseUrl) {
      try {
        await assertSafeBaseUrl(eff.baseUrl, config.ai.allowPrivateBaseUrls);
      } catch (e) {
        if (e instanceof UnsafeUrlError) {
          throw new HttpError(
            409,
            "unsafe_base_url",
            `The configured endpoint is not allowed: ${e.message}`,
          );
        }
        throw e;
      }
    }
    return createProvider(toProviderConfig(eff, fetchImpl));
  };

  const failFrom = (e: unknown): never => {
    if (e instanceof ProviderError) {
      throw new HttpError(
        e.status === 429 ? 429 : e.status,
        e.status === 429 ? "provider_rate_limited" : "provider_error",
        e.message,
      );
    }
    throw e;
  };

  // ---- discovery / status ------------------------------------------------------------

  app.get("/ai/providers", guard, async () => ({
    providers: Object.values(PROVIDERS),
    instanceDefault: config.ai.provider ?? null,
  }));

  /** What a member needs to know: can I use AI here, and how much is left today? */
  app.get("/workspaces/:id/ai/status", guard, async (req) => {
    const ctx = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "workspace:read",
    );
    const eff = await resolveAi(database, config, ctx.workspaceId);
    if (!eff || !eff.enabled) {
      return { available: false, reason: "disabled" };
    }
    if (!isConfigured(eff)) {
      return { available: false, reason: "not_configured" };
    }
    if (!memberMayUse(eff, ctx.user._id, ctx.role)) {
      return { available: false, reason: "not_allowed" };
    }
    const usage = await database.c.aiUsage.findOne({
      workspaceId: ctx.workspaceId,
      scope: "user",
      userId: ctx.user._id,
      day: new Date().toISOString().slice(0, 10),
    });
    const wsUsage = await database.c.aiUsage.findOne({
      workspaceId: ctx.workspaceId,
      scope: "workspace",
      day: new Date().toISOString().slice(0, 10),
    });
    const left = [
      eff.limits.user > 0 ? eff.limits.user - (usage?.count ?? 0) : Infinity,
      eff.limits.workspace > 0
        ? eff.limits.workspace - (wsUsage?.count ?? 0)
        : Infinity,
    ];
    const remaining = Math.min(...left);
    return {
      available: true,
      remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null,
    };
  });

  // ---- admin settings (keys are write-only) -----------------------------------------------

  const settingsView = async (workspaceId: ObjectId) => {
    const doc = await database.c.aiSettings.findOne({ workspaceId });
    const eff = await resolveAi(database, config, workspaceId);
    return {
      configured: isConfigured(eff),
      source: eff?.source ?? "none",
      enabled: eff?.enabled ?? false,
      provider: eff?.provider ?? config.ai.provider ?? "openai",
      model:
        eff?.model ?? PROVIDERS[config.ai.provider ?? "openai"].defaultModel,
      baseUrl: eff?.baseUrl ?? null,
      keySource: eff?.keySource ?? "none",
      keyLast4: doc?.apiKeyLast4 ?? null,
      workspaceDailyLimit: doc?.workspaceDailyLimit ?? null,
      userDailyLimit: doc?.userDailyLimit ?? null,
      effectiveLimits: eff?.limits ?? {
        workspace: config.ai.defaultWorkspaceLimit,
        user: config.ai.defaultUserLimit,
      },
      allowedMembers: eff
        ? eff.allowedMembers === "all"
          ? "all"
          : eff.allowedMembers.map((i) => i.toHexString())
        : "all",
      instanceDefaults: {
        provider: config.ai.provider ?? null,
        hasKey: !!config.ai.apiKey,
      },
    };
  };

  app.get("/workspaces/:id/ai/settings", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "ai:configure",
    );
    return settingsView(workspaceId);
  });

  app.put("/workspaces/:id/ai/settings", guard, async (req) => {
    const { workspaceId, user } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "ai:configure",
    );
    const body = settingsBody.parse(req.body);
    const provider = body.provider as keyof typeof PROVIDERS;
    const info = PROVIDERS[provider];
    if (body.baseUrl && !info.customBaseUrl) {
      throw new HttpError(
        400,
        "base_url_not_supported",
        `${info.label} uses a fixed endpoint.`,
      );
    }
    if (body.baseUrl) {
      try {
        await assertSafeBaseUrl(body.baseUrl, config.ai.allowPrivateBaseUrls);
      } catch (e) {
        if (e instanceof UnsafeUrlError) {
          throw new HttpError(400, "unsafe_base_url", e.message);
        }
        throw e;
      }
    }
    let allowed: AiSettingsDoc["allowedMembers"] | undefined;
    if (body.allowedMembers !== undefined) {
      if (body.allowedMembers === "all") {
        allowed = "all";
      } else {
        const ids = body.allowedMembers
          .filter((i) => ObjectId.isValid(i))
          .map((i) => new ObjectId(i));
        const members = await database.c.workspaceMembers
          .find({ workspaceId, userId: { $in: ids } })
          .toArray();
        if (members.length !== new Set(body.allowedMembers).size) {
          throw new HttpError(
            400,
            "unknown_member",
            "allowedMembers must all be members of this workspace",
          );
        }
        allowed = members.map((m) => m.userId);
      }
    }
    const existing = await database.c.aiSettings.findOne({ workspaceId });
    const set: Partial<AiSettingsDoc> = {
      provider,
      model:
        body.model ??
        (existing?.provider === provider ? existing.model : info.defaultModel),
      baseUrl: info.customBaseUrl
        ? body.baseUrl ??
          (existing?.provider === provider ? existing.baseUrl : null)
        : null,
      updatedAt: new Date(),
      updatedBy: user._id,
    };
    if (body.enabled !== undefined) {
      set.enabled = body.enabled;
    }
    if (body.workspaceDailyLimit !== undefined) {
      set.workspaceDailyLimit = body.workspaceDailyLimit;
    }
    if (body.userDailyLimit !== undefined) {
      set.userDailyLimit = body.userDailyLimit;
    }
    if (allowed !== undefined) {
      set.allowedMembers = allowed;
    }
    let keyChanged = false;
    if (body.apiKey) {
      set.apiKeyEnc = encryptSecret(
        body.apiKey,
        config.encryptionKey,
        aiKeyPurpose,
      );
      set.apiKeyLast4 = body.apiKey.slice(-4);
      keyChanged = true;
    } else if (
      body.clearApiKey ||
      (existing && existing.provider !== provider)
    ) {
      // switching provider must never carry the old provider's key over
      set.apiKeyEnc = null;
      set.apiKeyLast4 = null;
      keyChanged = !!existing?.apiKeyEnc;
    }
    await database.c.aiSettings.updateOne(
      { workspaceId },
      {
        $set: set,
        $setOnInsert: {
          _id: new ObjectId(),
          workspaceId,
          ...(set.enabled === undefined ? { enabled: false } : {}),
          ...(set.apiKeyEnc === undefined
            ? { apiKeyEnc: null, apiKeyLast4: null }
            : {}),
          ...(set.workspaceDailyLimit === undefined
            ? { workspaceDailyLimit: null }
            : {}),
          ...(set.userDailyLimit === undefined ? { userDailyLimit: null } : {}),
          ...(set.allowedMembers === undefined
            ? { allowedMembers: "all" as const }
            : {}),
        },
      },
      { upsert: true },
    );
    await writeAudit(database, {
      action: "AI_SETTINGS_CHANGED",
      actorId: user._id,
      workspaceId,
      // never the key itself
      meta: {
        provider,
        model: set.model,
        enabled: set.enabled,
        keyChanged,
        limits: [set.workspaceDailyLimit, set.userDailyLimit],
        allowedMembers:
          allowed === undefined
            ? undefined
            : allowed === "all"
            ? "all"
            : allowed.length,
      },
      ip: req.ip,
    });
    return settingsView(workspaceId);
  });

  app.get("/workspaces/:id/ai/usage", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "ai:configure",
    );
    return usageToday(database, workspaceId);
  });

  /** Sends a one-word prompt to check credentials/endpoint without consuming the budget. */
  app.post(
    "/workspaces/:id/ai/test",
    {
      ...guard,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: sessionRateKey,
        },
      },
    },
    async (req) => {
      const { workspaceId } = await requireWorkspacePermission(
        req,
        (req.params as any).id,
        "ai:configure",
      );
      const eff = await resolveAi(database, config, workspaceId);
      if (!isConfigured(eff)) {
        throw new HttpError(
          409,
          "ai_not_configured",
          "Set a provider and API key first.",
        );
      }
      const provider = await providerFor(eff);
      try {
        const { text } = await complete(provider, {
          model: eff.model,
          system: "Reply with the single word OK.",
          messages: [{ role: "user", content: "ping" }],
          maxTokens: 16,
          temperature: 0,
        });
        return {
          ok: true,
          provider: eff.provider,
          model: eff.model,
          sample: text.slice(0, 40),
        };
      } catch (e) {
        return failFrom(e);
      }
    },
  );

  // ---- generation ----------------------------------------------------------------------

  const sse = (reply: FastifyReply, headers: Record<string, string>) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...headers,
    });
    return (obj: unknown) =>
      reply.raw.write(
        `data: ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n\n`,
      );
  };

  /** Streaming endpoint consumed by the editor's Text-to-diagram dialog. */
  app.post(
    "/workspaces/:id/ai/text-to-diagram/chat-streaming",
    {
      ...guard,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: sessionRateKey,
        },
      },
    },
    async (req, reply) => {
      const ctx = await authorizeUse(req);
      const messages = sanitizeMessages(messagesBody.parse(req.body).messages);
      const provider = await providerFor(ctx.eff);
      const reservation = await reserve(ctx.eff, ctx);

      const abort = new AbortController();
      reply.raw.on("close", () => abort.abort());
      const iterator = provider
        .stream({
          model: ctx.eff.model,
          system: DIAGRAM_SYSTEM_PROMPT,
          messages,
          maxTokens: 4096,
          temperature: 0.2,
          signal: abort.signal,
        })
        [Symbol.asyncIterator]();

      // Pull the first event before committing to a 200: upstream auth/network failures become proper HTTP errors.
      let first: IteratorResult<any>;
      try {
        first = await iterator.next();
      } catch (e) {
        await reservation.refund(); // failed requests don't burn quota
        return failFrom(e);
      }
      const write = sse(reply, rateHeaders(reservation));
      try {
        // The editor feeds the stream straight into its Mermaid parser: emit the diagram only.
        const filter = new MermaidStreamFilter();
        let finishReason: "stop" | "length" | "content_filter" | null = "stop";
        let step = first;
        while (!step.done) {
          if (step.value.type === "content") {
            const out = filter.push(step.value.delta);
            if (out) {
              write({ type: "content", delta: out });
            }
          } else {
            finishReason = step.value.finishReason;
          }
          step = await iterator.next();
        }
        const tail = filter.end();
        if (tail) {
          write({ type: "content", delta: tail });
        }
        if (filter.hasOutput) {
          write({ type: "done", finishReason });
        } else {
          await reservation.refund();
          write({
            type: "error",
            error: {
              message:
                "The model did not return a diagram. Try rephrasing your request.",
              status: 422,
            },
          });
        }
        write("[DONE]");
      } catch (e: any) {
        if (!abort.signal.aborted) {
          await reservation.refund();
          write({
            type: "error",
            error: {
              message:
                e instanceof ProviderError ? e.message : "Generation failed",
              status: e instanceof ProviderError ? e.status : 500,
            },
          });
          write("[DONE]");
        }
      } finally {
        reply.raw.end();
      }
    },
  );

  /** Non-streaming: prompt in, Mermaid + ready-to-place Excalidraw elements out. */
  app.post(
    "/workspaces/:id/ai/generate-diagram",
    {
      ...guard,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          keyGenerator: sessionRateKey,
        },
      },
    },
    async (req) => {
      const ctx = await requireWorkspacePermission(
        req,
        (req.params as any).id,
        "ai:use",
      );
      const { prompt } = z
        .object({ prompt: z.string().trim().min(3).max(4000) })
        .parse(req.body);
      const { mermaid, remaining } = await generateMermaid(
        app,
        { workspaceId: ctx.workspaceId, userId: ctx.user._id, role: ctx.role },
        prompt,
      );
      let converted: ReturnType<typeof mermaidToElements> | null = null;
      let note: string | undefined;
      try {
        converted = mermaidToElements(mermaid, {
          idPrefix: `ai${Date.now().toString(36)}`,
        });
      } catch (e) {
        if (
          e instanceof UnsupportedDiagramError ||
          e instanceof MermaidSyntaxError
        ) {
          note = e.message; // still return the Mermaid so the editor can convert it
        } else {
          throw e;
        }
      }
      return {
        mermaid,
        elements: converted?.elements ?? null,
        note,
        remaining,
      };
    },
  );

  // ---- Mermaid (no AI, no quota) ------------------------------------------------------------

  app.post(
    "/diagrams/mermaid",
    {
      ...guard,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
          keyGenerator: sessionRateKey,
        },
      },
    },
    async (req) => {
      requireUser(req);
      const { source } = z
        .object({ source: z.string().min(3).max(50_000) })
        .parse(req.body);
      try {
        const { elements, bounds, nodeCount, edgeCount } = mermaidToElements(
          source,
          { idPrefix: `mm${Date.now().toString(36)}` },
        );
        return { elements, bounds, nodeCount, edgeCount };
      } catch (e) {
        if (e instanceof UnsupportedDiagramError) {
          throw new HttpError(422, "unsupported_diagram", e.message);
        }
        if (e instanceof MermaidSyntaxError) {
          throw new HttpError(400, "mermaid_syntax", e.message);
        }
        throw e;
      }
    },
  );
};

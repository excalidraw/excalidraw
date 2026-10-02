import { HttpError } from "../http";

import { DIAGRAM_SYSTEM_PROMPT } from "./prompt";
import { complete, createProvider, ProviderError } from "./providers";
import {
  isConfigured,
  LimitReachedError,
  memberMayUse,
  reserveRequest,
  resolveAi,
  toProviderConfig,
} from "./service";
import { assertSafeBaseUrl, UnsafeUrlError } from "./urlSafety";
import { extractMermaid } from "./prompt";

import type { FastifyInstance } from "fastify";
import type { ObjectId } from "mongodb";
import type { Role } from "../db";

/**
 * One-shot "prompt -> Mermaid" for non-interactive callers (REST API, MCP).
 * Applies exactly the same gates as the editor: enabled + configured + allow-list + daily limits.
 */
export const generateMermaid = async (
  app: FastifyInstance,
  ctx: { workspaceId: ObjectId; userId: ObjectId; role: Role },
  prompt: string,
): Promise<{ mermaid: string; remaining: number | null }> => {
  const { database, config } = app;
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
      "AI is enabled but has no API key yet.",
    );
  }
  if (!memberMayUse(eff, ctx.userId, ctx.role)) {
    throw new HttpError(
      403,
      "ai_not_allowed",
      "You are not allowed to use AI in this workspace.",
    );
  }
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
  let reservation;
  try {
    reservation = await reserveRequest(
      database,
      ctx.workspaceId,
      ctx.userId,
      eff.limits,
    );
  } catch (e) {
    if (e instanceof LimitReachedError) {
      throw new HttpError(429, "ai_limit_reached", e.message);
    }
    throw e;
  }
  try {
    const provider = createProvider(toProviderConfig(eff, app.aiFetch));
    const { text } = await complete(provider, {
      model: eff.model,
      system: DIAGRAM_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      temperature: 0.2,
    });
    const mermaid = extractMermaid(text);
    if (!mermaid) {
      throw new HttpError(
        422,
        "no_diagram",
        "The model did not return a diagram. Try rephrasing.",
      );
    }
    return { mermaid, remaining: reservation.remaining };
  } catch (e) {
    await reservation.refund(); // failed requests never cost quota
    if (e instanceof ProviderError) {
      throw new HttpError(
        e.status,
        e.status === 429 ? "provider_rate_limited" : "provider_error",
        e.message,
      );
    }
    throw e;
  }
};

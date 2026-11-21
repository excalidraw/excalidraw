import type { IncomingMessage, ServerResponse } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { getTemplate } from "../src/templates/registry.js";
import { enforceHeader, wasHeaderCorrected } from "../src/lib/enforceHeader.js";
import { generateRateLimiter } from "./rateLimiter.js";

// Server route. Holds ANTHROPIC_API_KEY — read from the environment in
// this file only, never imported under src/, so it can never end up in
// the client bundle.

const MAX_PROMPT_LENGTH = 300;
const MAX_PRIOR_MERMAID_LENGTH = 4000;
const MAX_PARSE_ERROR_LENGTH = 500;
const MODEL_TIMEOUT_MS = 15_000;
const MODEL = "claude-sonnet-5";

export interface RepairContext {
  /** The full mermaid text returned by the prior turn (header included). */
  priorMermaid: string;
  /** Why it was rejected — parse exception message, or the image-fallback note. */
  parseError: string;
}

export interface GenerateRequest {
  prompt: string;
  templateId: string;
  repair?: RepairContext;
}

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    anthropicClient = new Anthropic({
      apiKey,
      defaultHeaders: workspaceId
        ? { "anthropic-workspace-id": workspaceId }
        : undefined,
    });
  }
  return anthropicClient;
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (raw.length === 0) return {};
  return JSON.parse(raw);
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  res.writeHead(status, { "Content-Type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(body));
}

function buildSystemPrompt(
  header: string,
  label: string,
  rules: string,
): string {
  return [
    `You generate Mermaid diagram source for a "${label}" diagram.`,
    `The diagram MUST begin with exactly this header line: ${header}`,
    rules,
    "Respond with mermaid source only. No prose, no explanation, no code fences.",
  ].join("\n\n");
}

/**
 * Core generation logic, isolated from HTTP parsing so it's easy to call
 * directly (e.g. from tests) as well as from the raw Node handler below.
 *
 * Same route, same enforcement path for all four templates — templateId
 * drives everything via the registry, there is no per-template branching
 * here.
 *
 * When `repair` is set, this continues the SAME conversation rather than
 * starting a fresh one: the prior (rejected) completion goes back in as
 * an assistant turn, followed by a user turn describing what went wrong,
 * so the model is repairing its own prior answer with full context of
 * what it already tried — not guessing blind on a second unrelated shot.
 */
export interface GenerateResult {
  mermaid: string;
  /** True iff enforceHeader actually changed the model's raw header. */
  headerCorrected: boolean;
}

export async function generateMermaid(
  request: GenerateRequest,
): Promise<GenerateResult> {
  const { prompt, templateId, repair } = request;

  const template = getTemplate(templateId);
  if (!template) {
    throw Object.assign(new Error(`Unknown templateId: ${templateId}`), {
      statusCode: 400,
    });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw Object.assign(
      new Error(`Prompt exceeds ${MAX_PROMPT_LENGTH} characters`),
      { statusCode: 400 },
    );
  }
  if (repair) {
    if (repair.priorMermaid.length > MAX_PRIOR_MERMAID_LENGTH) {
      throw Object.assign(new Error("repair.priorMermaid too long"), {
        statusCode: 400,
      });
    }
    if (repair.parseError.length > MAX_PARSE_ERROR_LENGTH) {
      throw Object.assign(new Error("repair.parseError too long"), {
        statusCode: 400,
      });
    }
  }

  const systemPrompt = buildSystemPrompt(
    template.header,
    template.label,
    template.rules,
  );

  // NOTE: the original design used an assistant-message prefill (send
  // the header as if the model had already written it, forcing the
  // completion to continue from there) as a second, structural nudge on
  // top of the system-prompt instruction. Confirmed live that this
  // model rejects prefill outright ("This model does not support
  // assistant message prefill. The conversation must end with a user
  // message."), so that mechanism is unavailable here. This does NOT
  // weaken the actual guarantee: enforceHeader() below is unconditional
  // — it corrects the header whether or not the model's raw output
  // already happened to get it right — so the deterministic type lock
  // holds on the response either way. What's lost without prefill is
  // only the softer signal of how often the model gets it right
  // unprompted, which is exactly what headerCorrected / the
  // type_mismatch_corrected event now measures.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];
  if (repair) {
    messages.push({ role: "assistant", content: repair.priorMermaid.trim() });
    messages.push({
      role: "user",
      content: `That didn't work: ${repair.parseError} Return corrected mermaid source that starts with "${template.header}" and fixes this.`,
    });
  }

  const client = getClient();
  let response;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1000,
        // `temperature` is deprecated/rejected by this model (confirmed
        // live: "400 `temperature` is deprecated for this model") — the
        // original spec asked for temperature 0.3, but the deployed model
        // no longer accepts the parameter at all, so it's omitted rather
        // than sent as a no-op.
        system: systemPrompt,
        messages,
      },
      { timeout: MODEL_TIMEOUT_MS },
    );
  } catch (err) {
    throw Object.assign(
      new Error(`Model call failed: ${(err as Error).message}`),
      { statusCode: 502, cause: err },
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  const fullMermaid = textBlock && "text" in textBlock ? textBlock.text : "";

  return {
    mermaid: enforceHeader(fullMermaid, template.header),
    headerCorrected: wasHeaderCorrected(fullMermaid, template.header),
  };
}

export async function generateHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const ip = getClientIp(req);
  const rateLimit = generateRateLimiter.check(ip);
  if (!rateLimit.allowed) {
    sendJson(
      res,
      429,
      { error: "Too many requests" },
      { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
    );
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { prompt, templateId, repair } = (body ?? {}) as {
    prompt?: unknown;
    templateId?: unknown;
    repair?: unknown;
  };

  if (typeof prompt !== "string" || typeof templateId !== "string") {
    sendJson(res, 400, { error: "prompt and templateId are required" });
    return;
  }

  let repairContext: RepairContext | undefined;
  if (repair !== undefined) {
    const r = repair as { priorMermaid?: unknown; parseError?: unknown };
    if (
      typeof r.priorMermaid !== "string" ||
      typeof r.parseError !== "string"
    ) {
      sendJson(res, 400, {
        error: "repair.priorMermaid and repair.parseError must be strings",
      });
      return;
    }
    repairContext = { priorMermaid: r.priorMermaid, parseError: r.parseError };
  }

  try {
    const result = await generateMermaid({
      prompt,
      templateId,
      repair: repairContext,
    });
    sendJson(res, 200, { mermaid: result.mermaid, headerCorrected: result.headerCorrected });
  } catch (err) {
    const statusCode =
      (err as { statusCode?: number }).statusCode ?? 500;
    sendJson(res, statusCode, { error: (err as Error).message });
  }
}

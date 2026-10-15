import type { Template } from "../templates/registry";
import type { EventName, TrackProps } from "./events";

export interface GenerateResult {
  mermaid: string;
  headerCorrected: boolean;
}

export interface InsertOutcome {
  ok: boolean;
  errorMessage?: string;
}

export interface GenerateWithRepairDeps {
  generate: (
    prompt: string,
    templateId: string,
    repair?: { priorMermaid: string; parseError: string },
  ) => Promise<GenerateResult>;
  /** Validates + commits mermaid to the canvas. Must not commit on failure. */
  tryInsert: (
    mermaid: string,
  ) => Promise<{ ok: true } | { ok: false; errorMessage: string }>;
  /** Commits the template's own hand-vetted fallback to the canvas. */
  insertFallback: (template: Template) => Promise<void>;
  track: (name: EventName, props: TrackProps) => void;
}

export type FallbackReason =
  | { type: "initial_generate_failed"; error: string }
  | { type: "repair_generate_failed" }
  | { type: "repair_insert_failed" };

export type GenerateWithRepairOutcome =
  | { kind: "success"; attempt: "initial" | "repair" }
  | { kind: "fallback"; reason: FallbackReason };

/**
 * The retry policy: generate -> validate; on failure, one repair round
 * trip appending the parse error onto the same conversation; on a second
 * failure, commit the template's registry fallback. Isolated from React
 * state and the Excalidraw API so the branching itself — the interesting
 * logic — is unit-testable with mocked deps, independent of the DOM.
 */
export async function generateWithRepair(
  deps: GenerateWithRepairDeps,
  template: Template,
  prompt: string,
): Promise<GenerateWithRepairOutcome> {
  const { generate, tryInsert, insertFallback, track } = deps;
  const templateId = template.id;

  track("prompt_submitted", { templateId, promptLength: prompt.length });

  const runFallback = async (reason: FallbackReason) => {
    await insertFallback(template);
    track("fallback_inserted", { templateId, reason: reason.type });
    track("diagram_inserted", { templateId, source: "fallback" });
    return { kind: "fallback" as const, reason };
  };

  let mermaid: string;
  try {
    const result = await generate(prompt, templateId);
    mermaid = result.mermaid;
    track("generation_succeeded", { templateId, attempt: "initial" });
    if (result.headerCorrected) {
      track("type_mismatch_corrected", { templateId, attempt: "initial" });
    }
  } catch (err) {
    const error = (err as Error).message;
    track("generation_failed", { templateId, attempt: "initial", error });
    return runFallback({ type: "initial_generate_failed", error });
  }

  const firstAttempt = await tryInsert(mermaid);
  if (firstAttempt.ok) {
    track("diagram_inserted", { templateId, source: "ai" });
    return { kind: "success", attempt: "initial" };
  }

  track("repair_attempted", {
    templateId,
    reason: firstAttempt.errorMessage,
  });

  try {
    const repaired = await generate(prompt, templateId, {
      priorMermaid: mermaid,
      parseError: firstAttempt.errorMessage,
    });
    mermaid = repaired.mermaid;
    track("generation_succeeded", { templateId, attempt: "repair" });
    if (repaired.headerCorrected) {
      track("type_mismatch_corrected", { templateId, attempt: "repair" });
    }
  } catch {
    track("generation_failed", { templateId, attempt: "repair" });
    return runFallback({ type: "repair_generate_failed" });
  }

  const secondAttempt = await tryInsert(mermaid);
  if (secondAttempt.ok) {
    track("diagram_inserted", { templateId, source: "ai_repair" });
    return { kind: "success", attempt: "repair" };
  }

  return runFallback({ type: "repair_insert_failed" });
}

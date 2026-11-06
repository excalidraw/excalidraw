export interface GenerateError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;
}

export interface RepairContext {
  priorMermaid: string;
  parseError: string;
}

/**
 * Client call to POST /api/generate. Never touches ANTHROPIC_API_KEY —
 * that lives server-side only, in api/generate.ts.
 *
 * Pass `repair` to continue the same conversation as a correction turn
 * (used by App.tsx's one-shot repair round trip) rather than starting a
 * fresh, context-free generation.
 */
export interface GenerateResult {
  mermaid: string;
  headerCorrected: boolean;
}

export async function generate(
  prompt: string,
  templateId: string,
  repair?: RepairContext,
): Promise<GenerateResult> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, templateId, repair }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(
      body.error ?? `Request failed with status ${res.status}`,
    ) as GenerateError;
    error.statusCode = res.status;
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) error.retryAfterSeconds = Number(retryAfter);
    }
    throw error;
  }

  return res.json();
}

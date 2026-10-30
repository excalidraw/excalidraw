import { describe, expect, it, vi } from "vitest";
import { generateWithRepair } from "./generateWithRepair";
import type { GenerateWithRepairDeps } from "./generateWithRepair";
import type { Template } from "../templates/registry";

const template: Template = {
  id: "flowchart",
  label: "Flowchart",
  hint: "Steps and decisions",
  placeholder: "",
  header: "flowchart TD",
  rules: "",
  fallback: "flowchart TD\n    A[Start] --> B[End]",
};

function makeDeps(
  overrides: Partial<{
    generate: GenerateWithRepairDeps["generate"];
    tryInsert: GenerateWithRepairDeps["tryInsert"];
    insertFallback: GenerateWithRepairDeps["insertFallback"];
  }> = {},
): GenerateWithRepairDeps & { track: ReturnType<typeof vi.fn> } {
  const track = vi.fn();
  const generate: GenerateWithRepairDeps["generate"] =
    overrides.generate ??
    vi
      .fn()
      .mockResolvedValue({ mermaid: "flowchart TD\nA-->B", headerCorrected: false });
  const tryInsert: GenerateWithRepairDeps["tryInsert"] =
    overrides.tryInsert ?? vi.fn().mockResolvedValue({ ok: true });
  const insertFallback: GenerateWithRepairDeps["insertFallback"] =
    overrides.insertFallback ?? vi.fn().mockResolvedValue(undefined);
  return { generate, tryInsert, insertFallback, track };
}

describe("generateWithRepair", () => {
  it("succeeds on the first try: one generate call, no repair, no fallback", async () => {
    const deps = makeDeps();
    const outcome = await generateWithRepair(deps, template, "a login flow");

    expect(outcome).toEqual({ kind: "success", attempt: "initial" });
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.generate).toHaveBeenCalledWith("a login flow", "flowchart");
    expect(deps.insertFallback).not.toHaveBeenCalled();

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).toEqual([
      "prompt_submitted",
      "generation_succeeded",
      "diagram_inserted",
    ]);
    const diagramInsertedCall = deps.track.mock.calls.find(
      (c) => c[0] === "diagram_inserted",
    );
    expect(diagramInsertedCall?.[1]).toMatchObject({
      templateId: "flowchart",
      source: "ai",
    });
  });

  it("emits type_mismatch_corrected only when the server reports a header correction", async () => {
    const deps = makeDeps({
      generate: vi
        .fn()
        .mockResolvedValue({ mermaid: "flowchart TD\nA-->B", headerCorrected: true }),
    });
    await generateWithRepair(deps, template, "prompt");

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain("type_mismatch_corrected");
  });

  it("does not emit type_mismatch_corrected when the header was already correct", async () => {
    const deps = makeDeps();
    await generateWithRepair(deps, template, "prompt");

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).not.toContain("type_mismatch_corrected");
  });

  it("repairs successfully: tryInsert fails once then succeeds, generate called twice with repair context", async () => {
    const tryInsert = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, errorMessage: "parse error: bad node" })
      .mockResolvedValueOnce({ ok: true });
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ mermaid: "flowchart TD\nbroken", headerCorrected: false })
      .mockResolvedValueOnce({ mermaid: "flowchart TD\nfixed", headerCorrected: false });
    const deps = makeDeps({ tryInsert, generate });

    const outcome = await generateWithRepair(deps, template, "a login flow");

    expect(outcome).toEqual({ kind: "success", attempt: "repair" });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenNthCalledWith(2, "a login flow", "flowchart", {
      priorMermaid: "flowchart TD\nbroken",
      parseError: "parse error: bad node",
    });
    expect(deps.insertFallback).not.toHaveBeenCalled();

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).toEqual([
      "prompt_submitted",
      "generation_succeeded",
      "repair_attempted",
      "generation_succeeded",
      "diagram_inserted",
    ]);
    const diagramInsertedCall = deps.track.mock.calls.find(
      (c) => c[0] === "diagram_inserted",
    );
    expect(diagramInsertedCall?.[1]).toMatchObject({ source: "ai_repair" });
  });

  it("falls back after repair also fails to insert", async () => {
    const tryInsert = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, errorMessage: "bad" })
      .mockResolvedValueOnce({ ok: false, errorMessage: "still bad" });
    const deps = makeDeps({ tryInsert });

    const outcome = await generateWithRepair(deps, template, "prompt");

    expect(outcome).toEqual({
      kind: "fallback",
      reason: { type: "repair_insert_failed" },
    });
    expect(deps.generate).toHaveBeenCalledTimes(2);
    expect(deps.insertFallback).toHaveBeenCalledTimes(1);
    expect(deps.insertFallback).toHaveBeenCalledWith(template);

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).toEqual([
      "prompt_submitted",
      "generation_succeeded",
      "repair_attempted",
      "generation_succeeded",
      "fallback_inserted",
      "diagram_inserted",
    ]);
    const fallbackCall = deps.track.mock.calls.find(
      (c) => c[0] === "fallback_inserted",
    );
    expect(fallbackCall?.[1]).toMatchObject({ reason: "repair_insert_failed" });
  });

  it("falls back immediately when the initial generate call throws — no repair attempted", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("network down"));
    const tryInsert = vi.fn();
    const deps = makeDeps({ generate, tryInsert });

    const outcome = await generateWithRepair(deps, template, "prompt");

    expect(outcome).toEqual({
      kind: "fallback",
      reason: { type: "initial_generate_failed", error: "network down" },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(tryInsert).not.toHaveBeenCalled();
    expect(deps.insertFallback).toHaveBeenCalledTimes(1);

    const eventNames = deps.track.mock.calls.map((c) => c[0]);
    expect(eventNames).toEqual([
      "prompt_submitted",
      "generation_failed",
      "fallback_inserted",
      "diagram_inserted",
    ]);
  });

  it("falls back when the repair generate call itself throws (distinct from a repair insert failure)", async () => {
    const tryInsert = vi.fn().mockResolvedValueOnce({ ok: false, errorMessage: "bad" });
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ mermaid: "flowchart TD\nbroken", headerCorrected: false })
      .mockRejectedValueOnce(new Error("rate limited"));
    const deps = makeDeps({ generate, tryInsert });

    const outcome = await generateWithRepair(deps, template, "prompt");

    expect(outcome).toEqual({
      kind: "fallback",
      reason: { type: "repair_generate_failed" },
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(tryInsert).toHaveBeenCalledTimes(1);
    expect(deps.insertFallback).toHaveBeenCalledTimes(1);
  });
});

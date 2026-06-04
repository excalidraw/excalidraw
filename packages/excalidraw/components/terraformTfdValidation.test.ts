import { describe, expect, it } from "vitest";

import {
  applyDeclaredDataFlow,
  applyDeclaredDataFlowFromMany,
} from "./terraformDeclaredDataFlow";
import {
  detectDuplicateEdges,
  detectOrphanedBinds,
  detectTfdGraphCycles,
} from "./terraformTfdValidation";

import type { DeclaredDataFlowEdge } from "./terraformDeclaredDataFlow";
import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const A = "aws_lambda_function.a";
const B = "aws_s3_bucket.b";
const C = "aws_sqs_queue.c";
const D = "aws_kinesis_stream.d";

function edge(
  source: string,
  target: string,
  sequence = 0,
): DeclaredDataFlowEdge {
  return { source, target, sequence, origin: "tfd" };
}

function minimalNodes(): Record<string, TerraformPlanGraphNode> {
  const node = (address: string, type: string): TerraformPlanGraphNode => ({
    resources: { [address]: { address, type, change: { after: {} } } },
  });
  return {
    [A]: node(A, "aws_lambda_function"),
    [B]: node(B, "aws_s3_bucket"),
    [C]: node(C, "aws_sqs_queue"),
    [D]: node(D, "aws_kinesis_stream"),
  };
}

// ---------------------------------------------------------------------------
// detectTfdGraphCycles
// ---------------------------------------------------------------------------

describe("detectTfdGraphCycles", () => {
  it("returns no errors for a clean DAG", () => {
    const edges = [edge(A, B, 0), edge(B, C, 1), edge(A, C, 2)];
    expect(detectTfdGraphCycles(edges)).toEqual([]);
  });

  it("detects a simple 2-node cycle", () => {
    const edges = [edge(A, B, 0), edge(B, A, 1)];
    const errors = detectTfdGraphCycles(edges);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Cycle/);
    expect(errors[0]).toContain(A);
    expect(errors[0]).toContain(B);
  });

  it("detects a 3-node cycle and names the full path", () => {
    // A → B → C → A
    const edges = [edge(A, B, 0), edge(B, C, 1), edge(C, A, 2)];
    const errors = detectTfdGraphCycles(edges);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(A);
    expect(errors[0]).toContain(B);
    expect(errors[0]).toContain(C);
  });

  it("returns no errors for an empty edge list", () => {
    expect(detectTfdGraphCycles([])).toEqual([]);
  });

  it("does not report the same cycle root twice", () => {
    // A ↔ B with two back-edges — still one cycle root
    const edges = [edge(A, B, 0), edge(B, A, 1), edge(B, A, 2)];
    const errors = detectTfdGraphCycles(edges);
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// detectOrphanedBinds
// ---------------------------------------------------------------------------

describe("detectOrphanedBinds", () => {
  it("warns for a bind that appears in no edge", () => {
    const binds = new Map([
      ["used", A],
      ["orphan", B],
    ]);
    const hopAliases = new Set<string>();
    const edgeAliases = new Set(["used"]);
    const warnings = detectOrphanedBinds(binds, hopAliases, edgeAliases);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"orphan"');
  });

  it("emits no warning when all binds are used", () => {
    const binds = new Map([
      ["src", A],
      ["dst", B],
    ]);
    const hopAliases = new Set<string>();
    const edgeAliases = new Set(["src", "dst"]);
    expect(detectOrphanedBinds(binds, hopAliases, edgeAliases)).toEqual([]);
  });

  it("skips hop aliases even if unused in edges", () => {
    const binds = new Map([["hop", "@hop"]]);
    const hopAliases = new Set(["hop"]);
    const edgeAliases = new Set<string>();
    expect(detectOrphanedBinds(binds, hopAliases, edgeAliases)).toEqual([]);
  });

  it("emits no warning when there are no binds", () => {
    expect(detectOrphanedBinds(new Map(), new Set(), new Set())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectDuplicateEdges
// ---------------------------------------------------------------------------

describe("detectDuplicateEdges", () => {
  it("returns no warnings for unique edges", () => {
    const edges = [edge(A, B, 0), edge(B, C, 1), edge(A, C, 2)];
    expect(detectDuplicateEdges(edges)).toEqual([]);
  });

  it("warns for a pair that appears twice", () => {
    const edges = [edge(A, B, 0), edge(A, B, 1)];
    const warnings = detectDuplicateEdges(edges);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(A);
    expect(warnings[0]).toContain(B);
    expect(warnings[0]).toContain("2 times");
  });

  it("reports the count when a pair appears more than twice", () => {
    const edges = [edge(A, B, 0), edge(A, B, 1), edge(A, B, 2)];
    const warnings = detectDuplicateEdges(edges);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("3 times");
  });

  it("returns no warnings for an empty edge list", () => {
    expect(detectDuplicateEdges([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: errors and warnings surface from applyDeclaredDataFlow
// ---------------------------------------------------------------------------

describe("applyDeclaredDataFlow validation integration", () => {
  it("emits a cycle error for a 2-node cycle in the TFD", () => {
    const nodes = minimalNodes();
    const text = `
bind a = ${A}
bind b = ${B}
a -> b
b -> a
`;
    const { errors } = applyDeclaredDataFlow(nodes, text);
    expect(errors.some((e) => e.startsWith("Cycle"))).toBe(true);
  });

  it("emits an orphaned bind warning for an unused bind", () => {
    const nodes = minimalNodes();
    const text = `
bind a = ${A}
bind b = ${B}
bind unused = ${C}
a -> b
`;
    const { warnings } = applyDeclaredDataFlow(nodes, text);
    expect(warnings.some((w) => w.includes('"unused"'))).toBe(true);
  });

  it("emits a duplicate edge warning for repeated source→target", () => {
    const nodes = minimalNodes();
    const text = `
bind a = ${A}
bind b = ${B}
a -> b
a -> b
`;
    const { warnings } = applyDeclaredDataFlow(nodes, text);
    expect(warnings.some((w) => w.includes("Duplicate edge"))).toBe(true);
  });

  it("surfaces bind-resolution errors from applyDeclaredDataFlowFromMany", () => {
    const nodes = minimalNodes();
    const { errors } = applyDeclaredDataFlowFromMany(nodes, [
      "bind bad = nonexistent.resource.xyz",
    ]);
    expect(errors.some((e) => e.includes("address not in plan"))).toBe(true);
  });

  it("returns no errors or warnings for a clean acyclic TFD", () => {
    const nodes = minimalNodes();
    const text = `
bind a = ${A}
bind b = ${B}
bind c = ${C}
a -> b
b -> c
`;
    const { errors, warnings } = applyDeclaredDataFlow(nodes, text);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

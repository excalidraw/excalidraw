import { describe, expect, it } from "vitest";

import {
  applyTfdCompositionToSources,
  formatArtifactRef,
  inferStackIdsFromBinds,
  parseArtifactRef,
  parseTfdComposition,
} from "./terraformTfdComposition";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

const sampleTfdWithUse = `tfd 3

use stack-a {
  plan demo/stack-a/plan.json
  dot demo/stack-a/graph.dot
}

use stack-b {
  plan demo/stack-b/plan.json
  dot demo/stack-b/graph.dot
  state demo/stack-b/terraform.tfstate
}

bind writer = stack-a::aws_lambda_function.writer
bind queue = stack-b::aws_sqs_queue.main
writer -> queue
`;

const sampleTfdV2 = `tfd 2
bind writer = stack-a::aws_lambda_function.writer
bind queue = stack-b::aws_sqs_queue.main
writer -> queue
`;

function makeFallbackSources(): TerraformImportPresetSources {
  return {
    planDotBundles: [
      {
        label: "stack-a",
        plan: { resource_changes: [{ address: "aws_lambda_function.writer" }] },
        dotText: "digraph G {}\n",
      },
      {
        label: "stack-b",
        plan: { resource_changes: [{ address: "aws_sqs_queue.main" }] },
        dotText: "digraph G {}\n",
      },
      {
        label: "stack-c",
        plan: { resource_changes: [{ address: "aws_s3_bucket.other" }] },
        dotText: "digraph G {}\n",
      },
    ],
    states: [{ version: 4 }, { version: 4 }],
    stateLabels: ["stack-b", "stack-c"],
    tfdTexts: [],
    tfdLabels: [],
    warnings: [],
    repoName: "demo",
    stackCatalog: [
      {
        stackId: "stack-a",
        label: "stack-a",
        planPath: "stack-a/plan.json",
        dotPath: "stack-a/graph.dot",
        planText: JSON.stringify({
          resource_changes: [{ address: "aws_lambda_function.writer" }],
        }),
        dotText: "digraph G {}\n",
      },
      {
        stackId: "stack-b",
        label: "stack-b",
        planPath: "stack-b/plan.json",
        dotPath: "stack-b/graph.dot",
        statePath: "stack-b/terraform.tfstate",
        planText: JSON.stringify({
          resource_changes: [{ address: "aws_sqs_queue.main" }],
        }),
        dotText: "digraph G {}\n",
        stateText: JSON.stringify({ version: 4 }),
      },
    ],
  };
}

describe("terraformTfdComposition", () => {
  it("parses repoName/relativePath artifact refs", () => {
    expect(
      parseArtifactRef("staging-multi-state/20-east-messaging/plan.json"),
    ).toEqual({
      repoName: "staging-multi-state",
      relativePath: "20-east-messaging/plan.json",
    });
    expect(
      parseArtifactRef("@staging-multi-state/20-east-messaging/plan.json"),
    ).toEqual({
      repoName: "staging-multi-state",
      relativePath: "20-east-messaging/plan.json",
    });
    expect(parseArtifactRef("invalid")).toBeNull();
  });

  it("formats artifact refs canonically", () => {
    expect(
      formatArtifactRef({
        repoName: "terraform",
        relativePath: "staging-multi-state/pipeline.tfd",
      }),
    ).toBe("terraform/staging-multi-state/pipeline.tfd");
  });

  it("parses TFD v3 use blocks with binds and edges", () => {
    const parsed = parseTfdComposition(sampleTfdWithUse);
    expect(parsed.version).toBe(3);
    expect(parsed.useBlocks).toHaveLength(2);
    expect(parsed.useBlocks[0]?.stackId).toBe("stack-a");
    expect(parsed.useBlocks[0]?.plan).toEqual({
      repoName: "demo",
      relativePath: "stack-a/plan.json",
    });
    expect(parsed.binds.get("writer")).toBe(
      "stack-a::aws_lambda_function.writer",
    );
    expect(parsed.edgeSpecs).toHaveLength(1);
  });

  it("infers stack ids from bind addresses", () => {
    const parsed = parseTfdComposition(sampleTfdV2);
    expect(inferStackIdsFromBinds(parsed.binds)).toEqual([
      "stack-a",
      "stack-b",
    ]);
  });

  it("resolves use blocks into selected stacks only", () => {
    const fallback = makeFallbackSources();
    const result = applyTfdCompositionToSources(fallback, [sampleTfdWithUse], {
      repoName: "demo",
      stackCatalog: fallback.stackCatalog,
    });

    expect(result.errors).toEqual([]);
    expect(result.sources.planDotBundles.map((bundle) => bundle.label)).toEqual(
      ["stack-a", "stack-b"],
    );
    expect(result.sources.states).toHaveLength(1);
    expect(result.sources.stateLabels).toEqual(["stack-b"]);
  });

  it("falls back to API planDotBundles when stackCatalog is paths-only (D1 API)", () => {
    const fallback = makeFallbackSources();
    const pathsOnlyCatalog = fallback.stackCatalog!.map(
      ({ stackId, label, planPath, dotPath, statePath }) => ({
        stackId,
        label,
        planPath,
        dotPath,
        ...(statePath ? { statePath } : {}),
      }),
    );
    const result = applyTfdCompositionToSources(fallback, [sampleTfdWithUse], {
      repoName: "demo",
      stackCatalog: pathsOnlyCatalog,
    });

    expect(result.errors).toEqual([]);
    expect(result.sources.planDotBundles.map((bundle) => bundle.label)).toEqual(
      ["stack-a", "stack-b"],
    );
    expect(result.sources.states).toHaveLength(1);
    expect(result.sources.stateLabels).toEqual(["stack-b"]);
  });

  it("falls back to API planDotBundles when stackCatalog has D1 compressed blobs", () => {
    const fallback = makeFallbackSources();
    const compressedCatalog = fallback.stackCatalog!.map((entry) => ({
      ...entry,
      planText: entry.planText ? `gz:b64:chunks:3` : undefined,
      dotText: entry.dotText ? `gz:b64:chunks:1` : undefined,
      stateText: entry.stateText ? `gz:b64:chunks:2` : undefined,
    }));
    const result = applyTfdCompositionToSources(fallback, [sampleTfdWithUse], {
      repoName: "demo",
      stackCatalog: compressedCatalog,
    });

    expect(result.errors).toEqual([]);
    expect(result.sources.planDotBundles.map((bundle) => bundle.label)).toEqual(
      ["stack-a", "stack-b"],
    );
    expect(result.sources.states).toHaveLength(1);
    expect(result.sources.stateLabels).toEqual(["stack-b"]);
  });

  it("falls back to bind inference when use blocks are absent", () => {
    const fallback = makeFallbackSources();
    const result = applyTfdCompositionToSources(fallback, [sampleTfdV2], {
      stackCatalog: fallback.stackCatalog,
    });

    expect(result.errors).toEqual([]);
    expect(result.sources.planDotBundles.map((bundle) => bundle.label)).toEqual(
      ["stack-a", "stack-b"],
    );
  });

  it("reports missing artifacts when neither catalog nor fallback bundles match", () => {
    const fallback = makeFallbackSources();
    const tfd = `tfd 3
use missing {
  plan demo/missing/plan.json
  dot demo/missing/graph.dot
}
`;
    const result = applyTfdCompositionToSources(fallback, [tfd], {
      repoName: "demo",
      stackCatalog: fallback.stackCatalog,
    });

    expect(result.sources.planDotBundles).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some(
        (error) =>
          error.includes("missing plan") ||
          error.includes("Artifact not found"),
      ),
    ).toBe(true);
  });
});

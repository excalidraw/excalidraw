import graphlibDot from "@dagrejs/graphlib-dot";
import { describe, expect, it } from "vitest";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { getResourceTypeFromPath } from "./terraformTopologyIamLinks";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";
import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

/**
 * Regression test for the T-1 consolidation: terraformTopologySgLinks.ts and
 * terraformTopologyCloudWatchLinks.ts each had their own private byte-identical copy of
 * `getResourceTypeFromPath`, now deleted in favor of importing the one exported from
 * terraformTopologyIamLinks.ts. This is a real behavior-preserving claim for every caller in
 * those two files (not just the satellite-kind scan sites this whole pass is about), so it
 * gets its own check: the deleted bodies (captured here verbatim from git history before
 * deletion) must produce byte-identical output to the now-shared function over every real
 * node path in the satellite-heavy fixture.
 */

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

/** Verbatim copy of the deleted terraformTopologySgLinks.ts / terraformTopologyCloudWatchLinks.ts body. */
function deletedDuplicateGetResourceTypeFromPath(
  nodePath: string,
  node?: TerraformPlanGraphNode,
): string {
  const primary = getPrimaryResource(node);
  const t = primary?.type;
  if (typeof t === "string") {
    return t;
  }
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i < parts.length && parts[i] === "data") {
    return typeof parts[i + 1] === "string" ? String(parts[i + 1]) : "";
  }
  return typeof parts[i] === "string" ? String(parts[i]) : "";
}

async function loadFixtureNodes() {
  const raw = getTerraformImportPresetSourcesFromDb(
    "staging-extended-localstack-v2",
  );
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  return buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
}

describe("getResourceTypeFromPath consolidation regression (T-1)", () => {
  it("the shared terraformTopologyIamLinks export matches the deleted Sg/CloudWatch copies over every real node path", async () => {
    const nodes = await loadFixtureNodes();
    const realPaths = Object.keys(nodes).filter(
      (k) => k !== "__module_tree__" && !k.startsWith("__"),
    );
    expect(realPaths.length).toBeGreaterThan(20);

    for (const path of realPaths) {
      const node = nodes[path] as TerraformPlanGraphNode | undefined;
      expect(getResourceTypeFromPath(path, node)).toBe(
        deletedDuplicateGetResourceTypeFromPath(path, node),
      );
    }
  }, 60_000);
});

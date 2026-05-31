import graphlibDot from "@dagrejs/graphlib-dot";
import { convertToExcalidrawElements } from "@excalidraw/element";

import {
  buildTerraformDependencyLineSkeletons,
  collectDirectedEdges,
  resolveTerraformPlanVertexId,
} from "./terraformElkLayout";
import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import { mergeDotAdjacency, mergePlanJsons, namespacePlanDotBundles } from "./terraformImportMerge";
import {
  buildLayoutBoxesFromElements,
  composeStackModuleScenes,
  type StackModuleSceneSlice,
} from "./terraformModuleStackCompose";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { parseStackAddress } from "./terraformStackAddress";

import type { LayoutTerraformResult } from "./terraformLayoutCore";
import type { TerraformLayoutProgress } from "./terraformLayoutWorkerTypes";
import type { TerraformLayoutWorkerJobResult } from "./terraformLayoutWorkerTypes";
import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

export async function runModuleStackLayoutJob(
  stackId: string,
  plan: unknown,
  dotText: string,
  moduleLayoutOptions?: Partial<TerraformModuleLayoutOptions>,
): Promise<Extract<TerraformLayoutWorkerJobResult, { type: "moduleStack" }>> {
  const graph = graphlibDot.read(dotText || "digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(plan, graph, [], {
    adjacency: {},
    priorStatePlans: [plan],
    stackIds: [stackId],
  });
  const elkScene = await buildTerraformElkExcalidrawScene(
    nodes,
    plan,
    moduleLayoutOptions,
  );
  return {
    type: "moduleStack",
    stackId,
    elements: elkScene.elements as ExcalidrawElement[],
    meta: elkScene.meta as Record<string, unknown>,
  };
}

function stackForAddress(
  address: string,
  addressToStack: Record<string, string>,
): string | null {
  if (addressToStack[address]) {
    return addressToStack[address];
  }
  const parsed = parseStackAddress(address);
  return parsed?.stackId ?? null;
}

export function appendCrossStackDependencyEdges(
  elements: ExcalidrawElement[],
  nodes: TerraformPlanNodesMap,
  addressToStack: Record<string, string>,
): ExcalidrawElement[] {
  const layoutBoxes = buildLayoutBoxesFromElements(elements);
  const placed = new Set(
    Object.keys(layoutBoxes).filter((k) => layoutBoxes[k]),
  );
  const directed = collectDirectedEdges(nodes, placed);
  const crossStack = directed.filter(({ source, target }) => {
    const ss = stackForAddress(source, addressToStack);
    const ts = stackForAddress(target, addressToStack);
    return Boolean(ss && ts && ss !== ts);
  });
  if (crossStack.length === 0) {
    return elements;
  }
  const skeletons = buildTerraformDependencyLineSkeletons(
    nodes,
    layoutBoxes,
    crossStack.map((e) => ({
      ...e,
      source: resolveTerraformPlanVertexId(nodes, e.source) ?? e.source,
      target: resolveTerraformPlanVertexId(nodes, e.target) ?? e.target,
    })),
  );
  const edgeEls = convertToExcalidrawElements(skeletons, {
    regenerateIds: true,
  }) as ExcalidrawElement[];
  return [...elements, ...edgeEls];
}

export type RunModuleStackWorker = (
  stackId: string,
  plan: unknown,
  dotText: string,
) => Promise<Extract<TerraformLayoutWorkerJobResult, { type: "moduleStack" }>>;

function layoutConcurrencyCap(bundleCount: number): number {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  return Math.max(1, Math.min(cores, 6, bundleCount));
}

export async function layoutModuleViewParallel(
  sources: TerraformPlanParsingSources,
  moduleLayoutOptions: Partial<TerraformModuleLayoutOptions> | undefined,
  runStackWorker: RunModuleStackWorker,
  onProgress?: (p: TerraformLayoutProgress) => void,
): Promise<LayoutTerraformResult> {
  const namespaced = namespacePlanDotBundles(sources.planDotBundles);
  const { bundles, stackIds, addressToStack } = namespaced;
  const total = bundles.length;
  const concurrency = layoutConcurrencyCap(total);

  const slices: StackModuleSceneSlice[] = new Array(total);
  let nextIndex = 0;
  let completed = 0;

  const runOne = async (i: number) => {
    const bundle = bundles[i]!;
    const stackId = stackIds[i] ?? bundle.label;
    const result = await runStackWorker(stackId, bundle.plan, bundle.dotText);
    slices[i] = { stackId, elements: result.elements };
    completed += 1;
    onProgress?.({
      phase: `module stack ${stackId}`,
      done: completed,
      total,
    });
  };

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    async () => {
      while (true) {
        const i = nextIndex;
        nextIndex += 1;
        if (i >= total) {
          break;
        }
        await runOne(i);
      }
    },
  );
  await Promise.all(workers);

  onProgress?.({ phase: "compose stacks", done: total, total });

  let elements = composeStackModuleScenes(slices);

  onProgress?.({ phase: "cross-stack edges", done: total, total });
  const plans = bundles.map((b) => b.plan);
  const labels = bundles.map((b) => b.label);
  const merged = mergePlanJsons(plans, labels, { warnOnOverwrite: false });
  const adjacency = mergeDotAdjacency(
    bundles.map((b) => b.dotText),
    stackIds,
  );
  const graph = graphlibDot.read("digraph G {}\n");
  const mergedNodes = buildTerraformLocalImportNodesMap(
    merged.plan,
    graph,
    [],
    {
      adjacency,
      priorStatePlans: merged.sourcePlans,
      stackIds,
    },
  );
  elements = appendCrossStackDependencyEdges(
    elements,
    mergedNodes,
    addressToStack,
  );

  const importWarnings = merged.warnings;
  return {
    ok: true,
    scene: {
      type: "excalidraw",
      version: 2,
      source: "terraform-local-parse",
      elements,
      appState: { viewBackgroundColor: "#ffffff", gridSize: null },
      meta: {
        layoutEngine: "elk",
        layoutParallel: "module-stacks",
        stackCount: stackIds.length,
        importBundleCount: sources.planDotBundles.length,
        ...(importWarnings.length > 0 ? { importWarnings } : {}),
        stackIds,
        addressToStack,
      },
    },
  };
}

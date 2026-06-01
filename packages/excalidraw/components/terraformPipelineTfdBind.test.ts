import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import {
  STAGING_DB_LOAD_TEST_TIMEOUT_MS,
  STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
} from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

function expandedNodesAndTfd() {
  const rawSources = getTerraformImportPresetSourcesFromDb(
    "staging-multi-state-expanded",
  );
  expect(rawSources).not.toBeNull();
  const sources = resolveSourcesWithTfdComposition(
    rawSources! as TerraformImportPresetSources,
  );
  expect(sources.compositionErrors ?? []).toEqual([]);
  const ns = namespacePlanDotBundles(sources.planDotBundles);
  const merged = mergePlanJsons(
    ns.bundles.map((b) => b.plan),
    ns.bundles.map((b) => b.label),
  );
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
    adjacency: {},
    priorStatePlans: merged.sourcePlans,
    stackIds: ns.stackIds,
  });
  return { nodes, tfdTexts: sources.tfdTexts, tfdLabels: sources.tfdLabels };
}

function edgePairKey(source: string, target: string) {
  return `${source} -> ${target}`;
}

describe("staging-multi-state-expanded pipeline.tfd binds", () => {
  it(
    "resolves all binds and trunk declared-dataflow edges",
    () => {
      const { nodes, tfdTexts, tfdLabels } = expandedNodesAndTfd();
      const { edges, errors, warnings } = applyDeclaredDataFlowFromMany(
        nodes,
        tfdTexts,
        tfdLabels,
      );

      expect(errors, errors.join("\n")).toEqual([]);
      expect(warnings).toEqual([]);

      const edgeKeys = new Set(
        edges.map((e) => edgePairKey(e.source, e.target)),
      );

      const trunkHops: [string, string][] = [
        [
          "10-east-ecs-edge::aws_ecs_service.producer",
          "20-east-messaging::module.ingress_queue.module.queue.aws_sqs_queue.this[0]",
        ],
        [
          "20-east-messaging::module.ingress_queue.module.queue.aws_sqs_queue.this[0]",
          "20-east-messaging::module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
        ],
        [
          "20-east-messaging::module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
          "20-east-messaging::module.egress_queue.module.queue.aws_sqs_queue.this[0]",
        ],
        [
          "20-east-messaging::module.egress_queue.module.queue.aws_sqs_queue.this[0]",
          "10-east-ecs-edge::aws_ecs_service.egress",
        ],
        [
          "10-east-ecs-edge::aws_ecs_service.egress",
          "00-east-network::module.east_network.module.vpc.aws_nat_gateway.this[0]",
        ],
      ];

      for (const [source, target] of trunkHops) {
        expect(
          edgeKeys.has(edgePairKey(source, target)),
          `${source} -> ${target}`,
        ).toBe(true);
      }

      const dlqHops: [string, string][] = [
        [
          "20-east-messaging::module.ingress_queue.module.queue.aws_sqs_queue.this[0]",
          "20-east-messaging::module.ingress_queue.module.queue.aws_sqs_queue.dlq[0]",
        ],
        [
          "20-east-messaging::module.egress_queue.module.queue.aws_sqs_queue.this[0]",
          "20-east-messaging::module.egress_queue.module.queue.aws_sqs_queue.dlq[0]",
        ],
        [
          "20-east-messaging::module.ingress_queue.module.queue.aws_sqs_queue.dlq[0]",
          "20-east-messaging::module.ingress_queue.aws_cloudwatch_metric_alarm.dlq_visible_messages[0]",
        ],
        [
          "20-east-messaging::module.egress_queue.module.queue.aws_sqs_queue.dlq[0]",
          "20-east-messaging::module.egress_queue.aws_cloudwatch_metric_alarm.dlq_visible_messages[0]",
        ],
      ];

      for (const [source, target] of dlqHops) {
        expect(
          edgeKeys.has(edgePairKey(source, target)),
          `${source} -> ${target}`,
        ).toBe(true);
      }
    },
    STAGING_DB_LOAD_TEST_TIMEOUT_MS,
  );

  it(
    "semantic import exposes ingress and egress SQS primary tiles",
    async () => {
      const rawSources = getTerraformImportPresetSourcesFromDb(
        "staging-multi-state-expanded",
      );
      expect(rawSources).not.toBeNull();
      const sources = resolveSourcesWithTfdComposition(
        rawSources! as TerraformImportPresetSources,
      );

      const res = await terraformPlanParsingFromSources(sources, {
        semanticLayout: true,
      });
      expect(res.ok).toBe(true);
      const body = await res.json();

      const sqsPaths = [
        ...new Set<string>(
          body.elements
            .filter(
              (e: {
                isDeleted?: boolean;
                type?: string;
                customData?: { resourceType?: string; nodePath?: string };
              }) =>
                !e.isDeleted &&
                e.type === "rectangle" &&
                e.customData?.resourceType === "aws_sqs_queue",
            )
            .map(
              (e: { customData?: { nodePath?: string } }) =>
                e.customData?.nodePath ?? "",
            ),
        ),
      ];

      expect(sqsPaths.some((p) => p.includes("module.ingress_queue"))).toBe(
        true,
      );
      expect(sqsPaths.some((p) => p.includes("module.egress_queue"))).toBe(
        true,
      );
      expect(
        sqsPaths.some(
          (p) =>
            p.includes("module.ingress_queue") &&
            p.includes("aws_sqs_queue.dlq"),
        ),
      ).toBe(true);
      expect(
        sqsPaths.some(
          (p) =>
            p.includes("module.egress_queue") &&
            p.includes("aws_sqs_queue.dlq"),
        ),
      ).toBe(true);
      expect(
        sqsPaths.some((p) => p.includes("module.queue.module.queue")),
      ).toBe(false);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});

import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import {
  STAGING_DB_LOAD_TEST_TIMEOUT_MS,
  STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
} from "../test-fixtures/terraformPresetFixtures";
import { importStagingSemanticLayoutBody } from "../test-fixtures/stagingSemanticLayoutFixture";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

type LooseLayoutElement = {
  id: string;
  type: string;
  isDeleted?: boolean;
  frameId?: string | null;
  customData?: {
    nodePath?: string;
    resourceType?: string;
    terraformTopologyRole?: string;
    terraformTopologyPath?: unknown;
  };
};

function expandedNodesAndTfd() {
  return nodesAndTfdFromPreset("staging-multi-state-expanded");
}

function nodesAndTfdFromPreset(presetId: string) {
  const rawSources = getTerraformImportPresetSourcesFromDb(presetId);
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
  return {
    nodes,
    sources,
    tfdTexts: sources.tfdTexts,
    tfdLabels: sources.tfdLabels,
  };
}

function edgePairKey(source: string, target: string) {
  return `${source} -> ${target}`;
}

function resourceFrameRoles(
  elements: readonly LooseLayoutElement[],
  nodePath: string,
) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const resource = elements.find(
    (element) =>
      element.type === "rectangle" && element.customData?.nodePath === nodePath,
  );
  expect(resource, nodePath).toBeTruthy();

  const roles: string[] = [];
  let frameId = resource!.frameId ?? null;
  while (frameId) {
    const frame = byId.get(frameId);
    if (!frame) {
      break;
    }
    const role = frame.customData?.terraformTopologyRole;
    if (role) {
      roles.push(role);
    }
    frameId = frame.frameId ?? null;
  }
  return roles;
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
      const body = await importStagingSemanticLayoutBody();
      const elements = body.elements as LooseLayoutElement[];

      const sqsPaths = [
        ...new Set<string>(
          elements
            .filter(
              (e) =>
                !e.isDeleted &&
                e.type === "rectangle" &&
                e.customData?.resourceType === "aws_sqs_queue",
            )
            .map((e) => e.customData?.nodePath ?? ""),
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

describe("staging-localstack pipeline preset", () => {
  it(
    "resolves binds and produces a non-empty pipeline layout",
    async () => {
      const { nodes, sources, tfdTexts, tfdLabels } =
        nodesAndTfdFromPreset("staging-localstack");
      const { edges, errors, warnings } = applyDeclaredDataFlowFromMany(
        nodes,
        tfdTexts,
        tfdLabels,
      );

      expect(errors, errors.join("\n")).toEqual([]);
      expect(warnings).toEqual([]);
      expect(edges.length).toBeGreaterThan(0);

      const body = await layoutTerraformViaWorkers(sources, {
        semanticLayout: false,
        layoutMode: "pipeline",
      });
      expect((body.elements as unknown[]).length).toBeGreaterThan(0);
      const meta = body.meta as
        | { layoutEngine?: string; pipelineEdgeCount?: number }
        | undefined;
      expect(meta?.layoutEngine).toBe("pipeline");
      expect(meta?.pipelineEdgeCount).toBeGreaterThan(0);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "wraps VPC-level pipeline resources in their topology frames",
    async () => {
      const { sources } = nodesAndTfdFromPreset("staging-localstack");
      const body = await layoutTerraformViaWorkers(sources, {
        semanticLayout: false,
        layoutMode: "pipeline",
      });
      const elements = body.elements as LooseLayoutElement[];

      expect(
        resourceFrameRoles(
          elements,
          "module.east_network.module.vpc.aws_internet_gateway.this[0]",
        ),
      ).toEqual(
        expect.arrayContaining([
          "primaryCluster",
          "vpc",
          "region",
          "account",
          "provider",
        ]),
      );
      expect(
        resourceFrameRoles(
          elements,
          "module.east_network.module.vpc.aws_nat_gateway.this[0]",
        ),
      ).toEqual(
        expect.arrayContaining([
          "primaryCluster",
          "subnetZone",
          "vpc",
          "region",
          "account",
          "provider",
        ]),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});

describe("staging-extended-localstack pipeline preset", () => {
  it(
    "resolves extended lake Kubernetes and security paths",
    async () => {
      const { nodes, sources, tfdTexts, tfdLabels } = nodesAndTfdFromPreset(
        "staging-extended-localstack",
      );
      const { edges, errors, warnings } = applyDeclaredDataFlowFromMany(
        nodes,
        tfdTexts,
        tfdLabels,
      );

      expect(errors, errors.join("\n")).toEqual([]);
      expect(warnings).toEqual([]);
      expect(edges.length).toBeGreaterThan(30);

      expect(Object.keys(nodes)).toEqual(
        expect.arrayContaining([
          'aws_s3_bucket.lake["raw"]',
          "aws_eks_cluster.stream_processors",
          "aws_cloudtrail.organization",
          "aws_cloudwatch_log_group.guardduty_findings",
        ]),
      );

      const body = await layoutTerraformViaWorkers(sources, {
        semanticLayout: false,
        layoutMode: "pipeline",
      });
      const elements = body.elements as LooseLayoutElement[];
      expect(elements.length).toBeGreaterThan(0);

      expect(
        resourceFrameRoles(elements, "aws_eks_cluster.stream_processors"),
      ).toEqual(
        expect.arrayContaining(["primaryCluster", "vpc", "region", "account"]),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});

describe("staging-extended-localstack-v2 pipeline preset", () => {
  it(
    "resolves multi-account Organizations ingestion and security paths",
    async () => {
      const { nodes, sources, tfdTexts, tfdLabels } = nodesAndTfdFromPreset(
        "staging-extended-localstack-v2",
      );
      const { edges, errors, warnings } = applyDeclaredDataFlowFromMany(
        nodes,
        tfdTexts,
        tfdLabels,
      );

      expect(errors, errors.join("\n")).toEqual([]);
      expect(warnings).toEqual([]);
      expect(edges.length).toBeGreaterThan(40);

      expect(Object.keys(nodes)).toEqual(
        expect.arrayContaining([
          "aws_organizations_organization.this",
          "aws_organizations_organizational_unit.workloads",
          "aws_organizations_organizational_unit.data_platform",
          "aws_organizations_organizational_unit.security",
          'aws_s3_bucket.lake["raw"]',
          "aws_eks_cluster.stream_processors",
          "aws_dynamodb_table.regional_events_east",
          'aws_s3_bucket.audit["audit"]',
          "aws_cloudtrail.organization",
          "aws_config_configuration_recorder.this",
          "aws_sns_topic.ops",
        ]),
      );

      const edgeKeys = new Set(
        edges.map((e) => edgePairKey(e.source, e.target)),
      );
      expect(
        edgeKeys.has(
          edgePairKey(
            "aws_organizations_organization.this",
            "aws_organizations_organizational_unit.workloads",
          ),
        ),
      ).toBe(true);
      expect(
        edgeKeys.has(
          edgePairKey(
            "aws_organizations_account.ingestion",
            "aws_sqs_queue.ingest_fifo",
          ),
        ),
      ).toBe(true);
      expect(
        edgeKeys.has(
          edgePairKey(
            "aws_organizations_account.security",
            "aws_cloudtrail.organization",
          ),
        ),
      ).toBe(true);

      const body = await layoutTerraformViaWorkers(sources, {
        semanticLayout: false,
        layoutMode: "pipeline",
      });
      const elements = body.elements as LooseLayoutElement[];
      expect(elements.length).toBeGreaterThan(0);

      expect(
        resourceFrameRoles(elements, "aws_eks_cluster.stream_processors"),
      ).toEqual(
        expect.arrayContaining(["primaryCluster", "vpc", "region", "account"]),
      );
      expect(
        resourceFrameRoles(elements, "aws_cloudtrail.organization"),
      ).toEqual(expect.arrayContaining(["primaryCluster", "account"]));
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});

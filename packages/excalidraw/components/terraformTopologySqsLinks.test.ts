import { describe, expect, it } from "vitest";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { buildSqsCompanionCluster } from "./terraformTopologySqsLinks";

describe("terraformTopologySqsLinks", () => {
  it("buildSqsCompanionCluster collects queue policy attached by queue URL ref", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_sqs_queue.q": {
        resources: {
          "aws_sqs_queue.q": {
            address: "aws_sqs_queue.q",
            mode: "managed",
            type: "aws_sqs_queue",
            change: {
              actions: ["no-op"],
              after: {
                url: "https://sqs.us-east-1.amazonaws.com/111111111111/my-queue",
              },
            },
          },
        },
      },
      "aws_sqs_queue_policy.q": {
        resources: {
          "aws_sqs_queue_policy.q": {
            address: "aws_sqs_queue_policy.q",
            mode: "managed",
            type: "aws_sqs_queue_policy",
            change: {
              actions: ["create"],
              after: {
                queue_url:
                  "https://sqs.us-east-1.amazonaws.com/111111111111/my-queue",
                policy: "{}",
              },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildSqsCompanionCluster(
      nodes,
      "aws_sqs_queue.q",
      arnIndex,
    );
    expect(cluster).not.toBeNull();
    expect(cluster!.stack).toContain("aws_sqs_queue_policy.q");
    expect(
      edges.some(
        (e) =>
          e.source === "aws_sqs_queue.q" &&
          e.target === "aws_sqs_queue_policy.q",
      ),
    ).toBe(true);
  });
});

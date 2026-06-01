import { describe, expect, it } from "vitest";

import {
  HAS_ALLPLANMODULES_FIXTURES,
  HAS_DELPLAN_FIXTURES,
  hasTerraformBackendFile,
  readTerraformBackendFile,
} from "../test-fixtures/terraformPresetFixtures";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("terraform action colors regression", () => {
  it.skipIf(!HAS_DELPLAN_FIXTURES)(
    "delplan delete IAM policy cards stay red after AWS icon inject",
    async () => {
      const plan = JSON.parse(readTerraformBackendFile("delplan.json"));
      const dot = readTerraformBackendFile("delplan.dot");
      const deletePolicy = (plan.resource_changes || []).find(
        (rc: { type?: string; change?: { actions?: string[] } }) =>
          rc.type === "aws_iam_role_policy" &&
          rc.change?.actions?.includes("delete"),
      ) as { address: string } | undefined;
      expect(deletePolicy?.address).toBeTruthy();

      const res = await terraformPlanParsingFromSources(
        { planDotBundles: [{ plan, dotText: dot }], states: [], tfdTexts: [] },
        { semanticLayout: true },
      );
      expect(res.ok).toBe(true);
      const body = await res.json();
      const cards = body.elements.filter(
        (e: {
          type?: string;
          customData?: {
            nodePath?: string;
            terraformVisibilityRole?: string;
            terraformAwsIconGlyph?: boolean;
          };
        }) =>
          e.type === "rectangle" &&
          e.customData?.terraformVisibilityRole === "resource" &&
          e.customData?.nodePath === deletePolicy!.address,
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].strokeColor).toBe("#c92a2a");
      expect(cards[0].customData?.action).toBe("delete");
    },
    60_000,
  );

  it.skipIf(!HAS_ALLPLANMODULES_FIXTURES)(
    "allplanmodules test-writer lambda is yellow (update)",
    async () => {
      const plan = JSON.parse(readTerraformBackendFile("allplanmodules.json"));
      const dot = readTerraformBackendFile("allplanmodules.dot");
      const tfd = readTerraformBackendFile("allplanmodules.tfd");
      const writerAddr =
        "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
      const writerChange = (plan.resource_changes || []).find(
        (rc: { address?: string; change?: { actions?: string[] } }) =>
          rc.address === writerAddr,
      ) as { change?: { actions?: string[] } } | undefined;
      expect(writerChange?.change?.actions).toContain("update");

      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles: [{ plan, dotText: dot }],
          states: [],
          tfdTexts: [tfd],
        },
        { semanticLayout: true },
      );
      expect(res.ok).toBe(true);
      const body = await res.json();
      const cards = body.elements.filter(
        (e: {
          type?: string;
          customData?: {
            nodePath?: string;
            terraformVisibilityRole?: string;
          };
        }) =>
          e.type === "rectangle" &&
          e.customData?.terraformVisibilityRole === "resource" &&
          e.customData?.nodePath === writerAddr,
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].strokeColor).toBe("#e67700");
      expect(cards[0].customData?.action).toBe("update");
    },
    60_000,
  );

  it.skipIf(
    !HAS_ALLPLANMODULES_FIXTURES ||
      !hasTerraformBackendFile("terraform_allplanmodules.tfstate"),
  )(
    "allplanmodules test-writer lambda stays yellow with plan+state merge",
    async () => {
      const plan = JSON.parse(readTerraformBackendFile("allplanmodules.json"));
      const dot = readTerraformBackendFile("allplanmodules.dot");
      const tfd = readTerraformBackendFile("allplanmodules.tfd");
      const state = JSON.parse(
        readTerraformBackendFile("terraform_allplanmodules.tfstate"),
      );
      const writerAddr =
        "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";

      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles: [{ plan, dotText: dot }],
          states: [state],
          tfdTexts: [tfd],
        },
        { semanticLayout: true },
      );
      expect(res.ok).toBe(true);
      const body = await res.json();
      const cards = body.elements.filter(
        (e: {
          type?: string;
          customData?: {
            nodePath?: string;
            terraformVisibilityRole?: string;
          };
        }) =>
          e.type === "rectangle" &&
          e.customData?.terraformVisibilityRole === "resource" &&
          e.customData?.nodePath === writerAddr,
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].strokeColor).toBe("#e67700");
      expect(cards[0].customData?.action).toBe("update");
      const attrs = cards[0].customData?.terraformResources?.[0]?.attributes;
      expect(attrs?.some((a: { changed?: boolean }) => a.changed)).toBe(true);
    },
    60_000,
  );
});

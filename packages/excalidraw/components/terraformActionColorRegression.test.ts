import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

const TF_ROOT = path.resolve(import.meta.dirname, "../../backend/terraform");

describe("terraform action colors regression", () => {
  it("delplan delete IAM policy cards stay red after AWS icon inject", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "delplan.json"), "utf8"),
    );
    const dot = fs.readFileSync(path.join(TF_ROOT, "delplan.dot"), "utf8");
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
  }, 60_000);

  it("allplanmodules test-writer lambda is yellow (update)", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const tfd = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.tfd"),
      "utf8",
    );
    const writerAddr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";

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
        strokeColor?: string;
      }) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        e.customData?.nodePath === writerAddr,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].strokeColor).toBe("#e67700");
    expect(cards[0].customData?.action).toBe("update");
  }, 120_000);
});

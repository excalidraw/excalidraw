import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import {
  buildCloudflareProviderScene,
  composeMultiProviderTopologyScene,
} from "./terraformProviderLayout";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_ROOT = path.resolve(__dirname, "../../backend/terraform");

describe("terraformProviderLayout", () => {
  it("groups cloudflare fixture into zone/pages/workers bands", async () => {
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }

    const plan = JSON.parse(
      fs.readFileSync(
        path.join(TF_ROOT, "cloudflare/cloudflare-plan.json"),
        "utf8",
      ),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "cloudflare/cloudflare-plan.dot"),
      "utf8",
    );
    const graph = graphlibDot.read(dot);
    const nodes = buildTerraformLocalImportNodesMap(plan, graph, null);
    const changes = (plan.resource_changes || []).filter(
      (rc: { mode?: string }) => rc.mode !== "data",
    );

    const scene = await buildCloudflareProviderScene(changes, nodes, plan);
    expect(scene.meta.resourceCount).toBeGreaterThan(0);
    expect(scene.meta.accountCount).toBe(1);

    const zoneTile = scene.elements.find(
      (e) => e.customData?.nodePath === "cloudflare_zone.tfdraw_dev",
    );
    expect(
      zoneTile?.customData?.terraformResources?.[0]?.attributes?.length,
    ).toBeGreaterThan(0);

    const nodePaths = scene.elements
      .map((e) => e.customData?.nodePath)
      .filter(Boolean);
    expect(nodePaths).toContain("cloudflare_zone.tfdraw_dev");
    expect(nodePaths).toContain("cloudflare_pages_project.ainur");
    expect(nodePaths).toContain("cloudflare_workers_script.ainur");

    const bandFrames = scene.elements.filter(
      (e) => e.customData?.terraformTopologyRole === "providerBand",
    );
    expect(bandFrames.length).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it("wraps provider blocks in labeled provider frames", () => {
    const blockA = {
      family: "aws" as const,
      label: "AWS",
      elements: [
        {
          id: "a1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          isDeleted: false,
          customData: { terraformTopologyRole: "account" },
        } as any,
      ],
    };
    const blockB = {
      family: "cloudflare" as const,
      label: "Cloudflare",
      elements: [
        {
          id: "c1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          isDeleted: false,
          customData: { terraformTopologyRole: "providerAccount" },
        } as any,
      ],
    };

    const composed = composeMultiProviderTopologyScene([blockA, blockB]);
    const providerFrames = composed.filter(
      (e) => e.customData?.terraformTopologyRole === "provider",
    );
    expect(providerFrames).toHaveLength(2);
    expect(
      providerFrames.map((e) => e.customData?.terraformProviderFamily),
    ).toEqual(expect.arrayContaining(["aws", "cloudflare"]));
  });
});

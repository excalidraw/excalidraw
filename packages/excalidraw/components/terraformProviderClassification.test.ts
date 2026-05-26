import { describe, expect, it } from "vitest";

import {
  classifyTerraformResourceChange,
  filterPlanByProviderFamily,
  getProviderFamilyLabel,
  hasManagedResourcesForSemantic,
  partitionResourceChangesByProviderFamily,
  sortedNonAwsProviderFamilies,
} from "./terraformProviderClassification";

describe("terraformProviderClassification", () => {
  it("classifies AWS from type and provider_name", () => {
    expect(
      classifyTerraformResourceChange({
        type: "aws_s3_bucket",
        provider_name: "registry.terraform.io/hashicorp/aws",
      }).providerFamily,
    ).toBe("aws");
  });

  it("classifies Cloudflare from type prefix", () => {
    expect(
      classifyTerraformResourceChange({
        type: "cloudflare_zone",
        address: "cloudflare_zone.example",
      }).providerFamily,
    ).toBe("cloudflare");
  });

  it("partitions mixed plan by provider family", () => {
    const buckets = partitionResourceChangesByProviderFamily({
      resource_changes: [
        { mode: "managed", type: "aws_vpc", address: "aws_vpc.main" },
        {
          mode: "managed",
          type: "cloudflare_zone",
          address: "cloudflare_zone.example",
        },
      ],
    });
    expect(buckets.get("aws")).toHaveLength(1);
    expect(buckets.get("cloudflare")).toHaveLength(1);
  });

  it("hasManagedResourcesForSemantic accepts Cloudflare-only plans", () => {
    expect(
      hasManagedResourcesForSemantic({
        resource_changes: [
          {
            mode: "managed",
            type: "cloudflare_zone",
            address: "cloudflare_zone.x",
          },
        ],
      }),
    ).toBe(true);
  });

  it("filterPlanByProviderFamily keeps only matching resources", () => {
    const filtered = filterPlanByProviderFamily(
      {
        resource_changes: [
          { mode: "managed", type: "aws_vpc", address: "aws_vpc.main" },
          {
            mode: "managed",
            type: "cloudflare_zone",
            address: "cloudflare_zone.example",
          },
        ],
      },
      "cloudflare",
    );
    expect(filtered.resource_changes).toHaveLength(1);
    expect(filtered.resource_changes![0].address).toBe(
      "cloudflare_zone.example",
    );
  });

  it("sortedNonAwsProviderFamilies includes any non-AWS bucket", () => {
    const buckets = partitionResourceChangesByProviderFamily({
      resource_changes: [
        { mode: "managed", type: "aws_vpc", address: "aws_vpc.main" },
        {
          mode: "managed",
          type: "cloudflare_zone",
          address: "cloudflare_zone.example",
        },
        { mode: "managed", type: "random_id", address: "random_id.x" },
      ],
    });
    expect(sortedNonAwsProviderFamilies(buckets)).toEqual([
      "cloudflare",
      "other",
    ]);
    expect(getProviderFamilyLabel("other")).toBe("Other");
  });
});

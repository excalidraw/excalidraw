import { describe, expect, it } from "vitest";

import {
  getTerraformResourceTypeFromNodePath,
  isChangedTerraformAction,
  isGenericManagedProviderResourceType,
  isInitiallyVisibleTerraformResource,
  isInitiallyVisibleTerraformTopologyTile,
  isManagedTopologyResourceType,
  isPrimaryVisibleResourceType,
  isTopologyPlacementResourceType,
} from "./terraformPrimaryVisibility";

describe("terraformPrimaryVisibility", () => {
  describe("isPrimaryVisibleResourceType", () => {
    it.each([
      ["aws_lambda_function", true],
      ["aws_s3_bucket", true],
      ["aws_sqs_queue", true],
      ["aws_api_gateway_rest_api", true],
      ["aws_apigatewayv2_api", true],
      ["aws_kms_key", true],
      ["cloudflare_zone", true],
      ["cloudflare_dns_record", true],
      ["google_compute_instance", true],
      ["azurerm_resource_group", true],
      ["vercel_project", true],
      ["random_id", true],
      ["terraform_module", true],
      ["terraform_data", false],
      ["data.aws_region", false],
      ["data.cloudflare_zone", false],
      ["aws_vpc_security_group_ingress_rule", false],
      ["aws_iam_role", false],
      ["", false],
      ["cloudflare", false],
    ])("%s → %s", (type, expected) => {
      expect(isPrimaryVisibleResourceType(type)).toBe(expected);
    });
  });

  describe("isGenericManagedProviderResourceType", () => {
    it.each([
      ["cloudflare_zone", true],
      ["google_compute_instance", true],
      ["azurerm_resource_group", true],
      ["vercel_project", true],
      ["random_id", true],
      ["aws_lambda_function", false],
      ["aws_iam_role", false],
      ["terraform_data", false],
      ["data.aws_region", false],
      ["data.cloudflare_zone", false],
      ["", false],
      ["cloudflare", false],
      ["Cloudflare_zone", false],
    ])("%s → %s", (type, expected) => {
      expect(isGenericManagedProviderResourceType(type)).toBe(expected);
    });
  });

  describe("isChangedTerraformAction", () => {
    it.each([
      ["create", true],
      ["update", true],
      ["delete", true],
      ["replace", true],
      ["no-op", false],
      ["read", false],
    ])("%s → %s", (action, expected) => {
      expect(isChangedTerraformAction(action)).toBe(expected);
    });
  });

  describe("isManagedTopologyResourceType", () => {
    it.each([
      ["aws_api_gateway_rest_api", true],
      ["aws_iam_role", true],
      ["aws_lambda_permission", true],
      ["cloudflare_zone", true],
      ["terraform_data", false],
      ["data", false],
    ])("%s → %s", (type, expected) => {
      expect(isManagedTopologyResourceType(type)).toBe(expected);
    });
  });

  describe("isTopologyPlacementResourceType", () => {
    it("excludes lambda permission tiles (satellite-only)", () => {
      expect(isTopologyPlacementResourceType("aws_lambda_permission")).toBe(
        false,
      );
    });
    it("excludes aws_subnet (structural subnet zones only)", () => {
      expect(isTopologyPlacementResourceType("aws_subnet")).toBe(false);
    });
    it("includes primary API Gateway types", () => {
      expect(isTopologyPlacementResourceType("aws_api_gateway_rest_api")).toBe(
        true,
      );
      expect(isPrimaryVisibleResourceType("aws_api_gateway_rest_api")).toBe(
        true,
      );
    });
  });

  describe("isInitiallyVisibleTerraformResource", () => {
    it("shows managed types on no-op (staging plans)", () => {
      expect(
        isInitiallyVisibleTerraformResource("aws_lambda_function", "no-op"),
      ).toBe(true);
      expect(
        isInitiallyVisibleTerraformResource(
          "aws_api_gateway_rest_api",
          "no-op",
        ),
      ).toBe(true);
      expect(isInitiallyVisibleTerraformResource("aws_iam_role", "no-op")).toBe(
        true,
      );
    });
    it("shows non-aws types when action is a change", () => {
      expect(
        isInitiallyVisibleTerraformResource("aws_iam_role", "create"),
      ).toBe(true);
    });
    it("hides bookkeeping types on no-op", () => {
      expect(
        isInitiallyVisibleTerraformResource("terraform_data", "no-op"),
      ).toBe(false);
    });
  });

  describe("isInitiallyVisibleTerraformTopologyTile", () => {
    it("always shows semantic infra tiles such as aws_nat_gateway", () => {
      expect(
        isInitiallyVisibleTerraformTopologyTile("aws_nat_gateway", "no-op"),
      ).toBe(true);
    });
    it("falls back to resource visibility for non-infra types", () => {
      expect(
        isInitiallyVisibleTerraformTopologyTile("aws_iam_role", "no-op"),
      ).toBe(true);
      expect(
        isInitiallyVisibleTerraformTopologyTile("aws_iam_role", "create"),
      ).toBe(true);
    });
  });

  describe("getTerraformResourceTypeFromNodePath", () => {
    it("parses bare managed addresses", () => {
      expect(getTerraformResourceTypeFromNodePath("aws_s3_bucket.x")).toBe(
        "aws_s3_bucket",
      );
    });
    it("returns data for data sources", () => {
      expect(
        getTerraformResourceTypeFromNodePath(
          "module.core.data.aws_caller_identity.current",
        ),
      ).toBe("data");
    });
    it("skips module segments to reach the resource type", () => {
      expect(
        getTerraformResourceTypeFromNodePath(
          "module.network.module.sub.aws_vpc.main",
        ),
      ).toBe("aws_vpc");
    });
    it("returns terraform_module when path ends after module walk", () => {
      expect(getTerraformResourceTypeFromNodePath("module.a")).toBe(
        "terraform_module",
      );
    });
  });
});

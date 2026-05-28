import { describe, expect, it } from "vitest";

import {
  isStackQualifiedAddress,
  parseStackAddress,
  parseStackGroupModulePath,
  prefixStackAddress,
  stackGroupModulePath,
  stackIdFromBundleLabel,
  stackQualifiedModulePath,
  stripStackPrefixForModuleParsing,
} from "./terraformStackAddress";

describe("terraformStackAddress", () => {
  it("prefixes and parses stack-qualified addresses", () => {
    const full = prefixStackAddress(
      "40-east-api-1",
      "module.api.aws_lambda_function.this",
    );
    expect(full).toBe("40-east-api-1::module.api.aws_lambda_function.this");
    expect(parseStackAddress(full)).toEqual({
      stackId: "40-east-api-1",
      address: "module.api.aws_lambda_function.this",
    });
    expect(isStackQualifiedAddress(full)).toBe(true);
  });

  it("strips prefix for module parsing", () => {
    expect(
      stripStackPrefixForModuleParsing(
        "44-east-api-5::module.api.aws_ssm_parameter.api_name",
      ),
    ).toBe("module.api.aws_ssm_parameter.api_name");
  });

  it("uses bundle label as stack id with fallback", () => {
    expect(stackIdFromBundleLabel("10-east-ecs-edge", 0)).toBe(
      "10-east-ecs-edge",
    );
    expect(stackIdFromBundleLabel(undefined, 2)).toBe("stack-3");
  });

  it("builds stack-qualified module paths", () => {
    expect(stackQualifiedModulePath("40-east-api-1", "root")).toBe(
      "40-east-api-1::root",
    );
    expect(stackQualifiedModulePath("40-east-api-1", "module.api")).toBe(
      "40-east-api-1::module.api",
    );
    expect(stackQualifiedModulePath(undefined, "module.api")).toBe(
      "module.api",
    );
  });

  it("builds synthetic stack group module paths", () => {
    expect(stackGroupModulePath("40-east-api-1")).toBe(
      "__stack__::40-east-api-1",
    );
    expect(parseStackGroupModulePath("__stack__::40-east-api-1")).toEqual({
      stackId: "40-east-api-1",
    });
  });
});

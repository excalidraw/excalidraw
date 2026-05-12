import { describe, expect, it, afterEach } from "vitest";

import {
  terraformHumanNameFromPlanResource,
  terraformRegisterHumanNameFields,
  terraformResetHumanNameFieldOverrides,
} from "./terraformResourceHumanName";

afterEach(() => {
  terraformResetHumanNameFieldOverrides();
});

describe("terraformHumanNameFromPlanResource", () => {
  it("prefers function_name for aws_lambda_function", () => {
    expect(
      terraformHumanNameFromPlanResource({
        type: "aws_lambda_function",
        mode: "managed",
        change: { after: { function_name: "my-api", role: "x" } },
      }),
    ).toBe("my-api");
  });

  it("prefers bucket for aws_s3_bucket over Terraform block name", () => {
    expect(
      terraformHumanNameFromPlanResource({
        type: "aws_s3_bucket",
        mode: "managed",
        name: "data",
        values: { bucket: "prod-logs-abc" },
      }),
    ).toBe("prod-logs-abc");
  });

  it("uses name_prefix for aws_security_group when name absent", () => {
    expect(
      terraformHumanNameFromPlanResource({
        type: "aws_security_group",
        mode: "managed",
        change: { after: { name_prefix: "app-", vpc_id: "vpc-1" } },
      }),
    ).toBe("app-");
  });

  it("reads tags.Name for aws_instance", () => {
    expect(
      terraformHumanNameFromPlanResource({
        type: "aws_instance",
        mode: "managed",
        values: {
          tags: { Name: "bastion-1" },
        },
      }),
    ).toBe("bastion-1");
  });

  it("allows registering custom type fields", () => {
    terraformRegisterHumanNameFields({
      aws_foo_bar: ["widget_id", "name"],
    });
    expect(
      terraformHumanNameFromPlanResource({
        type: "aws_foo_bar",
        mode: "managed",
        change: { after: { widget_id: "w-99", name: "ignored-second" } },
      }),
    ).toBe("w-99");
  });
});

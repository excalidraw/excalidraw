import { describe, expect, it } from "vitest";

import {
  getTerraformCardResourceType,
  terraformInstanceNameFromAddress,
  terraformResourceCardLabel,
} from "./terraformResourceCardLabel";

describe("terraformResourceCardLabel", () => {
  it("prefers provider human attribute over Terraform block name", () => {
    const label = terraformResourceCardLabel(
      "module.network.aws_s3_bucket.data",
      {
        type: "aws_s3_bucket",
        name: "data",
        mode: "managed",
        values: { bucket: "my-corporate-bucket" },
      },
    );
    expect(label).toBe("my-corporate-bucket");
  });

  it("uses function_name for lambda when present in plan", () => {
    const label = terraformResourceCardLabel("aws_lambda_function.fn", {
      type: "aws_lambda_function",
      mode: "managed",
      name: "fn",
      change: { after: { function_name: "live-handler", role: "r" } },
    });
    expect(label).toBe("live-handler");
  });

  it("falls back to Terraform name then address tail", () => {
    expect(
      terraformResourceCardLabel("aws_lambda_function.fn", {
        type: "aws_lambda_function",
        mode: "managed",
        name: "fn",
      }),
    ).toBe("fn");

    expect(
      terraformResourceCardLabel("aws_lambda_function.fn", {
        type: "aws_lambda_function",
        mode: "managed",
      }),
    ).toBe("fn");
  });

  it("uses data source instance label from address when no values", () => {
    expect(
      terraformResourceCardLabel("data.aws_caller_identity.current", {
        type: "aws_caller_identity",
        mode: "data",
      }),
    ).toBe("current");
  });
});

describe("terraformInstanceNameFromAddress", () => {
  it("returns last module call for module-only addresses", () => {
    expect(
      terraformInstanceNameFromAddress(
        "module.network.module.db",
        "terraform_module",
      ),
    ).toBe("db");
  });
});

describe("getTerraformCardResourceType", () => {
  it("prefixes data sources with data.", () => {
    expect(
      getTerraformCardResourceType("data.aws_caller_identity.current", {
        type: "aws_caller_identity",
        mode: "data",
      }),
    ).toBe("data.aws_caller_identity");
  });
});

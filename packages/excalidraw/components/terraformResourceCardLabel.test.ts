import { describe, expect, it } from "vitest";

import {
  getTerraformCardResourceType,
  terraformResourceCardLabel,
} from "./terraformResourceCardLabel";

describe("terraformResourceCardLabel", () => {
  it("uses dotted module line and type.name from plan name", () => {
    const label = terraformResourceCardLabel(
      "module.network.aws_s3_bucket.data",
      {
        type: "aws_s3_bucket",
        name: "data",
        mode: "managed",
      },
    );
    expect(label).toBe("network\naws_s3_bucket.data");
  });

  it("falls back to address tail when plan name is absent", () => {
    const label = terraformResourceCardLabel("aws_lambda_function.fn", {
      type: "aws_lambda_function",
      mode: "managed",
    });
    expect(label).toBe("aws_lambda_function.fn");
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

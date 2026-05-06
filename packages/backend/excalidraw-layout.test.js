const { buildModuleInternalOffsets } = require("./excalidraw-layout");
const { stripTerraformInstanceIndexes } = require("./excalidraw-elements");

describe("Lambda module internal layout (indexed terraform-aws-modules/lambda)", () => {
  it("maps [0]-suffixed addresses to preset offsets when registry source matches", () => {
    const modulePath = "module.lambda-monitoring";
    const moduleGroup = {
      modulePath,
      source: "terraform-aws-modules/lambda/aws",
    };
    const members = [
      modulePath,
      `${modulePath}.aws_lambda_function.this[0]`,
      `${modulePath}.aws_iam_role.lambda[0]`,
      `${modulePath}.aws_iam_role_policy.logs[0]`,
    ];

    const offsets = buildModuleInternalOffsets(members, modulePath, moduleGroup);

    expect(offsets[`${modulePath}.aws_lambda_function.this[0]`]).toEqual({
      x: 0,
      y: 0,
    });
    expect(offsets[`${modulePath}.aws_iam_role.lambda[0]`]).toEqual({
      x: -360,
      y: 0,
    });
    expect(offsets[`${modulePath}.aws_iam_role_policy.logs[0]`]).toEqual({
      x: -360,
      y: -170,
    });
    expect(offsets[modulePath]).toEqual(expect.any(Object));
  });

  it("stripTerraformInstanceIndexes matches pipeline stripIndexes behavior", () => {
    expect(stripTerraformInstanceIndexes("aws_lambda_function.this[0]")).toBe(
      "aws_lambda_function.this",
    );
    expect(
      stripTerraformInstanceIndexes('aws_resource.foo["a"].bar[1]'),
    ).toBe("aws_resource.foo.bar");
  });
});

const {
  buildModuleInternalOffsets,
  estimateModuleLayoutSizes,
} = require("./excalidraw-layout");
const { stripTerraformInstanceIndexes } = require("./excalidraw-elements");

const testTierMap = (members) =>
  Object.fromEntries(members.map((member) => [member, 0]));
const testTierConfigs = { 0: { w: 220, h: 100 } };
const MODULE_PADDING_X = 52;
const MODULE_PADDING_TOP = 72;
const MODULE_PADDING_BOTTOM = 40;

function resourceRect(offsets, nodePath) {
  return {
    x: offsets[nodePath].x,
    y: offsets[nodePath].y,
    w: 220,
    h: 100,
  };
}

function moduleRect(offsets, nodePaths) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const nodePath of nodePaths) {
    const rect = resourceRect(offsets, nodePath);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return {
    x: minX - MODULE_PADDING_X,
    y: minY - MODULE_PADDING_TOP,
    w: maxX - minX + MODULE_PADDING_X * 2,
    h: maxY - minY + MODULE_PADDING_TOP + MODULE_PADDING_BOTTOM,
  };
}

function overlaps(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

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

describe("recursive collapsed module internal layout", () => {
  it("packs sibling child module blocks without overlapping their module boxes", () => {
    const modulePath = "module.parent";
    const childA = `${modulePath}.module.lambda`;
    const childB = `${modulePath}.module.security_group[0]`;
    const members = [
      modulePath,
      `${modulePath}.aws_cloudwatch_metric_alarm.lambda_errors[0]`,
      childA,
      `${childA}.aws_lambda_function.this[0]`,
      `${childA}.aws_iam_role.lambda[0]`,
      childB,
      `${childB}.aws_security_group.this_name_prefix[0]`,
      `${childB}.aws_security_group_rule.egress_with_cidr_blocks[0]`,
      `${childB}.aws_security_group_rule.egress_with_prefix_list_ids[0]`,
    ];

    const offsets = buildModuleInternalOffsets(
      members,
      modulePath,
      { modulePath, source: "example/parent" },
      testTierMap(members),
      testTierConfigs,
      new Map([
        [modulePath, { modulePath, source: "example/parent" }],
        [
          childA,
          { modulePath: childA, source: "terraform-aws-modules/lambda/aws" },
        ],
        [
          childB,
          {
            modulePath: childB,
            source: "terraform-aws-modules/security-group/aws",
          },
        ],
      ]),
    );

    const lambdaBox = moduleRect(
      offsets,
      members.filter((path) => path === childA || path.startsWith(`${childA}.`)),
    );
    const securityGroupBox = moduleRect(
      offsets,
      members.filter((path) => path === childB || path.startsWith(`${childB}.`)),
    );

    expect(overlaps(lambdaBox, securityGroupBox)).toBe(false);
  });

  it("places direct parent resources outside child module boxes", () => {
    const modulePath = "module.parent";
    const child = `${modulePath}.module.child`;
    const directResource = `${modulePath}.aws_cloudwatch_metric_alarm.lambda_errors[0]`;
    const members = [
      modulePath,
      directResource,
      child,
      `${child}.aws_lambda_function.this[0]`,
      `${child}.aws_iam_role.lambda[0]`,
    ];

    const offsets = buildModuleInternalOffsets(
      members,
      modulePath,
      null,
      testTierMap(members),
      testTierConfigs,
      new Map([
        [
          child,
          { modulePath: child, source: "terraform-aws-modules/lambda/aws" },
        ],
      ]),
    );
    const childBox = moduleRect(
      offsets,
      members.filter((path) => path === child || path.startsWith(`${child}.`)),
    );

    expect(overlaps(resourceRect(offsets, directResource), childBox)).toBe(false);
  });

  it("measures nested child modules bottom-up for collapsed module collision size", () => {
    const modulePath = "module.parent";
    const child = `${modulePath}.module.child`;
    const grandchild = `${child}.module.grandchild`;
    const members = [
      modulePath,
      child,
      `${child}.aws_sqs_queue.queue`,
      grandchild,
      `${grandchild}.aws_lambda_function.this[0]`,
      `${grandchild}.aws_iam_role.lambda[0]`,
    ];
    const moduleMembers = new Map([[modulePath, members]]);
    const sizes = estimateModuleLayoutSizes(
      moduleMembers,
      new Map([
        [
          grandchild,
          {
            modulePath: grandchild,
            source: "terraform-aws-modules/lambda/aws",
          },
        ],
      ]),
      testTierMap(members),
      testTierConfigs,
    );

    expect(sizes[modulePath].w).toBeGreaterThan(220 + MODULE_PADDING_X * 2);
    expect(sizes[modulePath].h).toBeGreaterThan(
      100 + MODULE_PADDING_TOP + MODULE_PADDING_BOTTOM,
    );
  });
});

const {
  applyModulePresets,
  pinSyntheticTerraformModuleHubs,
  buildTierMap,
  buildTierConfigs,
} = require("./excalidraw-elements");

describe("pinSyntheticTerraformModuleHubs", () => {
  it("moves terraform_module hub from stale grid coords to above descendant bbox", () => {
    const modulePath = "module.workload_monitoring_lambda.module.lambda";
    const lambda = `${modulePath}.aws_lambda_function.this[0]`;
    const role = `${modulePath}.aws_iam_role.lambda[0]`;
    const positions = {
      [modulePath]: { x: 7600, y: 400 },
      [lambda]: { x: 500, y: 400 },
      [role]: { x: 7600, y: 400 },
    };
    const nodeKeys = Object.keys(positions);
    const nodes = {
      [modulePath]: {
        resources: {
          [modulePath]: {
            type: "terraform_module",
            address: modulePath,
            mode: "managed",
            change: { actions: ["no-op"] },
          },
        },
      },
      [lambda]: {
        resources: {
          [lambda]: {
            type: "aws_lambda_function",
            address: lambda,
            mode: "managed",
            change: { actions: ["create"] },
          },
        },
      },
      [role]: {
        resources: {
          [role]: {
            type: "aws_iam_role",
            address: role,
            mode: "managed",
            change: { actions: ["create"] },
          },
        },
      },
    };
    const moduleGroupByPath = new Map([
      [modulePath, { modulePath, source: "terraform-aws-modules/lambda/aws" }],
    ]);
    const tierMap = buildTierMap(nodeKeys);
    const tierConfigs = buildTierConfigs(tierMap, nodeKeys.length);

    applyModulePresets(positions, nodeKeys, moduleGroupByPath);
    pinSyntheticTerraformModuleHubs(
      positions,
      nodeKeys,
      nodes,
      tierMap,
      tierConfigs,
    );

    const lw = tierConfigs[tierMap[lambda]].w;
    const lh = tierConfigs[tierMap[lambda]].h;
    const rw = tierConfigs[tierMap[role]].w;
    const rh = tierConfigs[tierMap[role]].h;
    const minX = Math.min(500, 140);
    const minY = 400;
    const maxX = Math.max(500 + lw, 140 + rw);
    const hubCfg = tierConfigs[tierMap[modulePath]];
    const gap = 28;

    expect(positions[lambda]).toEqual({ x: 500, y: 400 });
    expect(positions[role]).toEqual({ x: 140, y: 400 });
    expect(positions[modulePath]).toEqual({
      x: (minX + maxX) / 2 - hubCfg.w / 2,
      y: minY - gap - hubCfg.h,
    });
  });
});

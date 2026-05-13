/**
 * Prints collapsed-module internal offsets (Lambda preset vs grid fallback).
 *
 * Example:
 *   TF_LAYOUT_DEBUG=module.lambda-monitoring node packages/backend/terraform/layout-debug.js
 *
 * For full-scene layout, run backend tests or POST upload with the same env set so
 * excalidraw-layout logs preset/grid decisions for matching module paths.
 */
const { buildModuleInternalOffsets } = require("../excalidraw-layout");

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

process.stdout.write(
  `${JSON.stringify(
    buildModuleInternalOffsets(members, modulePath, moduleGroup),
    null,
    2,
  )}\n`,
);

# Codex Backend Notes

Purpose: quick orientation for future Codex sessions working on `packages/backend`.
Update this file whenever the backend architecture, Terraform fixture workflow, pipeline order, or layout model changes.

## Package Role

`@excalidraw/backend` converts Terraform/OpenTofu artifacts into Excalidraw scene JSON.

Inputs:

- plan JSON from `terraform show -json` or `tofu show -json`
- DOT graph from `terraform graph -type=plan` or `tofu graph -type=plan`
- optional Terraform state JSON

Output:

- persisted processed Terraform `nodes` graph in SQLite
- downloadable `.excalidraw` scene from `GET /terraform/upload/:id/excalidraw`

## Main Files

- `index.js`: Express routes, upload handling, pipeline orchestration, SQLite persistence.
- `pipeline.js`: plan/DOT/state graph compiler. Produces the `nodes` map and edge channels.
- `excalidraw.js`: scene compiler. Coordinates layout, containers, modules, arrows, and Excalidraw elements.
- `excalidraw-elements.js`: AWS icon/card metadata, tiers, labels, grouping details, custom data.
- `excalidraw-layout.js`: top-level layout (ELK layered by default, d3-force fallback), module collapsing/expansion, VPC perimeter snapping.
- `excalidraw-arrows.js`: dependency/data-flow arrow collection, coalescing, bindings, offsets.
- `vpc-networking-facet.js`: captures VPC/subnet/routing facets before low-level plumbing is omitted.
- `vpc-perimeter.js`: classifies VPC appliance placement on VPC frame walls.
- `terraform-graph-utils.js`: shared Terraform/AWS parsing helpers.

The longer architecture writeup is in `TERRAFORM_BACKEND_ARCHITECTURE.md`.

## Pipeline Order

`index.js` upload route is the source of truth. Current order:

1. `loadPlanAndNodes(plan)`
2. `mergeTerraformState(nodes, state)`
3. `ensureTerraformModuleNodes(nodes)`
4. `applyModuleMetadata(nodes, plan)`
5. `omitNonAllowlistedDataSourceNodes(nodes)`
6. `buildNewEdges(nodes, adjlist)`
7. `computeResourceDiffs(nodes)`
8. `buildExistingEdges(nodes, plan)`
9. `omitNonAllowlistedDataSourceNodes(nodes)`
10. `omitStateOnlyDataSourceNodes(nodes)`
11. `detectGenericStructuralEdges(nodes)`
12. `ensureEdgeLists(nodes)`
13. `pruneRedundantStructuralEdges(nodes)`
14. `externalResources(nodes)`
15. `ensureEdgeLists(nodes)`
16. `buildDataFlowEdges(nodes)`
17. `ensureEdgeLists(nodes)`
18. `omitGhostIamPolicyDocumentNodes(nodes)`
19. `nodes.__networkingFacetStore = extractVpcNetworkingFacetStore(nodes)`
20. `omitVpcPlumbingNodes(nodes)`
21. `deleteOrphanedNodes(nodes)`
22. `cleanUpRoleLinks(nodes)`
23. `filterVisualIgnore(nodes)`
24. `deleteOrphanedNodes(nodes)`
25. `mockLanggraphEnrichment(nodes)` and `applyEnrichment(nodes, enrichment)`

If this order changes, update this file and `TERRAFORM_BACKEND_ARCHITECTURE.md`.

## Node Map Model

Pipeline output is a plain object keyed by Terraform address plus synthetic module paths.

Important fields:

- `resources`: resource payloads keyed by address
- `edges_new`: DOT/plan dependency edges
- `edges_existing`: state/prior dependency edges
- `edges_data_flow`: semantic architecture edges, usually IAM/integration/trigger relationships
- `terraform_module`: module source/version metadata

Keys starting with `__` are metadata, such as `__networkingFacetStore`.

`terraform_config` on synthetic module nodes stores selected plan configuration metadata
needed by semantic edge inference. In particular, module `policy_statements` expression
references can be resolved through module outputs to concrete resources when generated IAM
policy JSON is unknown in `resource_changes`.

## allplanmodules Fixture

Primary files:

- `terraform/allplanmodules`: binary plan artifact
- `terraform/allplanmodules.json`: plan JSON fixture
- `terraform/allplanmodules.dot`: DOT fixture

As inspected on 2026-05-06:

- `allplanmodules.json` is about 1 MB and minified onto one line.
- `allplanmodules.dot` is about 1 MB and 5,442 lines.
- The plan has 79 resource changes across 16 module paths.
- Action counts: 56 `no-op`, 14 `create`, 7 `delete`, 1 `read`, 1 `update`.
- Top resource types include IAM role policies, security group rules, CloudWatch alarms/log groups, Lambda functions, VPC endpoints, S3, SQS, and KMS.

Tests call this fixture through `runAllplanModulesPipeline()` in `excalidraw.test.js`.

Important caveat: fixture artifacts can drift from checked-in Terraform as the demo config changes. Regenerating `allplanmodules` should be done intentionally and followed by backend layout tests.

Update: VPC Flow Logs are modeled as VPC-owned infrastructure. The root flow-log resources were moved into `terraform/modules/vpc_flow_logs`, and `terraform/modules/private_workload_network` owns that module as `module.vpc_flow_logs`. This keeps `aws_flow_log`, its publishing IAM role/policy, and CloudWatch log group under the network module boundary for layout.

Update: Lambda deployment artifacts use `terraform-aws-modules/s3-bucket/aws` as `module.lambda_deployment_artifacts` instead of raw root `aws_s3_bucket` resources. Keep Lambda package references pointed at `module.lambda_deployment_artifacts.s3_bucket_id` / `s3_bucket_arn`.

## Layout Notes

Scene layout is not a single force graph:

- tiers size and weight resource cards
- registry modules are collapsed into one layout vertex per module
- top-level placement uses **ELK layered** by default (`elkLayout`); engine is selected per request via the GET `/terraform/upload/:id/excalidraw?layoutEngine=elk|force` query param (the React import dialog has a radio control), and `nodesToExcalidraw(nodes, { layoutEngine })` accepts the same option directly. Set `TF_LAYOUT_ENGINE=force` (env var) to flip the fallback default for callers that don't pass the option.
- both engines share the same `(nodeKeys, directedEdges, tierMap, tierConfigs, layoutSizes) -> { id: {x,y} }` contract, returning top-left positions
- ELK additionally accepts `options.nestingGroups` (a 6th argument). `nodesToExcalidraw` builds one compound per VPC (from `accountRegionGroups[*].regions[*].vpcs[*].nodePaths` mapped to layout ids) so VPC-bound modules are clustered inside the VPC frame and out-of-VPC modules (buckets, queues) are kept on the outside. Compound membership follows `buildNodeVpcMap` (including its BFS fallback for `aws_lambda_function` etc.)
- collapsed module positions are expanded into resource positions via `expandCollapsedModulePositions`
- Lambda/security-group module internals have presets
- VPC perimeter appliances are removed from the top-level layout and snapped to VPC frame walls afterward (`snapVpcPerimeterResourcePositions`)
- account/region/VPC/subnet boxes measure visual bounds and module boxes, not just raw node rectangles

Nested module behavior is covered by tests near the end of `excalidraw.test.js`.

## Test Command

Run backend tests from repo root:

```bash
yarn workspace @excalidraw/backend test
```

Last observed result on 2026-05-07 (with ELK as default layout engine): 4 test files, 48 tests passed. Node printed a `url.parse()` deprecation warning from dependencies.

## Maintenance Reminder

When changing backend architecture, pipeline order, fixture generation, layout semantics, edge semantics, or major tests:

- update this file
- update `TERRAFORM_BACKEND_ARCHITECTURE.md` if the public architecture changed
- update `README.md` if commands, endpoints, or fixture generation steps changed
- keep fixture-specific assumptions close to tests that depend on them

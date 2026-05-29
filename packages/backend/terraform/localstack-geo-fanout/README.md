# LocalStack geo fanout fixture

Minimal Terraform fixture for **tfdraw** pipeline layout testing: one consumer Lambda fans out to six regional API Gateway stacks across **two LocalStack accounts**, **multiple regions**, and **multiple VPCs**.

## Topology

| Stack | Account | LocalStack port | Region | VPC CIDR | Role |
| --- | --- | --- | --- | --- | --- |
| `00-consumer` | `111111111111` | 4566 | `us-east-1` | `10.0.0.0/16` | Fanout source |
| `10-a-api-1` | `111111111111` | 4566 | `us-east-1` | `10.1.0.0/16` | Fanout lane 0 |
| `11-a-api-2` | `111111111111` | 4566 | `us-west-2` | `10.2.0.0/16` | Fanout lane 1 |
| `12-a-api-3` | `111111111111` | 4566 | `us-west-2` | `10.3.0.0/16` | Fanout lane 2 |
| `20-b-api-4` | `222222222222` | 4567 | `eu-west-1` | `10.4.0.0/16` | Fanout lane 3 |
| `21-b-api-5` | `222222222222` | 4567 | `eu-central-1` | `10.5.0.0/16` | Fanout lane 4 |
| `22-b-api-6` | `222222222222` | 4567 | `eu-central-1` | `10.6.0.0/16` | Fanout lane 5 |

Declared dataflow: [`pipeline.tfd`](pipeline.tfd) (20 edges: consumer→6 APIs, 6 API→Lambda, 6 Lambda→SSM).

## Prerequisites

- Docker
- Terraform >= 1.5
- Optional: [`tflocal`](https://github.com/localstack/terraform-local) (recommended)

## Quick start

From repo root:

```bash
# Offline / CI: committed synthetic plan bundles (no Docker)
yarn localstack:geo-fanout:generate-bundles

# Real LocalStack apply + export (optional; replaces synthetic bundles)
yarn localstack:geo-fanout:up
yarn localstack:geo-fanout:apply
yarn localstack:geo-fanout:export

yarn seed:terraform-presets
yarn export:terraform-presets-test-db
```

Import preset **LocalStack geo fanout** in the app with **Pipeline** view, or run tests:

```bash
yarn vitest run packages/excalidraw/components/terraformPipelineGeoFanout.test.ts
```

## Scripts

| Command | Description |
| --- | --- |
| `yarn localstack:geo-fanout:up` | Start two LocalStack containers (accounts A/B) |
| `yarn localstack:geo-fanout:down` | Stop containers |
| `yarn localstack:geo-fanout:apply` | Apply all seven stacks in order |
| `yarn localstack:geo-fanout:export` | Export `plan.json` + `graph.dot` per stack, enrich geo metadata, copy to `packages/excalidraw/test-fixtures/localstack-geo-fanout/bundles/` |
| `yarn localstack:geo-fanout:generate-bundles` | Write synthetic offline plan/dot bundles for CI (no Docker) |

## Known limitations

- **Regional** API Gateway only (not private API + VPCE like staging-multi-state).
- LocalStack may not support every VPC Lambda / IAM edge case; see apply logs if a stack fails.
- Pipeline view groups fanout **lanes 0–2** under account `111111111111` and **lanes 3–5** under account `222222222222` as horizontal bands.

## Modules

- [`modules/mini_vpc`](modules/mini_vpc/) — VPC + private subnet + Lambda SG
- [`modules/mini_api_stack`](modules/mini_api_stack/) — VPC Lambda, REST API, SSM, permission
- [`modules/consumer_lambda`](modules/consumer_lambda/) — fanout source Lambda
- [`modules/localstack_provider`](modules/localstack_provider/) — reference provider endpoints block

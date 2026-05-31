# Production geo fanout

Production-ready Terraform multi-state architecture mirroring the **localstack-geo-fanout** topology: a consumer fans out to **six private API Gateway endpoints** across **two AWS accounts**, **four regional VPCs**, and **three geographic regions**.

Built from the same patterns as [`staging-multi-state`](../staging-multi-state/README.md).

## Topology

| Stack | Account | Region | VPC CIDR | Role |
| --- | --- | --- | --- | --- |
| `00-a-network-east` | A | `us-east-1` | `10.60.0.0/16` | Hub network + TGW + lambda artifacts |
| `01-a-network-west` | A | `us-west-2` | `10.61.0.0/16` | TGW peering to east |
| `02-b-network-eu-west` | B | `eu-west-1` | `10.70.0.0/16` | Account B hub + TGW |
| `03-b-network-eu-central` | B | `eu-central-1` | `10.71.0.0/16` | TGW peering to eu-west |
| `10-a-api-1` | A | `us-east-1` | — | Private API + Lambda + SSM |
| `11-a-api-2` | A | `us-west-2` | — | Private API + Lambda + SSM |
| `12-a-api-3` | A | `us-west-2` | — | Private API + Lambda + SSM |
| `20-b-api-4` | B | `eu-west-1` | — | Private API + cross-account invoke policy |
| `21-b-api-5` | B | `eu-central-1` | — | Private API + cross-account invoke policy |
| `22-b-api-6` | B | `eu-central-1` | — | Private API + cross-account invoke policy |
| `30-a-messaging` | A | `us-east-1` | — | KMS FIFO SQS + consumer Lambda fanout |

Declared dataflow: [`pipeline.tfd`](pipeline.tfd) — SQS → consumer → 6 APIs → 6 Lambdas → 6 SSM parameters.

## Production features (vs LocalStack fixture)

| Concern | LocalStack fixture | This variant |
| --- | --- | --- |
| Provider | Fake creds + localhost endpoints | AWS profile + `assume_role` deploy role |
| State | Local `terraform.tfstate` per stack | S3 backend + DynamoDB locking (configured per stack) |
| VPC | Single subnet, no NAT/endpoints | `private_workload_network` — multi-AZ, NAT, VPC endpoints, flow logs |
| API Gateway | Regional, public-style REST | **Private** APIs bound to `execute-api` VPC endpoints |
| Lambda packaging | Inline zip via `archive_file` | Versioned S3 artifact buckets per region |
| Lambda runtime | Hand-rolled IAM | `lambda_service` module (restricted SG egress, X-Ray, error alarms) |
| Messaging | None (topology-only consumer) | KMS-encrypted FIFO SQS + DLQ + event source mapping |
| Fanout invoke | Declared in pipeline only | SigV4-signed `execute-api:Invoke` from consumer to all six APIs |
| Cross-account | Fake account IDs | API resource policies + IAM on consumer for account B targets |
| Observability | Minimal | API access logs, X-Ray on stages, CloudWatch alarms on consumer errors + DLQ depth |
| Networking | Isolated mini VPCs | Transit Gateway peering within each account (east↔west, eu-west↔eu-central) |

## Prerequisites

- Terraform >= 1.5
- Two AWS accounts (A and B) with `TerraformDeploy` roles bootstrapped — see [`docs/AWS_ASSUME_ROLE_SETUP.md`](../docs/AWS_ASSUME_ROLE_SETUP.md)
- S3 bucket + DynamoDB table for remote state
- AWS CLI profiles (`admin`, `admin-account-b`) or equivalent SSO

## Quick start

```bash
cd packages/backend/terraform/production-geo-fanout

# 1. Configure remote state
cp backend.hcl.example backend.hcl
# Edit bucket, region, dynamodb_table

# 2. Configure variables
cp terraform.tfvars.example terraform.tfvars
# Set account A IDs and deploy role ARN

# Optional: account B variables file for stacks 02/03/20–22
cat > terraform.tfvars.account-b <<'EOF'
aws_profile               = "admin-account-b"
aws_account_id              = "222222222222"
terraform_deploy_role_arn   = "arn:aws:iam::222222222222:role/TerraformDeploy"
consumer_lambda_role_arn    = "arn:aws:iam::111111111111:role/production-geo-fanout-consumer"
EOF

# 3. Apply all stacks in dependency order
chmod +x scripts/apply-all.sh
./scripts/apply-all.sh
```

### Apply order

1. `00-a-network-east`
2. `01-a-network-west` (TGW peering to east)
3. `02-b-network-eu-west` (account B)
4. `03-b-network-eu-central` (TGW peering to eu-west)
5. `10-a-api-1`, `11-a-api-2`, `12-a-api-3`
6. `20-b-api-4`, `21-b-api-5`, `22-b-api-6` (set `consumer_lambda_role_arn` for cross-account invoke)
7. `30-a-messaging` (wires consumer to all six API invoke URLs)

### Per-stack init (manual)

```bash
cd stacks/00-a-network-east
terraform init \
  -backend-config=../../backend.hcl \
  -backend-config=key=production-geo-fanout/00-a-network-east/terraform.tfstate
terraform apply -var-file=../../terraform.tfvars
```

## Cross-stack wiring

Downstream stacks read upstream outputs via `terraform_remote_state` with **local paths by default** (same as staging-multi-state). When using S3 remote state for production applies, update `*_state_path` variables to point at the exported state files or switch remote state backends to S3 with consistent keys.

The consumer Lambda receives all six private API invoke URLs and regions via environment variables and calls them with **IAM SigV4 signing**. Security group egress is extended to peer regional VPC CIDRs so traffic can reach remote `execute-api` VPC endpoints over Transit Gateway routes.

## Optional ingress

Enable scheduled fanout by setting in `30-a-messaging`:

```hcl
enable_schedule     = true
schedule_expression = "rate(5 minutes)"
```

This enqueues messages to the FIFO queue via EventBridge (disabled by default).

## Modules

- [`modules/regional_network`](modules/regional_network/) — VPC, execute-api VPCE, TGW, encrypted lambda artifacts bucket, API Gateway account logging role
- [`modules/private_api_lambda`](modules/private_api_lambda/) — S3-packaged VPC Lambda, private REST API, SSM config, access logs, optional cross-account invoke policy

Shared repo modules: [`private_workload_network`](../modules/private_workload_network/), [`lambda_service`](../modules/lambda_service/), [`encrypted_sqs_queue`](../modules/encrypted_sqs_queue/).

## Known operational notes

- **Cross-account private API invoke** requires both IAM permissions (consumer role + API resource policy) and network connectivity. Account B APIs allow the account A consumer role via `cross_account_invoker_role_arns`. Full private connectivity across accounts may require RAM-shared VPC endpoints or TGW cross-account attachments — plan network paths before production cutover.
- **Two-phase account B API apply**: if the consumer role does not exist yet, set `consumer_lambda_role_arn` to the predictable ARN (`arn:aws:iam::<account-a>:role/<environment>-geo-fanout-consumer`) before applying account B APIs, then apply `30-a-messaging`.
- Re-apply account B API stacks after messaging if you skipped `consumer_lambda_role_arn` on the first pass.

## Comparison to localstack-geo-fanout

Same declared dataflow graph shape (consumer → 6 APIs → 6 Lambdas → 6 SSM) for tfdraw **Semantic** view + `.tfd` overlay testing. Use localstack for offline CI fixtures; use this variant for real AWS deployment templates.

## LocalStack export (plan.json + graph.dot + pipeline.tfd)

A LocalStack-compatible layer lives under [`localstack/`](localstack/). It mirrors the 11-stack topology with minimal modules (reusing `localstack-geo-fanout` mini VPC/API/consumer modules) and exports fixtures for the app import preset.

```bash
# Reuses LocalStack on 4566/4567 (same ports as localstack-geo-fanout)
yarn localstack:prod-geo-fanout:export

# Optional full apply (Lambda needs Docker available to LocalStack)
yarn localstack:prod-geo-fanout:apply

yarn seed:terraform-presets
```

Exported bundles: `packages/excalidraw/test-fixtures/production-geo-fanout/bundles/`  
Pipeline dataflow: `localstack/pipeline.tfd` (19 edges: SQS → consumer → 6 APIs → 6 Lambdas → 6 SSM).

Import preset **Production geo fanout** → **Semantic** view in the app (preset loads `pipeline.tfd` for declared dataflow edges).

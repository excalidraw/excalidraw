# staging-multi-state

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full topology, dataflow, and stack dependencies.

Terraform multi-state architecture for staging (11 private APIs, mixed compute + datastores):

1. `00-east-network` — VPC, execute-api VPCE, TGW, lambda artifacts
2. `01-west-network` — west VPC, TGW peering, execute-api VPCE
3. `02-east-datastores` — dedicated DynamoDB / RDS / Aurora / S3 per east API (+ cross-region stores for api-8/9)
4. `03-west-datastores` — west-side stores for api-8..11
5. `40-east-api-1` … `46-east-api-7` — east private APIs (Lambda + ECS Fargate/EC2)
6. `50-west-api-8` … `53-west-api-11` — west private APIs
7. `10-east-ecs-edge` — public ALB + ECS producer
8. `20-east-messaging` — FIFO SQS + consumer Lambda → APIs 1–5

Primary flow: ECS producer → FIFO SQS → consumer Lambda → APIs 1–5 → cascade 6–7 → 8–9 → 10–11.

Cross-region SQL (api-9 east RDS): TGW routes + RDS SG peer CIDR rules.

## Apply order

```bash
cd packages/backend/terraform/staging-multi-state
chmod +x scripts/apply-and-export-all.sh
TF_VAR_aws_account_id=992382747916 AWS_PROFILE=admin ./scripts/apply-and-export-all.sh
```

Or apply stacks individually in dependency order (see script).

Each stack exports `plan.json`, `graph.dot`, and keeps `terraform.tfstate` after apply.

**Teardown (zero cost):** `./scripts/destroy-all-stacks.sh` — parallel destroy in reverse dependency order. See [ARCHITECTURE.md](./ARCHITECTURE.md#teardown-zero-ongoing-cost).

Pipeline dataflow: `pipeline.tfd` (imported via terraform import presets).

All states default to AWS profile `admin` and support optional assume-role via `terraform_deploy_role_arn`.

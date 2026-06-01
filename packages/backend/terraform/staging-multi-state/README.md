# staging-multi-state

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full topology, dataflow, and stack dependencies.

Terraform multi-state architecture for staging (**16 private APIs**, **4 regions**, **25 stacks**):

**Foundation:** `00-east-network`, `01-west-network`, `04-west-1-network`, `05-east-2-network`, plus regional datastores `02`, `03`, `04-west-1-datastores`, `05-east-2-datastores`.

**Trunk (us-east-1):** `10-east-ecs-edge` (public ALB + producer ECS + egress ECS), `20-east-messaging` (ingress FIFO + egress SQS + consumer Lambda).

**API tiers:** `40–46` east hub, `50–53` west-2 lane, `54–55` west-1 mini-cascade (12→14), `56–57` east-2 mini-cascade (15→16).

**Primary flow:**

1. Internet → IGW → public ALB → producer ECS → **ingress FIFO**
2. Consumer Lambda → private APIs **1–5** (execute-api VPCE)
3. Consumer → **egress SQS** → egress ECS (private subnets) → NAT → internet
4. Cascade: **4→6**, **5→7**; **api-6 → api-8, api-12, api-15** (regional entries); **api-7 → api-9** (west-2 only); **8→10**, **9→11**, **12→14**, **15→16**

Each regional API uses its **own regional datastore** only (no cross-region S3/RDS for api-8/9).

**Naming contract:** `shared/contract/` + `shared/templates/invoke-url.tftpl` enable parallel apply waves without `terraform_remote_state` ordering for downstream API URLs.

## Apply order (parallel waves)

```bash
cd packages/backend/terraform/staging-multi-state
chmod +x scripts/apply-and-export-all.sh
TF_VAR_aws_account_id=992382747916 AWS_PROFILE=admin ./scripts/apply-and-export-all.sh
```

Waves: **1a** hub network → **1b** peer networks → **2** datastores → **3–6** APIs → **7** messaging → **8** ECS edge.

Each stack exports `plan.json`, `graph.dot`, and keeps `terraform.tfstate` after apply.

**Hydrate expanded preset only** (do not run full seed):

```bash
yarn hydrate:terraform-preset staging-multi-state-expanded
```

**Teardown:** `./scripts/destroy-all-stacks.sh` — parallel destroy in reverse dependency order (25 stacks). Exported artifacts remain on disk.

Pipeline dataflow: `pipeline.tfd`. Import preset: **`staging-multi-state-expanded`** (25 stacks).

All states default to AWS profile `admin` and support optional assume-role via `terraform_deploy_role_arn`.

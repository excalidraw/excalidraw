# AWS assume-role setup for Terraform (local + CI)

This guide describes how to run Terraform/OpenTofu against a **target AWS account** using **`assume_role`** on the AWS provider, instead of relying only on long-lived credentials scoped directly to that account.

Root Terraform for this repo lives in [`packages/backend/terraform/`](../).

---

## Concepts

| Piece | Role |
|--------|------|
| **Base credentials** | Who you are when Terraform starts: SSO session, `AWS_PROFILE`, env vars, etc. |
| **`assume_role` (provider)** | Terraform calls **STS AssumeRole** into a **role in the target account** and uses temporary credentials for all AWS API calls. |
| **Deploy role** | IAM role in the **workload** account; trust policy lists who may assume it; permission policy grants what Terraform needs. |

You usually **keep** a profile (or SSO) for the base identity and **add** `assume_role` so operations run as the deploy role.

---

## 1. IAM in the target account

### 1.1 Create a deploy role

Example role name: `TerraformDeploy`.

**Trust policy** (same-account admin user — replace ARNs):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::TARGET_ACCOUNT_ID:user/YOUR_USERNAME"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Cross-account** (identity lives in a tools account `TOOLS_ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::TOOLS_ACCOUNT_ID:role/TerraformOperator"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "OPTIONAL_SHARED_SECRET"
        }
      }
    }
  ]
}
```

Use **`sts:ExternalId`** when a third party or automation assumes the role; set the same value in Terraform `assume_role { external_id = "..." }`.

### 1.2 Permissions

Attach policies that match what this stack needs (Lambda, VPC, S3, SQS, KMS, IAM for Lambda roles, CloudWatch, etc.). Prefer least privilege over `AdministratorAccess`.

### 1.3 IAM Identity Center (SSO)

If users log in via SSO, the **trust Principal** is typically the **permission set role ARN** in the SSO account, or a dedicated **tools account role** that engineers assume first. Your org admin documents the exact ARN pattern.

---

## 2. Terraform provider configuration

This repo does not ship a committed `provider "aws"` block by default; resources use the **implicit default provider**. Add a root-level file (e.g. `providers.tf`) next to `main.tf`:

### 2.1 Single account — assume role, default credential chain

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  assume_role {
    role_arn     = "arn:aws:iam::TARGET_ACCOUNT_ID:role/TerraformDeploy"
    session_name = "terraform-local"
  }
}
```

Set **`AWS_PROFILE`** (or run `aws sso login`) so the base identity can call **`sts:AssumeRole`** on that ARN.

### 2.2 Single account — explicit profile as base identity

```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "my-sso-profile"

  assume_role {
    role_arn = "arn:aws:iam::TARGET_ACCOUNT_ID:role/TerraformDeploy"
  }
}
```

### 2.3 Multi-account — aliases

```hcl
provider "aws" {
  alias  = "network"
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::NETWORK_ACCOUNT_ID:role/TerraformDeploy"
  }
}

provider "aws" {
  alias  = "workloads"
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::WORKLOAD_ACCOUNT_ID:role/TerraformDeploy"
  }
}
```

Modules must opt in with **`providers = { aws = aws.workloads }`** (and modules must declare `configuration_aliases`). That is a structural change beyond `main.tf` / `artifacts.tf`.

---

## 3. Local development workflow

1. **AWS CLI v2** installed; **`terraform`** or **`tofu`** on `PATH`.
2. Configure base access:
   - **SSO:** `aws configure sso`, then `aws sso login --profile YOUR_PROFILE`.
   - **Static keys:** `aws configure --profile YOUR_PROFILE` (avoid for humans long-term if SSO is available).
3. **Test assume role** (optional):

   ```bash
   aws sts assume-role \
     --role-arn arn:aws:iam::TARGET_ACCOUNT_ID:role/TerraformDeploy \
     --role-session-name cli-test \
     --profile YOUR_PROFILE
   ```

   If this fails, fix trust/policy before Terraform.

4. **Run Terraform** from `packages/backend/terraform/`:

   ```bash
   export AWS_PROFILE=YOUR_PROFILE   # if not using profile inside provider block
   terraform init
   terraform plan -out=tfplan
   ```

5. Confirm identity inside the role (e.g. add a temporary `data "aws_caller_identity" "current" {}` and inspect outputs / console).

---

## 4. CI (outline)

- **OIDC** (GitHub/GitLab): workflow obtains short-lived AWS credentials, then assumes **`TerraformDeploy`** (no long-lived keys).
- Or **CI runner role** in a tools account listed in the deploy role trust policy.

---

## 5. Relation to `main.tf` and `artifacts.tf`

- **`main.tf`** and **`artifacts.tf`** declare resources only; they do **not** need edits solely for assume-role auth unless you introduce **provider aliases** and must pass **`providers`** into modules.
- Auth is configured at the **root provider** (new file or existing root config).

---

## 6. Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| `AccessDenied` on `AssumeRole` | Trust policy Principal wrong or missing `sts:AssumeRole` on base identity. |
| `AccessDenied` on `ec2:*` / `lambda:*` after assume | Deploy role permissions too narrow. |
| SSO token expired | Run `aws sso login` again. |
| Wrong account in plan | Wrong `role_arn` or wrong profile chaining multiple assumes. |

---

## References

- [AWS provider: assume_role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#assume-role-configuration-reference)
- [IAM roles concepts](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_terms-and-concepts.html)

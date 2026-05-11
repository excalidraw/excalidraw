# Addplan2 Graph Cleanup Recommendations

This note captures observations from rendering the current `terraform/addplan2.json` and `terraform/addplan2.dot` in the Excalidraw Terraform app.

## Current Symptoms

- The generated scene contains 704 Excalidraw elements.
- Only 245 elements are initially visible, but Excalidraw still receives all 704.
- The visible overview still has 50 rectangles and 18 arrows.
- Most visible arrows are Terraform dependency arrows, not architecture/data-flow edges.
- The scene draws both dashed module containers and separate synthetic Terraform module nodes.
- The two private subnet boxes overlap exactly, which makes the VPC area hard to read.
- KMS, security group, alarm, and module implementation details are rendered as standalone visual objects, causing the architecture view to sprawl.

## Recommendations

### 1. Remove Synthetic Terraform Module Nodes From Overview

The app currently draws both a module container and an inner Terraform module node, for example:

- `module lambda-writer`
- `lambda-writer` as a separate inner `terraform_module` node

The container already communicates module ownership. In overview mode, hide the inner `terraform_module` node and keep only the module container.

### 2. Hide Module-To-Child Dependency Arrows

Arrows such as these do not add architectural meaning:

- `module.data_queue -> module.data_queue.aws_sqs_queue.this`
- `module.lambda-writer -> module.lambda-writer.aws_lambda_function.this`

These edges only repeat containment that is already shown by the module box. Hide them by default and keep them available in an expanded/debug view.

### 3. Collapse Registry Module Internals More Aggressively

Registry modules should render as semantic units first:

- Lambda module: Lambda node plus SG/alarm/IAM/log/package badges.
- SQS module: queue + DLQ, or one queue module summary.
- S3 module: one bucket node with encryption/versioning/public-access facets.
- KMS module: compact key badge attached to the encrypted resource.
- Security group module: compact SG badge near the Lambda or VPC endpoint it protects.

Implementation resources such as IAM role policies, log groups, packaging `terraform_data`, and individual security group rules should stay hidden until expand.

### 4. Fix Overlapping Subnet Boxes

The two subnet boxes currently share the same coordinates and dimensions. If a Lambda is associated with both subnets, render either:

- one combined `private subnets x2` container, or
- two side-by-side subnet lanes with the Lambda module spanning both lanes.

Overlapping subnet boxes make the VPC container look broken.

### 5. Render KMS As An Annotation Or Badge

KMS modules are currently placed as standalone islands. For the overview, attach KMS to the resources they encrypt:

- S3 bucket: `encrypted: s3_kms`
- SQS queue/DLQ: `encrypted: sqs_kms`

A small key badge on the bucket or queue module is more useful than a distant KMS box.

### 6. Make Terraform Dependency Edges Opt-In

The default view should emphasize semantic/data-flow edges:

- Lambda writes S3.
- Lambda publishes to SQS.
- Lambda reads S3/SQS when the reader Lambda is enabled.
- Alarms observe Lambda/SQS/DLQ.

DOT dependency edges should be hidden by default behind a `Terraform dependencies` toggle.

### 7. Prefer Architecture Grouping Over Terraform Module Grouping

The first view should be organized by how the system runs, not by all Terraform implementation objects. A cleaner default shape would be:

```text
Account
  Region
    VPC
      Private subnets x2
        lambda-writer module
          Lambda
          SG badge
          Alarm badge
        lambda-reader module
          Lambda
          SG badge
          Alarm badge

    Messaging
      SQS queue + DLQ
      KMS badge
      Queue alarms

    Storage
      S3 bucket
      KMS badge
```

### 8. Rename Or Remove The Terraform Module Icon

The current synthetic module node uses a CloudFormation-looking icon/text, which reads wrong in a Terraform graph. If synthetic module nodes remain available in expanded mode, they should use a Terraform/module glyph or plain module styling.

## Highest-Impact Changes

The fastest path to a cleaner `addplan2` overview is:

1. Hide visible `terraform_module` nodes in overview mode.
2. Hide module-to-child dependency arrows in overview mode.
3. Merge overlapping subnet boxes into a single `private subnets x2` container.
4. Render KMS, alarms, and security groups as badges/facets attached to semantic modules.

These changes should cut the visible scene substantially while preserving the important architecture story.

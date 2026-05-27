# 00-east-network

Creates the us-east-1 network baseline:

- VPC with public/private/intra subnets
- VPC endpoints (including execute-api interface endpoint)
- Transit Gateway and east VPC attachment

Run `terraform init && terraform plan` from this directory first.

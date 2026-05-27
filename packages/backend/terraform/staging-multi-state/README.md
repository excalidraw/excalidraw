# staging-multi-state

Terraform multi-state architecture for staging:

1. `00-east-network`
2. `01-west-network`
3. `40-east-api-1` ... `44-east-api-5`
4. `10-east-ecs-edge`
5. `20-east-messaging`

Primary flow: ECS -> FIFO SQS -> consumer Lambda -> 5 private APIs -> API Lambdas + SSM.

All states default to AWS profile `admin` and support optional assume-role via `terraform_deploy_role_arn`.

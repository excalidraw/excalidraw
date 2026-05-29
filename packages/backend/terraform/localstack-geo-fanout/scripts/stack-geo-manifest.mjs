/** Per-stack account/region/VPC metadata for plan enrichment and synthetic bundles. */
export const STACKS = [
  {
    id: "00-consumer",
    account: "111111111111",
    region: "us-east-1",
    vpcId: "vpc-consumer",
    subnetId: "subnet-consumer",
    kind: "consumer",
  },
  {
    id: "10-a-api-1",
    account: "111111111111",
    region: "us-east-1",
    vpcId: "vpc-a1",
    subnetId: "subnet-a1",
    apiName: "api-1",
  },
  {
    id: "11-a-api-2",
    account: "111111111111",
    region: "us-west-2",
    vpcId: "vpc-b1",
    subnetId: "subnet-b1",
    apiName: "api-2",
  },
  {
    id: "12-a-api-3",
    account: "111111111111",
    region: "us-west-2",
    vpcId: "vpc-b2",
    subnetId: "subnet-b2",
    apiName: "api-3",
  },
  {
    id: "20-b-api-4",
    account: "222222222222",
    region: "eu-west-1",
    vpcId: "vpc-c1",
    subnetId: "subnet-c1",
    apiName: "api-4",
  },
  {
    id: "21-b-api-5",
    account: "222222222222",
    region: "eu-central-1",
    vpcId: "vpc-d1",
    subnetId: "subnet-d1",
    apiName: "api-5",
  },
  {
    id: "22-b-api-6",
    account: "222222222222",
    region: "eu-central-1",
    vpcId: "vpc-d2",
    subnetId: "subnet-d2",
    apiName: "api-6",
  },
];

export const STACK_BY_ID = new Map(STACKS.map((stack) => [stack.id, stack]));

export function arn(service, region, account, resource) {
  return `arn:aws:${service}:${region}:${account}:${resource}`;
}

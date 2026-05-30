/** Per-stack account/region/VPC metadata for production-geo-fanout LocalStack export. */
export const STACKS = [
  {
    id: "00-a-network-east",
    account: "111111111111",
    region: "us-east-1",
    vpcId: "vpc-a-east",
    subnetId: "subnet-a-east",
    kind: "network",
    name: "prod-a-east",
  },
  {
    id: "01-a-network-west",
    account: "111111111111",
    region: "us-west-2",
    vpcId: "vpc-a-west",
    subnetId: "subnet-a-west",
    kind: "network",
    name: "prod-a-west",
  },
  {
    id: "02-b-network-eu-west",
    account: "222222222222",
    region: "eu-west-1",
    vpcId: "vpc-b-eu-west",
    subnetId: "subnet-b-eu-west",
    kind: "network",
    name: "prod-b-eu-west",
  },
  {
    id: "03-b-network-eu-central",
    account: "222222222222",
    region: "eu-central-1",
    vpcId: "vpc-b-eu-central",
    subnetId: "subnet-b-eu-central",
    kind: "network",
    name: "prod-b-eu-central",
  },
  {
    id: "10-a-api-1",
    account: "111111111111",
    region: "us-east-1",
    vpcId: "vpc-api-1",
    subnetId: "subnet-api-1",
    apiName: "api-1",
  },
  {
    id: "11-a-api-2",
    account: "111111111111",
    region: "us-west-2",
    vpcId: "vpc-api-2",
    subnetId: "subnet-api-2",
    apiName: "api-2",
  },
  {
    id: "12-a-api-3",
    account: "111111111111",
    region: "us-west-2",
    vpcId: "vpc-api-3",
    subnetId: "subnet-api-3",
    apiName: "api-3",
  },
  {
    id: "20-b-api-4",
    account: "222222222222",
    region: "eu-west-1",
    vpcId: "vpc-api-4",
    subnetId: "subnet-api-4",
    apiName: "api-4",
  },
  {
    id: "21-b-api-5",
    account: "222222222222",
    region: "eu-central-1",
    vpcId: "vpc-api-5",
    subnetId: "subnet-api-5",
    apiName: "api-5",
  },
  {
    id: "22-b-api-6",
    account: "222222222222",
    region: "eu-central-1",
    vpcId: "vpc-api-6",
    subnetId: "subnet-api-6",
    apiName: "api-6",
  },
  {
    id: "30-a-messaging",
    account: "111111111111",
    region: "us-east-1",
    vpcId: "vpc-messaging",
    subnetId: "subnet-messaging",
    kind: "messaging",
  },
];

export const STACK_BY_ID = new Map(STACKS.map((stack) => [stack.id, stack]));

export function arn(service, region, account, resource) {
  return `arn:aws:${service}:${region}:${account}:${resource}`;
}

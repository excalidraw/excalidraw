export type HeroSceneNode = {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  satellite?: boolean;
};

export type HeroSceneEdge = {
  id: string;
  from: string;
  to: string;
  path: string;
};

export type HeroSceneFrame = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const HERO_SCENE_VIEWBOX = { width: 440, height: 320 } as const;

export const HERO_SCENE_META = {
  account: "012345678901",
  region: "us-east-1",
  vpc: "ts-staging-vpc",
} as const;

export const HERO_SCENE_FRAMES: HeroSceneFrame[] = [
  { id: "public", label: "public", x: 12, y: 36, width: 198, height: 88 },
  { id: "private", label: "private", x: 12, y: 136, width: 198, height: 100 },
];

export const HERO_SCENE_NODES: HeroSceneNode[] = [
  {
    id: "alb",
    label: "aws_lb.ecs",
    shortLabel: "aws_lb",
    x: 24,
    y: 58,
    width: 72,
    height: 34,
  },
  {
    id: "ecs",
    label: "aws_ecs_service.producer",
    shortLabel: "aws_ecs_service",
    x: 118,
    y: 58,
    width: 82,
    height: 34,
  },
  {
    id: "sqs",
    label: "module.queue.aws_sqs_queue",
    shortLabel: "aws_sqs_queue",
    x: 28,
    y: 168,
    width: 78,
    height: 34,
  },
  {
    id: "lambda",
    label: "module.consumer_lambda.aws_lambda_function",
    shortLabel: "aws_lambda_function",
    x: 124,
    y: 164,
    width: 78,
    height: 38,
    selected: true,
  },
  {
    id: "s3",
    label: "aws_s3_bucket.data",
    shortLabel: "aws_s3_bucket",
    x: 268,
    y: 72,
    width: 72,
    height: 34,
    satellite: true,
  },
  {
    id: "kms",
    label: "aws_kms_key.app",
    shortLabel: "aws_kms_key",
    x: 268,
    y: 188,
    width: 72,
    height: 34,
    satellite: true,
  },
];

const nodeCenter = (node: HeroSceneNode) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const edgePath = (
  from: HeroSceneNode,
  to: HeroSceneNode,
  bend = 0.35,
): string => {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const cx1 = a.x + dx * bend;
  const cx2 = b.x - dx * bend;
  return `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
};

const nodeById = Object.fromEntries(
  HERO_SCENE_NODES.map((node) => [node.id, node]),
) as Record<string, HeroSceneNode>;

export const HERO_SCENE_EDGES: HeroSceneEdge[] = [
  {
    id: "alb-ecs",
    from: "alb",
    to: "ecs",
    path: edgePath(nodeById.alb, nodeById.ecs, 0.5),
  },
  {
    id: "ecs-sqs",
    from: "ecs",
    to: "sqs",
    path: edgePath(nodeById.ecs, nodeById.sqs, 0.45),
  },
  {
    id: "sqs-lambda",
    from: "sqs",
    to: "lambda",
    path: edgePath(nodeById.sqs, nodeById.lambda, 0.5),
  },
  {
    id: "lambda-s3",
    from: "lambda",
    to: "s3",
    path: edgePath(nodeById.lambda, nodeById.s3, 0.55),
  },
  {
    id: "lambda-kms",
    from: "lambda",
    to: "kms",
    path: edgePath(nodeById.lambda, nodeById.kms, 0.55),
  },
];

export const HERO_INSPECTOR = {
  resourceType: "aws_lambda_function",
  action: "update",
  changedCount: 1,
  shownCount: 29,
  nodePath: "module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
  attribute: "environment",
  before: '{ "DATA_BUCKET": "app-data" }',
  after: '{ "DATA_BUCKET": "app-data", "queue_url": "..." }',
} as const;

import { TERRAFORM_ACTION_PASTEL_STYLES } from "@excalidraw/excalidraw/components/terraformPastelColors";

export type HeroChangeState = "existing" | "create" | "delete" | "update";

export type HeroSceneNode = {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  changeState: HeroChangeState;
  selected?: boolean;
  satellite?: boolean;
  attachTo?: string;
};

export type HeroSceneEdge = {
  id: string;
  from: string;
  to: string;
  path: string;
  changeState: HeroChangeState;
};

export type HeroSceneFrame = {
  id: string;
  level: "account" | "region" | "vpc" | "subnet";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HeroSceneSatelliteLink = {
  id: string;
  from: string;
  to: string;
  path: string;
};

export type HeroChangeStyle = {
  fill: string;
  stroke: string;
};

const heroStyle = (action: keyof typeof TERRAFORM_ACTION_PASTEL_STYLES) => {
  const { backgroundColor, strokeColor } = TERRAFORM_ACTION_PASTEL_STYLES[action];
  return { fill: backgroundColor, stroke: strokeColor };
};

/** Matches product TERRAFORM_ACTION_STYLES in terraformElkLayout.ts */
export const HERO_CHANGE_STYLES: Record<HeroChangeState, HeroChangeStyle> = {
  existing: heroStyle("existing"),
  create: heroStyle("create"),
  delete: heroStyle("delete"),
  update: heroStyle("update"),
};

export const HERO_EDGE_STROKE: Record<HeroChangeState, string> = {
  existing: HERO_CHANGE_STYLES.existing.stroke,
  create: HERO_CHANGE_STYLES.create.stroke,
  delete: HERO_CHANGE_STYLES.delete.stroke,
  update: HERO_CHANGE_STYLES.update.stroke,
};

export const HERO_SCENE_VIEWBOX = { width: 520, height: 380 } as const;

export const HERO_SCENE_META = {
  account: "012345678901",
  region: "us-east-1",
  vpc: "ts-staging-vpc",
} as const;

/** Outer → inner render order */
export const HERO_SCENE_FRAMES: HeroSceneFrame[] = [
  {
    id: "account",
    level: "account",
    label: HERO_SCENE_META.account,
    x: 10,
    y: 10,
    width: 500,
    height: 360,
  },
  {
    id: "region",
    level: "region",
    label: HERO_SCENE_META.region,
    x: 22,
    y: 26,
    width: 476,
    height: 332,
  },
  {
    id: "vpc",
    level: "vpc",
    label: HERO_SCENE_META.vpc,
    x: 34,
    y: 46,
    width: 452,
    height: 300,
  },
  {
    id: "public",
    level: "subnet",
    label: "public",
    x: 44,
    y: 62,
    width: 220,
    height: 118,
  },
  {
    id: "private",
    level: "subnet",
    label: "private",
    x: 44,
    y: 192,
    width: 220,
    height: 118,
  },
];

export const HERO_SCENE_NODES: HeroSceneNode[] = [
  {
    id: "alb",
    label: "aws_lb.ecs",
    shortLabel: "aws_lb",
    x: 54,
    y: 78,
    width: 70,
    height: 32,
    changeState: "existing",
  },
  {
    id: "ecs",
    label: "aws_ecs_service.producer",
    shortLabel: "aws_ecs_service",
    x: 136,
    y: 78,
    width: 78,
    height: 32,
    changeState: "update",
  },
  {
    id: "del-tg",
    label: "aws_lb_target_group.legacy",
    shortLabel: "aws_lb_target_group",
    x: 54,
    y: 118,
    width: 62,
    height: 26,
    changeState: "delete",
  },
  {
    id: "ecs-iam",
    label: "aws_iam_role.ecs_task",
    shortLabel: "aws_iam_role",
    x: 136,
    y: 118,
    width: 56,
    height: 24,
    changeState: "existing",
    satellite: true,
    attachTo: "ecs",
  },
  {
    id: "ecs-sg",
    label: "aws_security_group.ecs",
    shortLabel: "aws_security_group",
    x: 198,
    y: 118,
    width: 56,
    height: 24,
    changeState: "existing",
    satellite: true,
    attachTo: "ecs",
  },
  {
    id: "sqs",
    label: "module.queue.aws_sqs_queue",
    shortLabel: "aws_sqs_queue",
    x: 54,
    y: 208,
    width: 74,
    height: 32,
    changeState: "existing",
  },
  {
    id: "lambda",
    label: "module.consumer_lambda.aws_lambda_function",
    shortLabel: "aws_lambda_function",
    x: 140,
    y: 208,
    width: 78,
    height: 32,
    changeState: "update",
    selected: true,
  },
  {
    id: "lambda-iam",
    label: "aws_iam_role.lambda_exec",
    shortLabel: "aws_iam_role",
    x: 140,
    y: 248,
    width: 56,
    height: 24,
    changeState: "create",
    satellite: true,
    attachTo: "lambda",
  },
  {
    id: "lambda-sg",
    label: "aws_security_group.lambda",
    shortLabel: "aws_security_group",
    x: 202,
    y: 248,
    width: 56,
    height: 24,
    changeState: "existing",
    satellite: true,
    attachTo: "lambda",
  },
  {
    id: "s3",
    label: "aws_s3_bucket.data",
    shortLabel: "aws_s3_bucket",
    x: 296,
    y: 88,
    width: 70,
    height: 32,
    changeState: "create",
    satellite: true,
  },
  {
    id: "kms",
    label: "aws_kms_key.app",
    shortLabel: "aws_kms_key",
    x: 296,
    y: 198,
    width: 70,
    height: 32,
    changeState: "existing",
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

const straightLink = (from: HeroSceneNode, to: HeroSceneNode): string => {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
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
    changeState: "existing",
  },
  {
    id: "alb-del-tg",
    from: "alb",
    to: "del-tg",
    path: edgePath(nodeById.alb, nodeById["del-tg"], 0.35),
    changeState: "delete",
  },
  {
    id: "ecs-sqs",
    from: "ecs",
    to: "sqs",
    path: edgePath(nodeById.ecs, nodeById.sqs, 0.45),
    changeState: "update",
  },
  {
    id: "sqs-lambda",
    from: "sqs",
    to: "lambda",
    path: edgePath(nodeById.sqs, nodeById.lambda, 0.5),
    changeState: "existing",
  },
  {
    id: "lambda-s3",
    from: "lambda",
    to: "s3",
    path: edgePath(nodeById.lambda, nodeById.s3, 0.55),
    changeState: "create",
  },
  {
    id: "lambda-kms",
    from: "lambda",
    to: "kms",
    path: edgePath(nodeById.lambda, nodeById.kms, 0.55),
    changeState: "existing",
  },
];

export const HERO_SCENE_SATELLITE_LINKS: HeroSceneSatelliteLink[] = [
  {
    id: "ecs-ecs-iam",
    from: "ecs",
    to: "ecs-iam",
    path: straightLink(nodeById.ecs, nodeById["ecs-iam"]),
  },
  {
    id: "ecs-ecs-sg",
    from: "ecs",
    to: "ecs-sg",
    path: straightLink(nodeById.ecs, nodeById["ecs-sg"]),
  },
  {
    id: "lambda-lambda-iam",
    from: "lambda",
    to: "lambda-iam",
    path: straightLink(nodeById.lambda, nodeById["lambda-iam"]),
  },
  {
    id: "lambda-lambda-sg",
    from: "lambda",
    to: "lambda-sg",
    path: straightLink(nodeById.lambda, nodeById["lambda-sg"]),
  },
];

export const HERO_INSPECTOR = {
  resourceType: "aws_lambda_function",
  action: "update",
  changedCount: 3,
  shownCount: 32,
  nodePath: "module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
  attribute: "environment",
  before: '{ "DATA_BUCKET": "app-data" }',
  after: '{ "DATA_BUCKET": "app-data", "queue_url": "..." }',
} as const;

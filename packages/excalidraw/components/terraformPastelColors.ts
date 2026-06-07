import { COLOR_PALETTE } from "@excalidraw/common";

type PaletteFamily = keyof typeof COLOR_PALETTE;
type PaletteShadeIndex = 0 | 1 | 2 | 3 | 4;

export type TerraformPastelPair = {
  backgroundColor: string;
  strokeColor: string;
};

/** Open Color weight-50 fill + weight-400 stroke (pastel frame/card pair). */
export const terraformPastelPair = (
  family: PaletteFamily,
  strokeIndex: PaletteShadeIndex = 2,
  fillIndex: PaletteShadeIndex = 0,
): TerraformPastelPair => ({
  backgroundColor: COLOR_PALETTE[family][fillIndex],
  strokeColor: COLOR_PALETTE[family][strokeIndex],
});

/** Primary cluster frame colors keyed by AWS resource category. */
export const TERRAFORM_CLUSTER_FRAME_COLORS = {
  compute: terraformPastelPair("orange"),
  data: terraformPastelPair("teal"),
  messaging: terraformPastelPair("pink"),
  networking: terraformPastelPair("blue"),
  security: terraformPastelPair("yellow"),
  management: terraformPastelPair("violet"),
  default: terraformPastelPair("gray"),
} as const;

/** Context hierarchy frame colors (provider → account → region → VPC → subnet). */
export const TERRAFORM_CONTEXT_FRAME_COLORS = {
  provider: terraformPastelPair("gray"),
  account: terraformPastelPair("grape"),
  region: terraformPastelPair("cyan"),
  vpc: terraformPastelPair("blue", 1),
  subnetPublic: terraformPastelPair("green"),
  subnetPrivate: terraformPastelPair("violet", 1),
  subnetIntra: terraformPastelPair("pink"),
  subnetDefault: terraformPastelPair("gray"),
} as const;

/** Plan change action colors shown on resource cards (and in action-mode legend). */
export const TERRAFORM_ACTION_PASTEL_STYLES: Record<
  string,
  TerraformPastelPair
> = {
  create: terraformPastelPair("green"),
  delete: terraformPastelPair("red"),
  update: terraformPastelPair("yellow"),
  replace: terraformPastelPair("orange"),
  "no-op": terraformPastelPair("blue"),
  existing: terraformPastelPair("gray", 3),
  read: terraformPastelPair("gray", 3),
  external: terraformPastelPair("gray", 3),
};

/** Terraform dependency edge strokes (aligned with plan-action pastel hues). */
export const TERRAFORM_DEPENDENCY_EDGE_COLORS = {
  newOnly: COLOR_PALETTE.green[2],
  existingOnly: COLOR_PALETTE.blue[2],
  delete: COLOR_PALETTE.red[2],
  replace: COLOR_PALETTE.orange[2],
} as const;

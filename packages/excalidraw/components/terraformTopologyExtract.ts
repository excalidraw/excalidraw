/**
 * Derive AWS account / region / VPC / subnet topology from `terraform show -json` plan shape
 * (`resource_changes`) for semantic (topology) layout.
 */

export const TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT = "unknown-account";
export const TERRAFORM_TOPOLOGY_UNKNOWN_REGION = "unknown-region";

/** Subset of `terraform show -json` used to read default `aws` provider region / account. */
export type TerraformPlanProviderContext = {
  configuration?: {
    provider_config?: Record<
      string,
      {
        name?: string;
        expressions?: Record<string, unknown>;
      }
    >;
  };
  variables?: Record<string, { value?: unknown }>;
};

export type TerraformProviderAccountRegionHint = {
  account: string | null;
  region: string | null;
};

export type TerraformTopologySubnet = {
  /** Terraform subnet id, e.g. subnet-0abc */
  subnetId: string;
};

export type TerraformTopologyVpc = {
  vpcId: string;
  subnets: Map<string, TerraformTopologySubnet>;
};

export type TerraformTopologyRegion = {
  region: string;
  vpcs: Map<string, TerraformTopologyVpc>;
};

export type TerraformTopologyAccount = {
  accountId: string;
  regions: Map<string, TerraformTopologyRegion>;
};

export type TerraformTopologyModel = {
  accounts: Map<string, TerraformTopologyAccount>;
  /** True when at least one `resource_changes` entry looks like an AWS resource. */
  sawAwsResourceChanges: boolean;
};

type ResourceChange = {
  address?: string;
  mode?: string;
  type?: string;
  provider_name?: string;
  change?: {
    actions?: string[];
    before?: unknown;
    after?: unknown;
  };
};

function isAwsResourceChange(rc: ResourceChange): boolean {
  const t = rc.type;
  if (typeof t === "string" && t.startsWith("aws_")) {
    return true;
  }
  const p = rc.provider_name;
  return typeof p === "string" && p.includes("hashicorp/aws");
}

function isPlainValuesObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function isEmptyPlainObject(rec: Record<string, unknown>): boolean {
  return Object.keys(rec).length === 0;
}

/** Prefer `after`, then `before`, for merged attribute object. */
export function pickResourceChangeValues(
  rc: ResourceChange,
): Record<string, unknown> | null {
  const change = rc.change;
  if (!change || typeof change !== "object") {
    return null;
  }
  const after = change.after;
  if (after && typeof after === "object" && !Array.isArray(after)) {
    return after as Record<string, unknown>;
  }
  const before = change.before;
  if (before && typeof before === "object" && !Array.isArray(before)) {
    return before as Record<string, unknown>;
  }
  return null;
}

/**
 * Attribute snapshot for VPC/regional topology placement. Prefer `before` on destroy and when
 * `after` is `{}` so subnet / VPC hints are not lost.
 */
export function pickResourceValuesForTopologyPlacement(
  rc: ResourceChange,
): Record<string, unknown> | null {
  const change = rc.change;
  if (!change || typeof change !== "object") {
    return null;
  }
  const actions = Array.isArray(change.actions) ? change.actions : [];
  const beforeRaw = change.before;
  const afterRaw = change.after;
  const before = isPlainValuesObject(beforeRaw) ? beforeRaw : null;
  const after = isPlainValuesObject(afterRaw) ? afterRaw : null;

  if (actions.includes("delete") && before) {
    if (after && !isEmptyPlainObject(after)) {
      return { ...before, ...after };
    }
    return before;
  }

  if (after && isEmptyPlainObject(after) && before) {
    return before;
  }

  return pickResourceChangeValues(rc);
}

/**
 * Parse `arn:aws:service:region:account:…` — region may be empty for global IAM-style ARNs;
 * account should be 12 digits when present.
 */
export function parseAwsArnLocation(arn: string): {
  region: string;
  account: string;
} | null {
  if (!arn || typeof arn !== "string" || !arn.startsWith("arn:aws:")) {
    return null;
  }
  const parts = arn.split(":");
  if (parts.length < 6) {
    return null;
  }
  const region = parts[3] ?? "";
  const account = parts[4] ?? "";
  if (!/^\d{12}$/.test(account)) {
    return null;
  }
  return { region, account };
}

/** Collect every `arn:aws:` string under `values` (DFS). Order is not guaranteed. */
function collectAwsArnsInValues(values: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack: unknown[] = [values];
  while (stack.length) {
    const cur = stack.pop();
    if (typeof cur === "string" && cur.startsWith("arn:aws:")) {
      if (!seen.has(cur)) {
        seen.add(cur);
        out.push(cur);
      }
      continue;
    }
    if (Array.isArray(cur)) {
      for (const item of cur) {
        stack.push(item);
      }
    } else if (cur && typeof cur === "object") {
      for (const v of Object.values(cur)) {
        stack.push(v);
      }
    }
  }
  return out;
}

/** Prefer top-level `arn`, then first ARN that parses to a 12-digit account (skips e.g. `arn:aws:s3:::bucket`). */
function bestAwsArnLocationFromValues(
  values: Record<string, unknown>,
): { region: string; account: string } | null {
  const topArn = stringField(values.arn);
  if (topArn) {
    const loc = parseAwsArnLocation(topArn);
    if (loc) {
      return loc;
    }
  }
  for (const arn of collectAwsArnsInValues(values)) {
    const loc = parseAwsArnLocation(arn);
    if (loc) {
      return loc;
    }
  }
  return null;
}

function stringField(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function stringArrayField(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function vpcConfigBlocks(values: Record<string, unknown>): Record<string, unknown>[] {
  const raw = values.vpc_config;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const first = raw[0];
  return first && typeof first === "object" && !Array.isArray(first)
    ? [first as Record<string, unknown>]
    : [];
}

function ensureAccount(model: TerraformTopologyModel, accountId: string): TerraformTopologyAccount {
  let acc = model.accounts.get(accountId);
  if (!acc) {
    acc = { accountId, regions: new Map() };
    model.accounts.set(accountId, acc);
  }
  return acc;
}

function ensureRegion(
  account: TerraformTopologyAccount,
  region: string,
): TerraformTopologyRegion {
  let reg = account.regions.get(region);
  if (!reg) {
    reg = { region, vpcs: new Map() };
    account.regions.set(region, reg);
  }
  return reg;
}

function ensureVpc(region: TerraformTopologyRegion, vpcId: string): TerraformTopologyVpc {
  let vpc = region.vpcs.get(vpcId);
  if (!vpc) {
    vpc = { vpcId, subnets: new Map() };
    region.vpcs.set(vpcId, vpc);
  }
  return vpc;
}

function ensureSubnet(vpc: TerraformTopologyVpc, subnetId: string): void {
  if (!vpc.subnets.has(subnetId)) {
    vpc.subnets.set(subnetId, { subnetId });
  }
}

function resolveAccountRegion(
  values: Record<string, unknown>,
): { account: string; region: string } {
  const loc = bestAwsArnLocationFromValues(values);
  if (loc) {
    const region =
      loc.region ||
      stringField(values.region) ||
      TERRAFORM_TOPOLOGY_UNKNOWN_REGION;
    return { account: loc.account, region };
  }
  const owner = stringField(values.owner_id);
  if (owner && /^\d{12}$/.test(owner)) {
    const region =
      stringField(values.region) || TERRAFORM_TOPOLOGY_UNKNOWN_REGION;
    return { account: owner, region };
  }
  const region = stringField(values.region) || TERRAFORM_TOPOLOGY_UNKNOWN_REGION;
  return { account: TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT, region };
}

function planVariableTrimmed(
  plan: TerraformPlanProviderContext | undefined,
  key: string,
): string | null {
  const raw = plan?.variables?.[key]?.value;
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  return t.length ? t : null;
}

/**
 * Resolves `local.terraform_deploy_role_arn` when the plan only has root variable values
 * (same idea as root Terraform `coalesce(var.terraform_deploy_role_arn, …)`).
 */
export function resolveTerraformDeployRoleIamArnFromPlan(
  plan: TerraformPlanProviderContext | undefined,
): string | null {
  const direct = planVariableTrimmed(plan, "terraform_deploy_role_arn");
  if (direct) {
    return direct;
  }
  const accountId = planVariableTrimmed(plan, "aws_account_id");
  if (!accountId || !/^\d{12}$/.test(accountId)) {
    return null;
  }
  const roleName =
    planVariableTrimmed(plan, "terraform_deploy_role_name") ?? "TerraformDeploy";
  return `arn:aws:iam::${accountId}:role/${roleName}`;
}

function resolveProviderRegionFromExpressions(
  plan: TerraformPlanProviderContext | undefined,
  regionExpr: unknown,
): string | null {
  if (!regionExpr || typeof regionExpr !== "object" || Array.isArray(regionExpr)) {
    return null;
  }
  const rec = regionExpr as Record<string, unknown>;
  const constant = rec.constant_value;
  if (typeof constant === "string" && constant.trim()) {
    return constant.trim();
  }
  const refs = Array.isArray(rec.references) ? rec.references : [];
  if (refs.includes("var.aws_region")) {
    return planVariableTrimmed(plan, "aws_region");
  }
  return null;
}

function resolveProviderAssumeRoleAccount(
  plan: TerraformPlanProviderContext | undefined,
  assumeRoleExpr: unknown,
): string | null {
  if (!Array.isArray(assumeRoleExpr) || assumeRoleExpr.length === 0) {
    return null;
  }
  const block = assumeRoleExpr[0];
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return null;
  }
  const roleArnRaw = (block as Record<string, unknown>).role_arn;
  if (!roleArnRaw || typeof roleArnRaw !== "object" || Array.isArray(roleArnRaw)) {
    return null;
  }
  const arnExpr = roleArnRaw as Record<string, unknown>;
  const constantArn = arnExpr.constant_value;
  if (typeof constantArn === "string" && constantArn.startsWith("arn:aws:iam::")) {
    const loc = parseAwsArnLocation(constantArn);
    return loc?.account && /^\d{12}$/.test(loc.account) ? loc.account : null;
  }
  const refs = Array.isArray(arnExpr.references) ? arnExpr.references : [];
  if (refs.includes("local.terraform_deploy_role_arn")) {
    const arn = resolveTerraformDeployRoleIamArnFromPlan(plan);
    if (!arn) {
      return null;
    }
    const loc = parseAwsArnLocation(arn);
    return loc?.account && /^\d{12}$/.test(loc.account) ? loc.account : null;
  }
  return null;
}

/**
 * Default (non-aliased) `aws` provider account/region from `configuration.provider_config.aws`
 * and root `variables` (for `var.aws_region` and assume-role IAM ARN resolution).
 */
export function extractDefaultAwsProviderAccountRegion(
  plan: TerraformPlanProviderContext | undefined,
): TerraformProviderAccountRegionHint | null {
  const pc = plan?.configuration?.provider_config?.aws;
  if (!pc || typeof pc !== "object") {
    return null;
  }
  const expressions = (pc as { expressions?: Record<string, unknown> }).expressions;
  if (!expressions || typeof expressions !== "object") {
    return { account: null, region: null };
  }
  return {
    account: resolveProviderAssumeRoleAccount(plan, expressions.assume_role),
    region: resolveProviderRegionFromExpressions(plan, expressions.region),
  };
}

/** Fill unknown-account / unknown-region from default `aws` provider (plan JSON only). */
export function mergeWithDefaultAwsProviderAccountRegion(
  plan: TerraformPlanProviderContext | undefined,
  merged: { account: string; region: string },
): { account: string; region: string } {
  const hint = extractDefaultAwsProviderAccountRegion(plan);
  if (!hint) {
    return merged;
  }
  let account = merged.account;
  let region = merged.region;
  if (account === TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT && hint.account) {
    account = hint.account;
  }
  if (region === TERRAFORM_TOPOLOGY_UNKNOWN_REGION && hint.region) {
    region = hint.region;
  }
  return { account, region };
}

function resolveAccountRegionWithProviderDefaults(
  plan: TerraformPlanProviderContext | undefined,
  values: Record<string, unknown>,
): { account: string; region: string } {
  return mergeWithDefaultAwsProviderAccountRegion(plan, resolveAccountRegion(values));
}

export type TerraformSubnetOwnerHint = { account: string; region: string };

type SubnetOwnerHint = TerraformSubnetOwnerHint;

/** Emit frames only when account and region are resolved (omit placeholder buckets). */
export function shouldEmitTopologyPlacement(account: string, region: string): boolean {
  return (
    account !== TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT &&
    region !== TERRAFORM_TOPOLOGY_UNKNOWN_REGION
  );
}

/** Built from `aws_subnet` rows so association/route resources can inherit account/region. */
function buildSubnetOwnerHintMap(changes: ResourceChange[]): Map<string, SubnetOwnerHint> {
  const map = new Map<string, SubnetOwnerHint>();
  for (const rc of changes) {
    if (!isAwsResourceChange(rc) || rc.type !== "aws_subnet") {
      continue;
    }
    const values = pickResourceChangeValues(rc);
    if (!values) {
      continue;
    }
    const sid = stringField(values.id);
    if (!sid) {
      continue;
    }
    const { account, region } = resolveAccountRegion(values);
    if (!shouldEmitTopologyPlacement(account, region)) {
      continue;
    }
    map.set(sid, { account, region });
  }
  return map;
}

function mergeAccountRegionFromSubnets(
  base: { account: string; region: string },
  subnetIds: string[],
  subnetOwners: Map<string, SubnetOwnerHint>,
): { account: string; region: string } {
  if (
    base.account !== TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT ||
    subnetIds.length === 0
  ) {
    return base;
  }
  for (const sid of subnetIds) {
    const hint = subnetOwners.get(sid);
    if (
      hint &&
      hint.account &&
      hint.account !== TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT
    ) {
      return {
        account: hint.account,
        region:
          base.region !== TERRAFORM_TOPOLOGY_UNKNOWN_REGION
            ? base.region
            : hint.region,
      };
    }
  }
  return base;
}

function buildSubnetToVpcMap(changes: ResourceChange[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rc of changes) {
    if (!isAwsResourceChange(rc) || rc.type !== "aws_subnet") {
      continue;
    }
    const values = pickResourceChangeValues(rc);
    if (!values) {
      continue;
    }
    const sid = stringField(values.id);
    const vid = stringField(values.vpc_id);
    if (sid && vid) {
      map.set(sid, vid);
    }
  }
  return map;
}

/** Shared with placement extraction (`terraformTopologyPlacement.ts`). */
export function buildSubnetToVpcMapFromPlan(plan: {
  resource_changes?: ResourceChange[];
}): Map<string, string> {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  return buildSubnetToVpcMap(changes);
}

export function buildSubnetOwnerHintsFromPlan(plan: {
  resource_changes?: ResourceChange[];
}): Map<string, TerraformSubnetOwnerHint> {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  return buildSubnetOwnerHintMap(changes);
}

export function resolveTerraformTopologyAccountRegion(
  values: Record<string, unknown>,
): { account: string; region: string } {
  return resolveAccountRegion(values);
}

export function mergeTerraformTopologyAccountRegionFromSubnets(
  base: { account: string; region: string },
  subnetIds: string[],
  subnetOwners: Map<string, TerraformSubnetOwnerHint>,
): { account: string; region: string } {
  return mergeAccountRegionFromSubnets(base, subnetIds, subnetOwners);
}

/**
 * When a resource has no ARN/owner yet (e.g. create-only `aws_sqs_queue`) but lists a concrete
 * region, inherit account from any `aws_subnet` row in the plan with that region — matches real
 * single-account modules.
 */
export function mergeTerraformTopologyAccountRegionFromSameRegionSubnets(
  base: { account: string; region: string },
  subnetOwners: Map<string, TerraformSubnetOwnerHint>,
): { account: string; region: string } {
  if (base.account !== TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT) {
    return base;
  }
  if (base.region === TERRAFORM_TOPOLOGY_UNKNOWN_REGION) {
    return base;
  }
  const orderedSubnetIds = [...subnetOwners.keys()].sort();
  for (const sid of orderedSubnetIds) {
    const hint = subnetOwners.get(sid);
    if (
      hint &&
      hint.region === base.region &&
      hint.account !== TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT
    ) {
      return { account: hint.account, region: base.region };
    }
  }
  return base;
}

export function isAwsTerraformResourceChange(rc: {
  type?: string;
  provider_name?: string;
}): boolean {
  return isAwsResourceChange(rc as ResourceChange);
}

export type TopologyPlacementZoneSeed = {
  accountId: string;
  region: string;
  vpcId: string;
  subnetIds: string[];
};

/** Ensures VPC/subnet keys exist for zones-only primaries (union with graph-derived topology). */
export function mergeTopologyModelWithPlacementZones(
  model: TerraformTopologyModel,
  zones: readonly TopologyPlacementZoneSeed[],
): void {
  for (const z of zones) {
    if (!shouldEmitTopologyPlacement(z.accountId, z.region)) {
      continue;
    }
    const acc = ensureAccount(model, z.accountId);
    const reg = ensureRegion(acc, z.region);
    const vpc = ensureVpc(reg, z.vpcId);
    for (const sid of z.subnetIds) {
      ensureSubnet(vpc, sid);
    }
  }
}

/** Ensures account/region shells exist for VPC-less regional primaries (empty `vpcs` map). */
export function mergeTopologyModelWithRegionalBuckets(
  model: TerraformTopologyModel,
  buckets: readonly { accountId: string; region: string }[],
): void {
  for (const b of buckets) {
    if (!shouldEmitTopologyPlacement(b.accountId, b.region)) {
      continue;
    }
    const acc = ensureAccount(model, b.accountId);
    ensureRegion(acc, b.region);
  }
}

/** Ensures VPC shells exist for `aws_vpc_endpoint` buckets (VPC may have no subnets in model). */
export function mergeTopologyModelWithVpcEndpoints(
  model: TerraformTopologyModel,
  buckets: readonly { accountId: string; region: string; vpcId: string }[],
): void {
  for (const b of buckets) {
    if (!shouldEmitTopologyPlacement(b.accountId, b.region)) {
      continue;
    }
    const acc = ensureAccount(model, b.accountId);
    const reg = ensureRegion(acc, b.region);
    ensureVpc(reg, b.vpcId);
  }
}

/** Ensures VPC shells exist for `aws_route_table` buckets. */
export function mergeTopologyModelWithRouteTables(
  model: TerraformTopologyModel,
  buckets: readonly { accountId: string; region: string; vpcId: string }[],
): void {
  for (const b of buckets) {
    if (!shouldEmitTopologyPlacement(b.accountId, b.region)) {
      continue;
    }
    const acc = ensureAccount(model, b.accountId);
    const reg = ensureRegion(acc, b.region);
    ensureVpc(reg, b.vpcId);
  }
}

function ingestVpcSubnetPair(
  model: TerraformTopologyModel,
  subnetToVpc: Map<string, string>,
  subnetOwners: Map<string, SubnetOwnerHint>,
  values: Record<string, unknown>,
  vpcId: string | null,
  subnetIds: string[],
  plan: TerraformPlanProviderContext | undefined,
): void {
  const merged = mergeAccountRegionFromSubnets(
    resolveAccountRegionWithProviderDefaults(plan, values),
    subnetIds,
    subnetOwners,
  );
  const { account, region } = merged;
  if (!shouldEmitTopologyPlacement(account, region)) {
    return;
  }
  const acc = ensureAccount(model, account);
  const reg = ensureRegion(acc, region);

  for (const sid of subnetIds) {
    const vid = vpcId || subnetToVpc.get(sid) || null;
    if (!vid) {
      continue;
    }
    const vpc = ensureVpc(reg, vid);
    ensureSubnet(vpc, sid);
  }
}

function ingestStandaloneVpc(
  model: TerraformTopologyModel,
  subnetOwners: Map<string, SubnetOwnerHint>,
  values: Record<string, unknown>,
  vpcId: string,
  plan: TerraformPlanProviderContext | undefined,
): void {
  const sid = stringField(values.subnet_id);
  const merged = mergeAccountRegionFromSubnets(
    resolveAccountRegionWithProviderDefaults(plan, values),
    sid ? [sid] : [],
    subnetOwners,
  );
  const { account, region } = merged;
  if (!shouldEmitTopologyPlacement(account, region)) {
    return;
  }
  const acc = ensureAccount(model, account);
  const reg = ensureRegion(acc, region);
  ensureVpc(reg, vpcId);
}

function pruneEmptyTopology(model: TerraformTopologyModel): void {
  for (const [accountId, account] of [...model.accounts.entries()]) {
    for (const [regionName, region] of [...account.regions.entries()]) {
      if (region.vpcs.size === 0) {
        account.regions.delete(regionName);
      }
    }
    if (account.regions.size === 0) {
      model.accounts.delete(accountId);
    }
  }
}

/**
 * Walk `plan.resource_changes` and merge AWS VPC/subnet/account/region signals.
 */
export function extractTerraformTopologyFromPlan(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TerraformTopologyModel {
  const model: TerraformTopologyModel = {
    accounts: new Map(),
    sawAwsResourceChanges: false,
  };

  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];

  for (const rc of changes) {
    if (isAwsResourceChange(rc)) {
      model.sawAwsResourceChanges = true;
      break;
    }
  }

  const subnetToVpc = buildSubnetToVpcMap(changes);
  const subnetOwners = buildSubnetOwnerHintMap(changes);

  for (const rc of changes) {
    if (!isAwsResourceChange(rc)) {
      continue;
    }
    const values = pickResourceChangeValues(rc);
    if (!values) {
      continue;
    }

    if (rc.type === "aws_subnet") {
      const sid = stringField(values.id);
      const vid = stringField(values.vpc_id);
      if (sid && vid) {
        ingestVpcSubnetPair(model, subnetToVpc, subnetOwners, values, vid, [sid], plan);
      }
      continue;
    }

    const vidDirect = stringField(values.vpc_id);
    const subnetSingle = stringField(values.subnet_id);
    const subnetMulti = stringArrayField(values.subnet_ids);

    for (const block of vpcConfigBlocks(values)) {
      const sids = stringArrayField(block.subnet_ids);
      if (sids.length) {
        ingestVpcSubnetPair(model, subnetToVpc, subnetOwners, values, vidDirect, sids, plan);
      }
    }

    if (vidDirect && (subnetSingle || subnetMulti.length)) {
      ingestVpcSubnetPair(model, subnetToVpc, subnetOwners, values, vidDirect, [
        ...(subnetSingle ? [subnetSingle] : []),
        ...subnetMulti,
      ], plan);
    } else if (!vidDirect && (subnetSingle || subnetMulti.length)) {
      ingestVpcSubnetPair(model, subnetToVpc, subnetOwners, values, null, [
        ...(subnetSingle ? [subnetSingle] : []),
        ...subnetMulti,
      ], plan);
    }

    if (vidDirect && !subnetSingle && subnetMulti.length === 0) {
      const hasVpcConfigSubnets = vpcConfigBlocks(values).some(
        (b) => stringArrayField(b.subnet_ids).length > 0,
      );
      if (!hasVpcConfigSubnets) {
        ingestStandaloneVpc(model, subnetOwners, values, vidDirect, plan);
      }
    }
  }

  pruneEmptyTopology(model);

  return model;
}


/**
 * Resolve Terraform plan `configuration` expression references to `resource_changes`
 * addresses (for unknown-after dependency hints in the resource panel).
 */
import {
  hasTerraformPlanConfiguration,
  moduleCallSegmentsFromPrefix,
  qualifyConfigurationReference,
  shouldUsePlanReference,
} from "./terraformTopologyLambdaSgPlanConfig";
import { resolveTerraformPlanNodeKey } from "./terraformPlanParsing";

type UnknownRecord = Record<string, unknown>;

export type TerraformUnknownAfterDependency = {
  reference: string;
  nodePath: string | null;
};

export type TerraformUnknownAfterIntentRow = {
  key: string;
  kind: "new";
  /** HCL expression; null → plain "Known after apply" with no arrow target. */
  resolvesTo: string | null;
  nodePath: string | null;
};

const LAMBDA_ENVIRONMENT_MODULE_INPUT = "environment_variables";

/** Resource attribute → parent module `expressions` key. */
const RESOURCE_ATTR_TO_MODULE_INPUT: Record<string, Record<string, string>> = {
  aws_lambda_function: {
    environment: LAMBDA_ENVIRONMENT_MODULE_INPUT,
  },
};

function isPlainObject(v: unknown): v is UnknownRecord {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function flattenRefs(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenRefs(item, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      flattenRefs(v, out);
    }
  }
}

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

/** Deepest module path owning a resource address (`module.a.module.b` for `module.a.module.b.aws_x.y`). */
function getContainingModulePathForAddress(address: string): string {
  const parts = address.split(".");
  let index = 0;
  let modulePath = "";
  while (
    index < parts.length &&
    parts[index] === "module" &&
    parts[index + 1]
  ) {
    const segment = `module.${parts[index + 1]}`;
    modulePath = modulePath ? `${modulePath}.${segment}` : segment;
    index += 2;
  }
  return modulePath || "root";
}

/** Module path for module-level inputs (`module.writer.module.lambda.fn` → `module.writer`). */
function getModuleInputOwnerPrefix(resourceAddress: string): string {
  const full = getContainingModulePathForAddress(resourceAddress);
  if (!full || full === "root") {
    return "";
  }
  const parts = full.split(".");
  if (parts.length >= 4 && parts[parts.length - 2] === "module") {
    return parts.slice(0, -2).join(".");
  }
  return full;
}

function findConfigurationModule(
  rootModule: UnknownRecord,
  modulePrefix: string,
): { mod: UnknownRecord; prefix: string; call?: UnknownRecord } | null {
  if (!modulePrefix || modulePrefix === "root") {
    return { mod: rootModule, prefix: "" };
  }
  const segments = moduleCallSegmentsFromPrefix(modulePrefix);
  if (segments.length === 0) {
    return null;
  }
  let mod = rootModule;
  let prefix = "";
  let lastCall: UnknownRecord | undefined;
  for (const seg of segments) {
    const moduleCalls = mod.module_calls as UnknownRecord | undefined;
    if (!moduleCalls || typeof moduleCalls !== "object") {
      return null;
    }
    const call = moduleCalls[seg] as UnknownRecord | undefined;
    if (!call?.module || typeof call.module !== "object") {
      return null;
    }
    prefix = prefix ? `${prefix}.module.${seg}` : `module.${seg}`;
    lastCall = call;
    mod = call.module as UnknownRecord;
  }
  return { mod, prefix, call: lastCall };
}

function readExpressionReferences(expr: unknown): string[] {
  if (!isPlainObject(expr)) {
    return [];
  }
  const out: string[] = [];
  flattenRefs(expr.references, out);
  return out;
}

/** Bare `module.foo` entries (no output/resource suffix) are not useful dependency labels. */
const MODULE_ONLY_REF = /^module\.[A-Za-z0-9_-]+$/;

/** Module-call `references` are usually root-qualified; do not prefix the caller module again. */
function qualifyModuleInputReference(
  modulePrefix: string,
  ref: string,
): string {
  const r = ref.trim();
  if (!r) {
    return r;
  }
  if (r.startsWith("module.") || r.startsWith("aws_") || r.startsWith("data.")) {
    return r;
  }
  return qualifyConfigurationReference(modulePrefix, r);
}

function tryExpandModuleOutputRef(
  plan: unknown,
  ref: string,
): string[] | null {
  if (!hasTerraformPlanConfiguration(plan) || !ref.startsWith("module.")) {
    return null;
  }
  const rootModule = (plan as UnknownRecord).configuration as UnknownRecord;
  const rm = rootModule.root_module as UnknownRecord | undefined;
  if (!rm) {
    return null;
  }

  const parts = ref.split(".");
  if (parts.length < 3 || parts[0] !== "module") {
    return null;
  }

  for (let i = parts.length - 1; i >= 2; i -= 2) {
    if (parts[i - 1] !== "module" && i > 2) {
      continue;
    }
    const outputName = parts[i];
    if (!outputName || outputName.startsWith("aws_") || outputName === "data") {
      continue;
    }
    const moduleParts = parts.slice(0, i);
    const modulePrefix = moduleParts.join(".");
    const found = findConfigurationModule(rm, modulePrefix);
    if (!found) {
      continue;
    }
    const outputs = found.mod.outputs as UnknownRecord | undefined;
    const output = outputs?.[outputName] as UnknownRecord | undefined;
    if (!output) {
      continue;
    }
    const expr = output.expression;
    const refs = readExpressionReferences(expr);
    if (refs.length === 0) {
      continue;
    }
    return refs.map((r) => qualifyConfigurationReference(found.prefix, r));
  }

  const lastDot = ref.lastIndexOf(".");
  if (lastDot <= 0) {
    return null;
  }
  const outputName = ref.slice(lastDot + 1);
  const modulePrefix = ref.slice(0, lastDot);
  if (
    outputName.startsWith("aws_") ||
    outputName === "data" ||
    !modulePrefix.startsWith("module.")
  ) {
    return null;
  }
  const found = findConfigurationModule(rm, modulePrefix);
  if (!found) {
    return null;
  }
  const outputs = found.mod.outputs as UnknownRecord | undefined;
  const output = outputs?.[outputName] as UnknownRecord | undefined;
  if (!output) {
    return null;
  }
  const refs = readExpressionReferences(output.expression);
  if (refs.length === 0) {
    return null;
  }
  return refs.map((r) => qualifyConfigurationReference(found.prefix, r));
}

type PlanAddressEntry = {
  address: string;
  type: string;
  actions: string[];
};

function buildPlanAddressIndex(plan: unknown): PlanAddressEntry[] {
  const changes = (plan as UnknownRecord)?.resource_changes;
  if (!Array.isArray(changes)) {
    return [];
  }
  const out: PlanAddressEntry[] = [];
  for (const rc of changes) {
    if (!rc || typeof rc !== "object") {
      continue;
    }
    const address = (rc as UnknownRecord).address;
    if (typeof address !== "string") {
      continue;
    }
    const type =
      typeof (rc as UnknownRecord).type === "string"
        ? String((rc as UnknownRecord).type)
        : "";
    const change = (rc as UnknownRecord).change as UnknownRecord | undefined;
    const actions = Array.isArray(change?.actions)
      ? (change.actions as string[])
      : [];
    out.push({ address, type, actions });
  }
  return out;
}

const SECONDARY_RESOURCE_SUFFIXES = [
  "_policy",
  "_attachment",
  "_association",
  "_permission",
  "metric_alarm",
  "redrive",
];

function moduleCallPrefixFromRef(ref: string): string | null {
  const parts = stripIndexes(ref).split(".");
  if (parts[0] !== "module" || parts.length < 3) {
    return null;
  }
  return parts.slice(0, -1).join(".");
}

function scorePlanAddressMatch(entry: PlanAddressEntry, ref: string): number {
  let score = 0;
  const normRef = stripIndexes(ref);
  const normAddr = stripIndexes(entry.address);
  const refTail = normRef.split(".").pop() || "";
  if (normAddr === normRef) {
    score += 100;
  } else if (normAddr.startsWith(`${normRef}[`) || normRef.startsWith(normAddr)) {
    score += 80;
  } else if (normAddr.includes(refTail)) {
    score += 20;
  }
  const modPrefix = moduleCallPrefixFromRef(normRef);
  if (modPrefix && normAddr.startsWith(`${modPrefix}.`)) {
    score += 50;
    if (refTail.includes("bucket") && entry.type === "aws_s3_bucket") {
      score += 35;
    }
    if (refTail.includes("queue") && entry.type === "aws_sqs_queue") {
      score += 35;
    }
  }
  if (entry.actions.includes("create")) {
    score += 40;
  }
  if (entry.actions.includes("update")) {
    score += 25;
  }
  for (const suf of SECONDARY_RESOURCE_SUFFIXES) {
    if (entry.type.includes(suf) || entry.address.includes(suf)) {
      score -= 30;
    }
  }
  if (entry.type === "aws_sqs_queue" || entry.type === "aws_s3_bucket") {
    score += 15;
  }
  return score;
}

function matchRefToPlanNodePaths(
  plan: unknown,
  ref: string,
  addressIndex: PlanAddressEntry[],
): string[] {
  const nodes: Record<string, { resources: Record<string, unknown> }> = {};
  for (const entry of addressIndex) {
    nodes[entry.address] = { resources: {} };
  }
  const graph = nodes as Record<string, { resources: Record<string, unknown> }>;

  const stripped = stripIndexes(ref);
  const candidates: PlanAddressEntry[] = [];

  const modPrefix = moduleCallPrefixFromRef(stripped);
  for (const entry of addressIndex) {
    const norm = stripIndexes(entry.address);
    if (
      norm === stripped ||
      norm.startsWith(`${stripped}.`) ||
      stripped.startsWith(`${norm}.`) ||
      norm.startsWith(stripped) ||
      (modPrefix != null && norm.startsWith(`${modPrefix}.`))
    ) {
      candidates.push(entry);
    }
  }

  if (candidates.length === 0) {
    const resolved = resolveTerraformPlanNodeKey(graph, ref);
    return resolved ? [resolved] : [];
  }

  candidates.sort(
    (a, b) => scorePlanAddressMatch(b, ref) - scorePlanAddressMatch(a, ref),
  );
  return [candidates[0]!.address];
}

/** Expand module output chains until we reach resource-shaped references. */
export function resolveTerraformReferenceToNodePaths(
  plan: unknown,
  ref: string,
): string[] {
  if (!shouldUsePlanReference(ref)) {
    return [];
  }
  const addressIndex = buildPlanAddressIndex(plan);
  const queue = [ref];
  const seen = new Set<string>();
  const resourceRefs = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    const expanded = tryExpandModuleOutputRef(plan, current);
    if (expanded && expanded.length > 0) {
      for (const next of expanded) {
        if (!seen.has(next)) {
          queue.push(next);
        }
      }
      continue;
    }

    if (
      current.includes(".aws_") ||
      current.startsWith("aws_") ||
      current.includes(".data.")
    ) {
      resourceRefs.add(current);
    }
  }

  const paths = new Set<string>();
  const refsToMatch = new Set<string>(resourceRefs);
  refsToMatch.add(ref);
  for (const r of refsToMatch) {
    for (const p of matchRefToPlanNodePaths(plan, r, addressIndex)) {
      if (typeof p === "string" && p) {
        paths.add(p);
      }
    }
  }
  return [...paths].sort();
}

function readRawModuleInputExpressionRefs(
  plan: unknown,
  resourceAddress: string,
  attributeKey: string,
  resourceType: string,
): string[] {
  if (!hasTerraformPlanConfiguration(plan)) {
    return [];
  }
  const inputMap = RESOURCE_ATTR_TO_MODULE_INPUT[resourceType];
  const moduleInputKey = inputMap?.[attributeKey];
  if (!moduleInputKey) {
    return [];
  }

  const rm = ((plan as UnknownRecord).configuration as UnknownRecord)
    .root_module as UnknownRecord;
  const ownerPrefix = getModuleInputOwnerPrefix(resourceAddress);
  const found = findConfigurationModule(rm, ownerPrefix);
  if (!found) {
    return [];
  }

  const callExprs = found.call?.expressions as UnknownRecord | undefined;
  const callRefs = readExpressionReferences(callExprs?.[moduleInputKey]);
  const normalize = (raw: string[]) =>
    [...new Set(raw.map((r) => qualifyModuleInputReference(found.prefix, r)))].filter(
      (r) => r && !MODULE_ONLY_REF.test(r),
    );

  if (callRefs.length > 0) {
    return normalize(callRefs);
  }

  const modExprs = found.mod.expressions as UnknownRecord | undefined;
  const modRefs = readExpressionReferences(modExprs?.[moduleInputKey]);
  return normalize(modRefs);
}

/** All expression refs for a module input (includes `var.*`, `local.*`). */
export function readModuleInputExpressionRefs(
  plan: unknown,
  resourceAddress: string,
  attributeKey: string,
  resourceType: string,
): string[] {
  return readRawModuleInputExpressionRefs(
    plan,
    resourceAddress,
    attributeKey,
    resourceType,
  );
}

/**
 * Raw `configuration` references for a resource attribute (e.g. Lambda `environment`
 * → parent module `environment_variables`).
 */
export function resolveModuleCallExpressionRefs(
  plan: unknown,
  resourceAddress: string,
  attributeKey: string,
  resourceType: string,
): string[] {
  return readRawModuleInputExpressionRefs(
    plan,
    resourceAddress,
    attributeKey,
    resourceType,
  ).filter(shouldUsePlanReference);
}

function resolveNodePathForExpression(
  plan: unknown,
  expression: string,
): string | null {
  if (!shouldUsePlanReference(expression)) {
    return null;
  }
  const paths = resolveTerraformReferenceToNodePaths(plan, expression);
  return typeof paths[0] === "string" && paths[0] ? paths[0] : null;
}

/**
 * String map from block-shaped attribute values (e.g. Lambda `environment`:
 * `[{ variables: { KEY: value } }]`). Plain objects are treated as maps directly.
 */
export function extractStringMapFromBlockValue(
  value: unknown,
  blockKey = "variables",
): Record<string, unknown> {
  if (isPlainObject(value)) {
    return { ...value };
  }
  if (!Array.isArray(value)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const block of value) {
    if (!isPlainObject(block)) {
      continue;
    }
    const map = block[blockKey];
    if (!isPlainObject(map)) {
      continue;
    }
    for (const [k, v] of Object.entries(map)) {
      out[k] = v;
    }
  }
  return out;
}

/** Variables map from Lambda `environment` value `[{ variables: { … } }]`. */
export function extractLambdaEnvironmentVariables(
  environmentValue: unknown,
): Record<string, unknown> {
  return extractStringMapFromBlockValue(environmentValue, "variables");
}

/** Keys from Lambda `environment` before value `[{ variables: { … } }]`. */
export function extractLambdaEnvironmentVariableKeys(
  beforeValue: unknown,
): string[] {
  return Object.keys(extractLambdaEnvironmentVariables(beforeValue)).sort();
}

function refLastSegment(ref: string): string {
  const parts = ref.split(".");
  return parts[parts.length - 1] || ref;
}

/** UI row label for a new ref when configuration has no per-key env names. */
export function labelFromModuleInputRef(ref: string): string {
  return refLastSegment(ref);
}

/**
 * Drop bare `module.foo` entries when a longer ref exists, then keep only the most
 * specific ref when one is a dotted prefix of another.
 */
export function dedupeModuleInputRefs(refs: string[]): string[] {
  const withoutModuleOnly = refs.filter((ref) => {
    if (!MODULE_ONLY_REF.test(ref)) {
      return true;
    }
    return !refs.some((other) => other !== ref && other.startsWith(`${ref}.`));
  });
  const sorted = [...withoutModuleOnly].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const ref of sorted) {
    if (!kept.some((k) => k.startsWith(`${ref}.`))) {
      kept.push(ref);
    }
  }
  return kept.sort();
}

function findResourceChange(
  plan: unknown,
  address: string,
): UnknownRecord | null {
  const changes = (plan as UnknownRecord).resource_changes;
  if (!Array.isArray(changes)) {
    return null;
  }
  for (const entry of changes) {
    if (!isPlainObject(entry)) {
      continue;
    }
    if (entry.address === address) {
      return entry;
    }
  }
  return null;
}

function collectScalarsFromValue(
  value: unknown,
  out: Set<string>,
  depth: number,
): void {
  if (depth > 2) {
    return;
  }
  if (value === null || value === undefined) {
    return;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    out.add(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectScalarsFromValue(item, out, depth + 1);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      collectScalarsFromValue(v, out, depth + 1);
    }
  }
}

/** Shallow scalar values from `resource_changes[].change.before` for value-based ref matching. */
export function collectResourceBeforeScalars(
  plan: unknown,
  nodePath: string,
): Set<string> {
  const rc = findResourceChange(plan, nodePath);
  const change = rc?.change;
  const before =
    isPlainObject(change) && "before" in change ? change.before : undefined;
  const out = new Set<string>();
  collectScalarsFromValue(before, out, 0);
  return out;
}

/**
 * True when a before map value equals a scalar on the resource(s) resolved from `ref`.
 * Plan configuration only lists flat module-input refs — no env key names — so we match
 * by value instead of name heuristics.
 */
export function beforeValuesSatisfyRef(
  plan: unknown,
  ref: string,
  beforeVars: Record<string, unknown>,
): boolean {
  const beforeValues = new Set<string>();
  for (const v of Object.values(beforeVars)) {
    if (v === null || v === undefined) {
      continue;
    }
    beforeValues.add(String(v));
  }
  if (beforeValues.size === 0) {
    return false;
  }

  const paths = resolveTerraformReferenceToNodePaths(plan, ref);
  for (const nodePath of paths) {
    const scalars = collectResourceBeforeScalars(plan, nodePath);
    for (const bv of beforeValues) {
      if (scalars.has(bv)) {
        return true;
      }
    }
  }
  return false;
}

type IntentStrategyContext = {
  plan: unknown;
  resourceAddress: string;
  attributeKey: string;
  resourceType: string;
  beforeValue: unknown;
  moduleInputKey: string;
};

type UnknownAfterIntentStrategy = {
  id: string;
  matches: (resourceType: string, attributeKey: string) => boolean;
  build: (ctx: IntentStrategyContext) => TerraformUnknownAfterIntentRow[];
};

function getModuleInputKey(
  resourceType: string,
  attributeKey: string,
): string | null {
  return RESOURCE_ATTR_TO_MODULE_INPUT[resourceType]?.[attributeKey] ?? null;
}

function buildMapBlockEnvIntentPreview(
  ctx: IntentStrategyContext,
  options: { blockKey: string },
): TerraformUnknownAfterIntentRow[] {
  const refs = dedupeModuleInputRefs(
    resolveModuleCallExpressionRefs(
      ctx.plan,
      ctx.resourceAddress,
      ctx.attributeKey,
      ctx.resourceType,
    ),
  );
  if (refs.length === 0) {
    return [];
  }

  const beforeVars = extractStringMapFromBlockValue(
    ctx.beforeValue,
    options.blockKey,
  );
  const rows: TerraformUnknownAfterIntentRow[] = [];

  for (const ref of refs) {
    if (beforeValuesSatisfyRef(ctx.plan, ref, beforeVars)) {
      continue;
    }
    const rowKey = labelFromModuleInputRef(ref);
    if (rows.some((r) => r.key === rowKey)) {
      continue;
    }
    rows.push({
      key: rowKey,
      kind: "new",
      resolvesTo: ref,
      nodePath: resolveNodePathForExpression(ctx.plan, ref),
    });
  }

  return rows;
}

const mapBlockEnvStrategy: UnknownAfterIntentStrategy = {
  id: "mapBlockEnv",
  matches: (resourceType, attributeKey) =>
    resourceType === "aws_lambda_function" && attributeKey === "environment",
  build: (ctx) => buildMapBlockEnvIntentPreview(ctx, { blockKey: "variables" }),
};

const UNKNOWN_AFTER_INTENT_STRATEGIES: UnknownAfterIntentStrategy[] = [
  mapBlockEnvStrategy,
];

export function buildUnknownAfterIntentPreview(
  plan: unknown,
  resourceAddress: string,
  attributeKey: string,
  resourceType: string,
  beforeValue: unknown,
): TerraformUnknownAfterIntentRow[] {
  for (const strategy of UNKNOWN_AFTER_INTENT_STRATEGIES) {
    if (!strategy.matches(resourceType, attributeKey)) {
      continue;
    }
    const moduleInputKey = getModuleInputKey(resourceType, attributeKey);
    if (!moduleInputKey) {
      return [];
    }
    return strategy.build({
      plan,
      resourceAddress,
      attributeKey,
      resourceType,
      beforeValue,
      moduleInputKey,
    });
  }
  return [];
}

export function buildUnknownAfterDependencies(
  plan: unknown,
  resourceAddress: string,
  attributeKey: string,
  resourceType: string,
): TerraformUnknownAfterDependency[] {
  const refs = resolveModuleCallExpressionRefs(
    plan,
    resourceAddress,
    attributeKey,
    resourceType,
  );
  const seen = new Set<string>();
  const out: TerraformUnknownAfterDependency[] = [];

  for (const reference of refs) {
    if (seen.has(reference) || MODULE_ONLY_REF.test(reference)) {
      continue;
    }
    seen.add(reference);
    const paths = resolveTerraformReferenceToNodePaths(plan, reference);
    const nodePath =
      typeof paths[0] === "string" && paths[0] ? paths[0] : null;
    out.push({ reference, nodePath });
  }
  return out;
}

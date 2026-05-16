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

function scorePlanAddressMatch(entry: PlanAddressEntry, ref: string): number {
  let score = 0;
  const normRef = stripIndexes(ref);
  const normAddr = stripIndexes(entry.address);
  if (normAddr === normRef) {
    score += 100;
  } else if (normAddr.startsWith(`${normRef}[`) || normRef.startsWith(normAddr)) {
    score += 80;
  } else if (normAddr.includes(normRef.split(".").pop() || "")) {
    score += 20;
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

  for (const entry of addressIndex) {
    const norm = stripIndexes(entry.address);
    if (
      norm === stripped ||
      norm.startsWith(`${stripped}.`) ||
      stripped.startsWith(`${norm}.`) ||
      norm.startsWith(stripped)
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
  for (const r of resourceRefs) {
    for (const p of matchRefToPlanNodePaths(plan, r, addressIndex)) {
      if (typeof p === "string" && p) {
        paths.add(p);
      }
    }
  }
  return [...paths].sort();
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
    raw
      .filter(shouldUsePlanReference)
      .filter((r) => !MODULE_ONLY_REF.test(r))
      .map((r) => qualifyModuleInputReference(found.prefix, r));

  if (callRefs.length > 0) {
    return normalize(callRefs);
  }

  const modExprs = found.mod.expressions as UnknownRecord | undefined;
  const modRefs = readExpressionReferences(modExprs?.[moduleInputKey]);
  return normalize(modRefs);
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

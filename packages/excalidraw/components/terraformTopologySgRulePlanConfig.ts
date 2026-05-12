/**
 * Index `configuration` for SG rule resources: `expressions.security_group_id.references`
 * when `resource_changes` omits `security_group_id` on create (known after apply).
 */

import { hasTerraformPlanConfiguration } from "./terraformTopologyLambdaSgPlanConfig";

type UnknownRecord = Record<string, unknown>;

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

const SG_RULE_TYPES = new Set([
  "aws_vpc_security_group_ingress_rule",
  "aws_vpc_security_group_egress_rule",
  "aws_security_group_rule",
]);

function configurationResourceFullAddress(
  modulePrefix: string,
  resourceAddress: string,
): string {
  const ra = resourceAddress.trim();
  if (ra.startsWith("module.")) {
    return ra;
  }
  return modulePrefix ? `${modulePrefix}.${ra}` : ra;
}

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

function readSecurityGroupIdExpressionRefs(
  expressions: UnknownRecord,
): string[] {
  const sgId = expressions.security_group_id;
  if (!sgId || typeof sgId !== "object" || Array.isArray(sgId)) {
    return [];
  }
  const rawRefs = (sgId as UnknownRecord).references;
  const out: string[] = [];
  flattenRefs(rawRefs, out);
  return out;
}

function appendRefs(
  map: Map<string, string[]>,
  key: string,
  refs: readonly string[],
): void {
  if (refs.length === 0) {
    return;
  }
  const cur = map.get(key);
  if (cur) {
    cur.push(...refs);
  } else {
    map.set(key, [...refs]);
  }
}

function walkModuleForSgRuleRefs(
  mod: UnknownRecord,
  modulePrefix: string,
  out: Map<string, string[]>,
): void {
  const resources = mod.resources as unknown;
  if (Array.isArray(resources)) {
    for (const raw of resources) {
      if (!isPlainObject(raw)) {
        continue;
      }
      const res = raw as UnknownRecord;
      if (typeof res.type !== "string" || !SG_RULE_TYPES.has(res.type)) {
        continue;
      }
      const addr = typeof res.address === "string" ? res.address : "";
      if (!addr) {
        continue;
      }
      const expressions = res.expressions;
      if (
        !expressions ||
        typeof expressions !== "object" ||
        Array.isArray(expressions)
      ) {
        continue;
      }
      const full = configurationResourceFullAddress(modulePrefix, addr);
      const norm = stripIndexes(full);
      appendRefs(
        out,
        norm,
        readSecurityGroupIdExpressionRefs(expressions as UnknownRecord),
      );
    }
  }

  const moduleCalls = mod.module_calls as UnknownRecord | undefined;
  if (
    moduleCalls &&
    typeof moduleCalls === "object" &&
    !Array.isArray(moduleCalls)
  ) {
    for (const name of Object.keys(moduleCalls)) {
      const call = moduleCalls[name] as UnknownRecord | undefined;
      if (!call || typeof call !== "object" || Array.isArray(call)) {
        continue;
      }
      const childPrefix = modulePrefix
        ? `${modulePrefix}.module.${name}`
        : `module.${name}`;
      const inner = call.module as UnknownRecord | undefined;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        walkModuleForSgRuleRefs(inner, childPrefix, out);
      }
    }
  }
}

function buildSgRuleSecurityGroupIdRefIndex(
  plan: unknown,
): Map<string, string[]> | null {
  if (!hasTerraformPlanConfiguration(plan)) {
    return null;
  }
  const rootModule = (plan as UnknownRecord).configuration as UnknownRecord;
  const rm = rootModule.root_module as UnknownRecord | undefined;
  if (!rm || typeof rm !== "object") {
    return null;
  }
  const out = new Map<string, string[]>();
  walkModuleForSgRuleRefs(rm, "", out);
  return out;
}

const ruleSgRefIndexCache = new WeakMap<object, Map<string, string[]>>();

export function getSgRuleSecurityGroupIdRefIndex(
  plan: unknown,
): Map<string, string[]> | null {
  if (!plan || typeof plan !== "object") {
    return null;
  }
  const o = plan as object;
  const hit = ruleSgRefIndexCache.get(o);
  if (hit) {
    return hit;
  }
  const built = buildSgRuleSecurityGroupIdRefIndex(plan);
  if (built) {
    ruleSgRefIndexCache.set(o, built);
  }
  return built;
}

/** Raw ref strings from `configuration` for this rule address (normalized). */
export function collectSgRuleSecurityGroupIdRefsFromPlanConfiguration(
  plan: unknown,
  ruleAddress: string,
): string[] | null {
  const idx = getSgRuleSecurityGroupIdRefIndex(plan);
  if (!idx) {
    return null;
  }
  const norm = stripIndexes(ruleAddress);
  return idx.get(norm) ?? [];
}

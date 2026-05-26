/**
 * Pure merge helpers for multi-file Terraform import (plans, graphs, state, .tfd).
 */

import graphlibDot from "@dagrejs/graphlib-dot";

import { buildSyntheticPlanFromTfstate } from "./terraformStateToPlan";

export type TerraformImportWarning = {
  code: "duplicate_address" | "variable_mismatch" | "duplicate_tfd_bind";
  message: string;
  address?: string;
  source?: string;
};

export type TerraformPlanDotBundle = {
  plan: unknown;
  dotText: string;
  label?: string;
};

export type MergePlanJsonsResult = {
  plan: {
    resource_changes: unknown[];
    variables?: Record<string, { value: unknown }>;
    prior_state?: unknown;
    configuration?: unknown;
  };
  warnings: TerraformImportWarning[];
  /** Original plans (for per-plan prior_state edge building). */
  sourcePlans: unknown[];
};

const sanitizeDotNodeId = (nodeId = "") => {
  const parts = String(nodeId).trim().split(" ");
  const raw = parts.length >= 2 ? parts[1] : parts[0] || "";
  return raw.replace(/["\\]/g, "");
};

/** Parse raw Terraform state JSON (`terraform state pull` shape). */
export function parseRawStateJson(
  text: string,
):
  | { ok: true; state: { resources: unknown[] } }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "State file must be valid JSON." };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { resources?: unknown }).resources)
  ) {
    return {
      ok: false,
      error:
        'State file must be raw Terraform state JSON (top-level "resources" array), e.g. terraform state pull.',
    };
  }
  return { ok: true, state: parsed as { resources: unknown[] } };
}

function sourceLabel(label: string | undefined, index: number): string {
  return label?.trim() || `import ${index + 1}`;
}

/** Union dependency-graph adjacency from multiple `terraform graph` DOT exports. */
export function mergeDotAdjacency(
  dotTexts: string[],
): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {};

  for (const dotText of dotTexts) {
    const graph = graphlibDot.read(dotText);
    for (const { v, w } of graph.edges()) {
      const source = sanitizeDotNodeId(v);
      const target = sanitizeDotNodeId(w);
      if (!adjacency[source]) {
        adjacency[source] = [];
      }
      if (!adjacency[source].includes(target)) {
        adjacency[source].push(target);
      }
    }
  }

  return adjacency;
}

const VARIABLE_KEYS = ["aws_account_id", "aws_region"] as const;

function mergePlanVariables(
  plans: unknown[],
  labels: (string | undefined)[],
  warnings: TerraformImportWarning[],
): Record<string, { value: unknown }> | undefined {
  const merged: Record<string, { value: unknown }> = {};
  const seen: Partial<Record<typeof VARIABLE_KEYS[number], unknown>> = {};

  for (let i = 0; i < plans.length; i++) {
    const variables = (
      plans[i] as { variables?: Record<string, { value: unknown }> }
    )?.variables;
    if (!variables) {
      continue;
    }
    const label = sourceLabel(labels[i], i);
    for (const key of VARIABLE_KEYS) {
      const entry = variables[key];
      if (!entry || entry.value == null || entry.value === "") {
        continue;
      }
      if (seen[key] != null && seen[key] !== entry.value) {
        warnings.push({
          code: "variable_mismatch",
          message: `${key} differs between imports; using value from "${label}".`,
          source: label,
        });
      }
      if (merged[key] == null) {
        merged[key] = entry;
        seen[key] = entry.value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergePlanConfigurations(
  plans: unknown[],
  labels: (string | undefined)[],
  warnings: TerraformImportWarning[],
): unknown | undefined {
  const providerConfig: Record<string, unknown> = {};
  let sawConfig = false;

  for (let i = 0; i < plans.length; i++) {
    const configuration = (
      plans[i] as {
        configuration?: { provider_config?: Record<string, unknown> };
      }
    )?.configuration;
    const configs = configuration?.provider_config;
    if (!configs) {
      continue;
    }
    sawConfig = true;
    const label = sourceLabel(labels[i], i);
    for (const [key, value] of Object.entries(configs)) {
      if (providerConfig[key] == null) {
        providerConfig[key] = value;
        continue;
      }
      if (JSON.stringify(providerConfig[key]) !== JSON.stringify(value)) {
        warnings.push({
          code: "variable_mismatch",
          message: `provider_config["${key}"] differs between imports; keeping first value (later from "${label}").`,
          source: label,
        });
      }
    }
  }

  if (!sawConfig) {
    return undefined;
  }
  return { provider_config: providerConfig };
}

/** Concatenate `resource_changes` from multiple plan JSON objects (last wins on duplicate address). */
export function mergePlanJsons(
  plans: unknown[],
  labels?: (string | undefined)[],
): MergePlanJsonsResult {
  if (plans.length === 1) {
    return {
      plan: plans[0] as MergePlanJsonsResult["plan"],
      warnings: [],
      sourcePlans: plans,
    };
  }

  const warnings: TerraformImportWarning[] = [];
  const resourceChanges: unknown[] = [];
  const addressIndex = new Map<string, number>();
  const labelList = labels ?? plans.map(() => undefined);

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i] as { resource_changes?: unknown[] };
    const label = sourceLabel(labelList[i], i);
    for (const rc of plan.resource_changes || []) {
      const address = (rc as { address?: string }).address;
      if (typeof address !== "string" || !address) {
        continue;
      }
      const existingIdx = addressIndex.get(address);
      if (existingIdx != null) {
        const prevLabel = sourceLabel(labelList[existingIdx], existingIdx);
        warnings.push({
          code: "duplicate_address",
          message: `Address "${address}" overwritten by "${label}" (was "${prevLabel}").`,
          address,
          source: label,
        });
        resourceChanges[existingIdx] = rc;
      } else {
        addressIndex.set(address, resourceChanges.length);
        resourceChanges.push(rc);
      }
    }
  }

  const variables = mergePlanVariables(plans, labelList, warnings);
  const merged: MergePlanJsonsResult["plan"] = {
    resource_changes: resourceChanges,
  };
  if (variables) {
    merged.variables = variables;
  }

  const configuration = mergePlanConfigurations(plans, labelList, warnings);
  if (configuration) {
    merged.configuration = configuration;
  }

  return {
    plan: merged,
    warnings,
    sourcePlans: plans,
  };
}

/** Merge plan bundles with optional raw state files into one plan-shaped object. */
export function mergePlanWithStates(
  plan: MergePlanJsonsResult["plan"],
  sourcePlans: unknown[],
  states: unknown[],
  stateLabels: (string | undefined)[],
  warnings: TerraformImportWarning[],
): { plan: MergePlanJsonsResult["plan"]; sourcePlans: unknown[] } {
  if (states.length === 0) {
    return { plan, sourcePlans };
  }
  const stateMerged = mergeSyntheticPlans(states, stateLabels);
  const combined = mergePlanJsons(
    [plan, stateMerged.plan],
    ["plan", stateLabels[0] ?? "state"],
  );
  warnings.push(...stateMerged.warnings, ...combined.warnings);
  return {
    plan: combined.plan,
    sourcePlans: [...sourcePlans, ...stateMerged.sourcePlans],
  };
}

/** Build one synthetic plan from multiple raw state files. */
export function mergeSyntheticPlans(
  states: unknown[],
  labels?: (string | undefined)[],
): MergePlanJsonsResult {
  const syntheticPlans = states.map((state) =>
    buildSyntheticPlanFromTfstate(state),
  );
  return mergePlanJsons(syntheticPlans, labels);
}

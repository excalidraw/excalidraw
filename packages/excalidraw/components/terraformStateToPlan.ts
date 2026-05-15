/**
 * Build plan-shaped `resource_changes` from raw Terraform state for semantic topology import.
 */

import type { TerraformPlanProviderContext } from "./terraformTopologyExtract";

/** Same allowlist as graph merge in `terraformPlanParsing.tsx`. */
const DATA_SOURCE_SEMANTIC_ALLOWLIST = new Set(["aws_iam_policy_document"]);

export type SyntheticResourceChange = {
  address: string;
  mode?: string;
  type?: string;
  name?: string;
  provider_name?: string;
  change: {
    actions: string[];
    after: Record<string, unknown>;
  };
};

export type SyntheticPlanFromTfstate = TerraformPlanProviderContext & {
  resource_changes: SyntheticResourceChange[];
};

type TerraformStateResource = {
  module?: string;
  mode?: string;
  type?: string;
  name?: string;
  provider?: string;
  instances?: Array<{
    index_key?: unknown;
    attributes?: Record<string, unknown>;
  }>;
};

function getStateResourceAddress(
  resource: TerraformStateResource,
  instance: NonNullable<TerraformStateResource["instances"]>[number],
): string {
  const parts: string[] = [];
  if (resource.module) {
    parts.push(resource.module);
  }
  if (resource.mode === "data") {
    parts.push("data");
  }
  parts.push(resource.type || "", resource.name || "");
  let address = parts.join(".");
  if (Object.prototype.hasOwnProperty.call(instance, "index_key")) {
    const key = instance.index_key;
    address +=
      typeof key === "number" ? `[${key}]` : `[${JSON.stringify(key)}]`;
  }
  return address;
}

function shouldIncludeStateResourceInSyntheticPlan(
  resource: TerraformStateResource,
): boolean {
  if (resource.mode !== "data") {
    return true;
  }
  const type = resource.type || "";
  return DATA_SOURCE_SEMANTIC_ALLOWLIST.has(type);
}

function stringField(v: unknown): string | null {
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Scan raw state for `data.aws_caller_identity` / `data.aws_region` to populate plan variables.
 */
export function inferProviderVariablesFromState(
  state: unknown,
): Record<string, { value: unknown }> | undefined {
  if (!state || typeof state !== "object") {
    return undefined;
  }
  const resources = (state as { resources?: unknown }).resources;
  if (!Array.isArray(resources)) {
    return undefined;
  }

  let accountId: string | null = null;
  let region: string | null = null;

  for (const resource of resources as TerraformStateResource[]) {
    if (resource.mode !== "data") {
      continue;
    }
    for (const instance of resource.instances || []) {
      const attrs = instance.attributes || {};
      if (resource.type === "aws_caller_identity") {
        accountId =
          stringField(attrs.account_id) ?? accountId;
      }
      if (resource.type === "aws_region") {
        region =
          stringField(attrs.name) ??
          stringField(attrs.id) ??
          region;
      }
    }
  }

  const variables: Record<string, { value: unknown }> = {};
  if (accountId) {
    variables.aws_account_id = { value: accountId };
  }
  if (region) {
    variables.aws_region = { value: region };
  }
  return Object.keys(variables).length > 0 ? variables : undefined;
}

/** True when no managed `aws_*` resources exist for semantic topology. */
export function isSyntheticPlanEmptyForSemantic(
  plan: { resource_changes?: Array<{ mode?: string; type?: string }> },
): boolean {
  const changes = plan.resource_changes || [];
  return !changes.some(
    (rc) =>
      rc.mode !== "data" &&
      typeof rc.type === "string" &&
      rc.type.startsWith("aws_"),
  );
}

/**
 * Convert raw tfstate (`terraform state pull` shape) into a synthetic plan JSON object
 * suitable for `extractTerraformTopologyFromPlan` and related placement helpers.
 */
export function buildSyntheticPlanFromTfstate(
  state: unknown,
): SyntheticPlanFromTfstate {
  const resource_changes: SyntheticResourceChange[] = [];

  if (state && typeof state === "object") {
    const resources = (state as { resources?: unknown }).resources;
    if (Array.isArray(resources)) {
      for (const resource of resources as TerraformStateResource[]) {
        if (!shouldIncludeStateResourceInSyntheticPlan(resource)) {
          continue;
        }
        for (const instance of resource.instances || []) {
          const address = getStateResourceAddress(resource, instance);
          const after = (instance.attributes || {}) as Record<string, unknown>;
          resource_changes.push({
            address,
            mode: resource.mode,
            type: resource.type,
            name: resource.name,
            provider_name: resource.provider,
            change: {
              actions: ["read"],
              after,
            },
          });
        }
      }
    }
  }

  const variables = inferProviderVariablesFromState(state);
  return {
    resource_changes,
    ...(variables ? { variables } : {}),
  };
}

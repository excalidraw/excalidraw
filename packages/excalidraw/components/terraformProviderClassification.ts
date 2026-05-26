/**
 * Classify Terraform resource changes by cloud provider family for multi-provider layout.
 */

import { getTerraformResourceTypeFromNodePath } from "./terraformPrimaryVisibility";

export type TerraformProviderFamily =
  | "aws"
  | "cloudflare"
  | "google"
  | "azurerm"
  | "other";

export type TerraformResourceChangeLike = {
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

const PROVIDER_FAMILY_LABELS: Record<TerraformProviderFamily, string> = {
  aws: "AWS",
  cloudflare: "Cloudflare",
  google: "GCP",
  azurerm: "Azure",
  other: "Other",
};

function familyFromProviderName(
  providerName: string,
): TerraformProviderFamily | null {
  const p = providerName.toLowerCase();
  if (p.includes("hashicorp/aws") || p.endsWith("/aws")) {
    return "aws";
  }
  if (p.includes("cloudflare/cloudflare") || p.includes("/cloudflare")) {
    return "cloudflare";
  }
  if (p.includes("hashicorp/google") || p.includes("/google")) {
    return "google";
  }
  if (p.includes("hashicorp/azurerm") || p.includes("/azurerm")) {
    return "azurerm";
  }
  return null;
}

function familyFromResourceType(resourceType: string): TerraformProviderFamily {
  if (resourceType.startsWith("aws_")) {
    return "aws";
  }
  if (resourceType.startsWith("cloudflare_")) {
    return "cloudflare";
  }
  if (resourceType.startsWith("google_")) {
    return "google";
  }
  if (resourceType.startsWith("azurerm_")) {
    return "azurerm";
  }
  return "other";
}

export function classifyTerraformResourceChange(
  rc: TerraformResourceChangeLike,
): {
  providerFamily: TerraformProviderFamily;
  providerLabel: string;
} {
  const providerName = rc.provider_name;
  if (typeof providerName === "string" && providerName.trim()) {
    const fromProvider = familyFromProviderName(providerName);
    if (fromProvider) {
      return {
        providerFamily: fromProvider,
        providerLabel: PROVIDER_FAMILY_LABELS[fromProvider],
      };
    }
  }

  const type =
    typeof rc.type === "string" && rc.type
      ? rc.type
      : typeof rc.address === "string"
      ? getTerraformResourceTypeFromNodePath(rc.address)
      : "unknown";

  const family = familyFromResourceType(type);
  return {
    providerFamily: family,
    providerLabel: PROVIDER_FAMILY_LABELS[family],
  };
}

export function isManagedTerraformResourceChange(
  rc: TerraformResourceChangeLike,
): boolean {
  return (
    rc.mode !== "data" && typeof rc.type === "string" && rc.type.length > 0
  );
}

/** True when merged plan has at least one managed resource for semantic / topology import. */
export function hasManagedResourcesForSemantic(plan: {
  resource_changes?: TerraformResourceChangeLike[];
}): boolean {
  return (plan.resource_changes || []).some(isManagedTerraformResourceChange);
}

export function partitionResourceChangesByProviderFamily(plan: {
  resource_changes?: TerraformResourceChangeLike[];
}): Map<TerraformProviderFamily, TerraformResourceChangeLike[]> {
  const buckets = new Map<
    TerraformProviderFamily,
    TerraformResourceChangeLike[]
  >();
  for (const rc of plan.resource_changes || []) {
    if (!isManagedTerraformResourceChange(rc)) {
      continue;
    }
    const { providerFamily } = classifyTerraformResourceChange(rc);
    const list = buckets.get(providerFamily) ?? [];
    list.push(rc);
    buckets.set(providerFamily, list);
  }
  return buckets;
}

export function filterPlanByProviderFamily<
  T extends { resource_changes?: TerraformResourceChangeLike[] },
>(plan: T, family: TerraformProviderFamily): T {
  return {
    ...plan,
    resource_changes: (plan.resource_changes || []).filter(
      (rc) =>
        isManagedTerraformResourceChange(rc) &&
        classifyTerraformResourceChange(rc).providerFamily === family,
    ),
  };
}

export function providerFamilySortOrder(
  family: TerraformProviderFamily,
): number {
  switch (family) {
    case "aws":
      return 0;
    case "cloudflare":
      return 1;
    case "google":
      return 2;
    case "azurerm":
      return 3;
    default:
      return 4;
  }
}

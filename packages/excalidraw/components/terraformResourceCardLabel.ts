import { getTerraformResourceTypeFromNodePath } from "./terraformPrimaryVisibility";

import { terraformHumanNameFromPlanResource } from "./terraformResourceHumanName";

const MAX_CARD_LINE_LEN = 52;

function truncateLine(line: string, max = MAX_CARD_LINE_LEN): string {
  if (line.length <= max) {
    return line;
  }
  return `${line.slice(0, Math.max(0, max - 1))}…`;
}

/** Full Terraform type for labels, icons, and `customData.resourceType` (incl. `data.*`). */
export function getTerraformCardResourceType(
  address: string,
  resource?: Record<string, unknown> | null,
): string {
  const t = typeof resource?.type === "string" ? resource.type : "";
  const mode = typeof resource?.mode === "string" ? resource.mode : "";
  if (t && mode === "data") {
    return `data.${t}`;
  }
  if (t) {
    return t;
  }
  const fromPath = getTerraformResourceTypeFromNodePath(address);
  if (fromPath === "data") {
    const parts = address.replace(/\[[^\]]+\]/g, "").split(".");
    let i = 0;
    while (i < parts.length && parts[i] === "module" && parts[i + 1]) {
      i += 2;
    }
    if (parts[i] === "data" && parts[i + 1]) {
      return `data.${parts[i + 1]}`;
    }
  }
  return fromPath;
}

/** Last `module.X` segment name in a dotted path (e.g. `module.a.module.b` → `b`). */
function lastModuleCallName(strippedParts: string[]): string | null {
  let last: string | null = null;
  for (let j = 0; j < strippedParts.length - 1; ) {
    if (strippedParts[j] === "module" && strippedParts[j + 1]) {
      last = strippedParts[j + 1]!;
      j += 2;
    } else {
      j += 1;
    }
  }
  return last;
}

/**
 * Terraform **instance name** (block label), not the full address and not the provider type.
 * Parsed from address when plan JSON omits `name`.
 */
export function terraformInstanceNameFromAddress(
  address: string,
  resourceType: string,
): string {
  const stripped = address.replace(/\[[^\]]+\]/g, "");
  const parts = stripped.split(".");
  let i = 0;
  while (i < parts.length && parts[i] === "module" && parts[i + 1]) {
    i += 2;
  }
  const rest = parts.slice(i);

  if (rest.length === 0) {
    return lastModuleCallName(parts) ?? stripped;
  }

  if (rest[0] === "data" && rest.length >= 3) {
    return rest.slice(2).join(".") || rest[rest.length - 1] || stripped;
  }

  if (rest.length >= 2) {
    return rest.slice(1).join(".") || stripped;
  }

  return rest[0] || stripped;
}

/**
 * On-canvas label: prefer **provider attribute** human names (`function_name`, `bucket`, …),
 * then Terraform block `name`, then address tail, then type token.
 */
export function terraformResourceCardLabel(
  address: string,
  resource?: Record<string, unknown> | null,
): string {
  const resourceType = getTerraformCardResourceType(address, resource);
  const fromPlanHuman = terraformHumanNameFromPlanResource(
    resource as Record<string, unknown> | null,
  );

  const planNameRaw = resource?.name;
  const planName =
    typeof planNameRaw === "string" && planNameRaw.trim().length > 0
      ? planNameRaw.trim()
      : null;

  const fromAddress = terraformInstanceNameFromAddress(address, resourceType);

  const label = fromPlanHuman ?? planName ?? fromAddress;

  if (!label.trim()) {
    const typeOnly = resourceType.includes(".")
      ? resourceType.split(".").pop()!
      : resourceType;
    return truncateLine(typeOnly);
  }

  return truncateLine(label);
}

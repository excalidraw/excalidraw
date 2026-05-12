import { getTerraformResourceTypeFromNodePath } from "./terraformPrimaryVisibility";

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

function displayNameFromAddress(address: string, resourceType: string): string {
  const strippedAddr = address.replace(/\[[^\]]+\]/g, "");
  const parts = strippedAddr.split(".");
  let i = 0;
  while (i < parts.length && parts[i] === "module" && parts[i + 1]) {
    i += 2;
  }
  const tailParts = parts.slice(i);
  const rtParts = resourceType.includes(".")
    ? resourceType.split(".")
    : [resourceType];
  if (
    tailParts.length >= rtParts.length + 1 &&
    rtParts.every((seg, j) => tailParts[j] === seg)
  ) {
    return tailParts.slice(rtParts.length).join(".") || address;
  }
  return tailParts[tailParts.length - 1] || address;
}

/**
 * Multi-line label for Terraform resource cards (local import): dotted module path, then
 * `type.displayName` with `displayName` from plan `name` when set, else parsed from the address.
 */
export function terraformResourceCardLabel(
  address: string,
  resource?: Record<string, unknown> | null,
): string {
  const resourceType = getTerraformCardResourceType(address, resource);
  const planNameRaw = resource?.name;
  const planName =
    typeof planNameRaw === "string" && planNameRaw.trim().length > 0
      ? planNameRaw.trim()
      : null;
  const displayName = planName ?? displayNameFromAddress(address, resourceType);

  const parts = address.split(".");
  const moduleParts: string[] = [];
  let mi = 0;
  while (mi < parts.length && parts[mi] === "module" && parts[mi + 1]) {
    moduleParts.push(parts[mi + 1]!);
    mi += 2;
  }

  const lines: string[] = [];
  if (moduleParts.length > 0) {
    lines.push(truncateLine(moduleParts.join(".")));
  }
  lines.push(truncateLine(`${resourceType}.${displayName}`));
  return lines.join("\n");
}

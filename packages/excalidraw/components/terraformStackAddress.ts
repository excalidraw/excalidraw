/**
 * Synthetic stack namespace for multi-root Terraform imports.
 * Format: `{stackId}::{terraformAddress}`
 */

export const STACK_ADDRESS_SEP = "::";

const STACK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isValidStackId(stackId: string): boolean {
  const trimmed = stackId.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes(STACK_ADDRESS_SEP) &&
    STACK_ID_PATTERN.test(trimmed)
  );
}

export function isStackQualifiedAddress(address: string): boolean {
  return parseStackAddress(address) != null;
}

export function prefixStackAddress(stackId: string, address: string): string {
  const trimmedStack = stackId.trim();
  const trimmedAddress = address.trim();
  if (!isValidStackId(trimmedStack) || !trimmedAddress) {
    return address;
  }
  if (isStackQualifiedAddress(trimmedAddress)) {
    const parsed = parseStackAddress(trimmedAddress);
    if (parsed?.stackId === trimmedStack) {
      return trimmedAddress;
    }
  }
  return `${trimmedStack}${STACK_ADDRESS_SEP}${trimmedAddress}`;
}

export function parseStackAddress(
  full: string,
): { stackId: string; address: string } | null {
  const trimmed = full.trim();
  const sepIndex = trimmed.indexOf(STACK_ADDRESS_SEP);
  if (sepIndex <= 0) {
    return null;
  }
  const stackId = trimmed.slice(0, sepIndex);
  const address = trimmed.slice(sepIndex + STACK_ADDRESS_SEP.length);
  if (!isValidStackId(stackId) || !address) {
    return null;
  }
  return { stackId, address };
}

/** Strip stack prefix before Terraform module-path parsing (`module.foo.bar`). */
export function stripStackPrefixForModuleParsing(address: string): string {
  return parseStackAddress(address)?.address ?? address;
}

export function stackIdFromBundleLabel(
  label: string | undefined,
  index: number,
): string {
  const trimmed = label?.trim();
  if (trimmed && isValidStackId(trimmed)) {
    return trimmed;
  }
  return `stack-${index + 1}`;
}

export function collectKnownStackIdsFromNodes(
  nodes: Record<string, unknown>,
): string[] {
  const stackIds = new Set<string>();
  for (const key of Object.keys(nodes)) {
    const parsed = parseStackAddress(key);
    if (parsed) {
      stackIds.add(parsed.stackId);
    }
  }
  return [...stackIds];
}

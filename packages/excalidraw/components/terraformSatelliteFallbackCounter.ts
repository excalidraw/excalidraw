/**
 * Standalone fallback-usage counter for the `nodesByType` index optimization (TODO-3).
 *
 * Kept in its own dependency-free module rather than inside
 * `terraformTopologySatelliteEngine.ts` so the satellite link files (which need to call
 * `recordNodesByTypeFallbackScan()` from their own scan sites) can import it without
 * creating an import cycle — the engine module already value-imports from several link
 * files (e.g. `mergeTerraformPlanResourceValues` from `terraformTopologyIamLinks.ts`).
 */

let fallbackScanCount = 0;

/**
 * Call from a scan site when it falls back to `Object.keys(nodes)` despite `nodesByType`
 * being supplied to the enclosing call — i.e. the index existed but this specific site
 * never received it. Proves the *complexity* claim (not just correctness): a
 * correctness-only equivalence check would still pass even if a site silently kept doing
 * the full O(N) scan.
 */
export function recordNodesByTypeFallbackScan(): void {
  fallbackScanCount += 1;
}

export function resetFallbackScanCount(): void {
  fallbackScanCount = 0;
}

export function getFallbackScanCount(): number {
  return fallbackScanCount;
}

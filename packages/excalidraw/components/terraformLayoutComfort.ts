/**
 * Single multiplier for Terraform ELK + topology canvas density (margins, card sizes, gaps).
 * Bump to add more whitespace; 1 matches legacy pixel values passed into {@link tfComfortPx}.
 */
export const TERRAFORM_LAYOUT_COMFORT_SCALE = 1.35;

export function tfComfortPx(n: number): number {
  return Math.round(n * TERRAFORM_LAYOUT_COMFORT_SCALE);
}

/** Label font sizes after scaling stay readable on high-DPI zoom-out. */
export function tfComfortFontSize(n: number): number {
  return Math.max(8, Math.round(n * TERRAFORM_LAYOUT_COMFORT_SCALE));
}

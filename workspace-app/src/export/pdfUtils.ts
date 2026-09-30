/** Pure helpers shared by the exporters (kept free of heavy imports so they are trivially testable). */

/**
 * Unscaled content size in px. `width`/`height` attributes include the editor's
 * export scale (2x by default), which would silently double PDF page sizes.
 */
export const pageSizeFromSvg = (svg: Element) => {
  const vb = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    vb.length === 4 &&
    vb.every(Number.isFinite) &&
    vb[2]! > 0 &&
    vb[3]! > 0
  ) {
    return { widthPx: vb[2]!, heightPx: vb[3]! };
  }
  return {
    widthPx: parseFloat(svg.getAttribute("width") ?? "0") || 1,
    heightPx: parseFloat(svg.getAttribute("height") ?? "0") || 1,
  };
};

export const safeFileName = (name: string, ext: string) => {
  // drop path separators, reserved characters and control characters
  const cleaned = Array.from(name || "scene")
    .map((c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? "-" : c))
    .join("")
    .trim()
    .slice(0, 100);
  return `${cleaned || "scene"}.${ext}`;
};

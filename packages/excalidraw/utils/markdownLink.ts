/**
 * Markdown-style inline link parser for Excalidraw text elements.
 *
 * ## What this module does (Option A — safe, minimal)
 *
 * When a user finishes editing a text element whose entire content is a
 * single markdown link  `[label](url)`, we:
 *   1. Extract the visible label and the URL.
 *   2. Replace the element's display text with just the label.
 *   3. Set `element.link` to the extracted URL (the existing hyperlink field).
 *
 * This reuses the battle-tested hyperlink system (link icon, tooltip, Cmd+K
 * editing, onLinkOpen callback, sanitize-url, undo/redo) without any new
 * infrastructure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ## Why not full inline rendering (Option B)?
 *
 * True inline clickable links inside canvas text would require:
 *
 *  1. **Rich text layer** — The canvas 2D API (`fillText`) has no concept of
 *     hyperlinks. We'd need to split each text line into "runs", measure every
 *     run individually, and overlay transparent DOM hit-areas (or an SVG layer)
 *     that are kept in sync with zoom / scroll / rotation transforms.
 *     Estimated new files: ~6–8 (tokenizer, run renderer, hit-area manager,
 *     updated renderElement, updated textMeasurements, updated textWrapping).
 *
 *  2. **Multiple links per element** — The current `element.link: string | null`
 *     field only holds a single URL. Multi-link text needs a new
 *     `inlineLinks: { start, end, url }[]` field, versioning, restore.ts
 *     passthrough, serialisation tests, and collab delta handling.
 *
 *  3. **Editing UX** — The wysiwyg textarea would need to show raw markdown
 *     syntax while editing but rendered anchors while viewing, requiring a
 *     contenteditable-based editor (or a custom overlay).
 *
 *  4. **Export** — SVG/PNG export would need to emit `<a>` tags or styled
 *     text spans, which currently export via a flat canvas draw call.
 *
 *  5. **Accessibility** — Screen-reader traversal of canvas is not supported;
 *     inline links need ARIA live-regions or a parallel DOM structure.
 *
 * Rough estimate for Option B: ~15 files changed, 600–900 lines, 3–5 days
 * of engineering, significant design/API review before merging.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { normalizeLink } from "@excalidraw/common";

/**
 * Regex that matches a *complete* markdown link occupying the whole text:
 *   `[label](url)`
 *
 * Capturing groups:
 *   1 — label (the visible text, may be empty)
 *   2 — raw URL (before sanitisation)
 *
 * We intentionally only match when the pattern consumes the entire trimmed
 * string. Partial matches (e.g. "see [here](url) for details") are left as
 * plain text — they do not get auto-linked because that would silently mangle
 * the user's text.
 */
const FULL_MARKDOWN_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;

export interface ParsedMarkdownLink {
  /** The display label extracted from `[label](url)`. */
  label: string;
  /** The sanitised URL extracted from `[label](url)`. */
  url: string;
}

/**
 * If `text` is exactly a single markdown link `[label](url)`, returns the
 * parsed label and sanitised URL. Otherwise returns `null`.
 *
 * @example
 * parseMarkdownLink("[Excalidraw](https://excalidraw.com)")
 * // → { label: "Excalidraw", url: "https://excalidraw.com" }
 *
 * parseMarkdownLink("See [this](https://example.com) for details")
 * // → null  (partial match — not auto-linked)
 *
 * parseMarkdownLink("Hello world")
 * // → null
 */
export const parseMarkdownLink = (text: string): ParsedMarkdownLink | null => {
  const match = FULL_MARKDOWN_LINK_RE.exec(text.trim());
  if (!match) {
    return null;
  }

  const label = match[1].trim();
  const rawUrl = match[2].trim();

  if (!rawUrl) {
    return null;
  }

  const url = normalizeLink(rawUrl);

  // normalizeLink returns "about:blank" for malformed/dangerous URLs —
  // treat those as invalid so we don't silently set a bad link.
  if (!url || url === "about:blank") {
    return null;
  }

  return { label: label || rawUrl, url };
};

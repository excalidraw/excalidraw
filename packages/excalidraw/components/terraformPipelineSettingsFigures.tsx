import React from "react";

import type { OptionHelpKey } from "./TerraformImportPipelineSettings";

/**
 * Decorative before/after schematics for the RCLL pipeline-settings side panel.
 *
 * Each geometry toggle option (`OPTION_HELP` key) maps to a tiny diagram that
 * shows what the option does to the layout — the height/width trade the honest
 * help copy describes. The diagrams are intentionally schematic (a few rects +
 * lines), NOT accurate renders: the goal is a gestalt of "taller vs shorter",
 * "one column vs two", "crossing vs straight".
 *
 * Everything routes through the single `<MiniDiagram>` primitive — there is no
 * bespoke per-option SVG markup, so renaming an option or restyling a tone is a
 * one-line config change, never a markup rewrite.
 *
 * A11y: the `<svg>` is `aria-hidden` (purely decorative). The help `<aside>` is
 * an `aria-live="polite"` region; the figures carry no text, so swapping them on
 * hover never announces — the live region keeps reading only the title + body.
 */

/** Local 0..60 (x) by 0..56 (y) coordinate space, per panel. */
type Tone = "a" | "b" | "muted";

type Box = { x: number; y: number; w: number; h: number; tone?: Tone };

type Line = { x1: number; y1: number; x2: number; y2: number; tone?: Tone };

/** A single layout state (the "before" or "after" half of a figure). */
type Panel = { boxes: Box[]; lines?: Line[] };

/** A figure is one baseline panel, or a `before → after` transform pair. */
type Figure = { before: Panel; after?: Panel };

const PANEL_W = 60;
const PANEL_H = 56;
const GAP = 18; // arrow channel between before/after panels

const toneFill: Record<Tone, string> = {
  a: "var(--color-gray-20)",
  b: "var(--color-primary-light)",
  muted: "var(--color-surface-low, var(--color-gray-10))",
};

const toneStroke: Record<Tone, string> = {
  a: "var(--color-gray-50)",
  b: "var(--color-primary)",
  muted: "var(--color-gray-40)",
};

const renderPanel = (panel: Panel, dx: number): React.ReactNode => (
  <g transform={`translate(${dx} 0)`}>
    {panel.boxes.map((b, i) => (
      <rect
        key={`b${i}`}
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx={1.5}
        fill={toneFill[b.tone ?? "a"]}
        stroke={toneStroke[b.tone ?? "a"]}
        strokeWidth={1}
      />
    ))}
    {panel.lines?.map((l, i) => (
      <line
        key={`l${i}`}
        x1={l.x1}
        y1={l.y1}
        x2={l.x2}
        y2={l.y2}
        stroke={toneStroke[l.tone ?? "b"]}
        strokeWidth={1.25}
      />
    ))}
  </g>
);

/** The one and only figure renderer. */
const MiniDiagram = ({ figure }: { figure: Figure }) => {
  const hasAfter = figure.after != null;
  const width = hasAfter ? PANEL_W * 2 + GAP : PANEL_W;
  const arrowX = PANEL_W + GAP / 2;
  return (
    <svg
      className="TerraformImportModal__layoutHelpFigureSvg"
      viewBox={`0 0 ${width} ${PANEL_H}`}
      width="100%"
      height="58"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {renderPanel(figure.before, 0)}
      {hasAfter && (
        <>
          <line
            x1={arrowX - 5}
            y1={PANEL_H / 2}
            x2={arrowX + 5}
            y2={PANEL_H / 2}
            stroke="var(--tf-muted)"
            strokeWidth={1.25}
          />
          <path
            d={`M ${arrowX + 5} ${PANEL_H / 2} l -3 -2.5 v 5 z`}
            fill="var(--tf-muted)"
          />
          {renderPanel(figure.after!, PANEL_W + GAP)}
        </>
      )}
    </svg>
  );
};

// --- figure helpers (shared shapes, kept DRY) --------------------------------

const CARD_W = 16;
const CARD_H = 9;

/** A vertical stack of `n` cards in one column at `x`, top at `y0`. */
const column = (x: number, y0: number, n: number, tone: Tone = "b"): Box[] =>
  Array.from({ length: n }, (_, i) => ({
    x,
    y: y0 + i * (CARD_H + 3),
    w: CARD_W,
    h: CARD_H,
    tone,
  }));

/** A grid of `cols` columns × `rows` rows of cards — the "risen/packed" shape. */
const grid = (
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  tone: Tone = "b",
): Box[] => {
  const out: Box[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      out.push({
        x: x0 + c * (CARD_W + 4),
        y: y0 + r * (CARD_H + 3),
        w: CARD_W,
        h: CARD_H,
        tone,
      });
    }
  }
  return out;
};

// --- per-option figures ------------------------------------------------------
//
// Keyed by the same vocabulary as OPTION_HELP. Baseline arms ("off"/"stacked"/
// "boxed") show a single state; the transform arms show before → after so the
// height (and width) trade is visible.

const FIGURES: Partial<Record<OptionHelpKey, Figure>> = {
  // STRUCTURE — Subnets
  "subnet.boxed": {
    before: {
      boxes: [
        { x: 4, y: 3, w: 52, h: 15, tone: "muted" },
        { x: 4, y: 21, w: 52, h: 15, tone: "muted" },
        { x: 4, y: 39, w: 52, h: 14, tone: "muted" },
        ...[6, 24, 42].map((y) => ({
          x: 8,
          y,
          w: CARD_W,
          h: CARD_H,
          tone: "b" as Tone,
        })),
        ...[6, 24, 42].map((y) => ({
          x: 30,
          y,
          w: CARD_W,
          h: CARD_H,
          tone: "b" as Tone,
        })),
      ],
    },
  },
  "subnet.debanded": {
    before: {
      boxes: [
        { x: 4, y: 3, w: 52, h: 15, tone: "muted" },
        { x: 4, y: 21, w: 52, h: 15, tone: "muted" },
        { x: 4, y: 39, w: 52, h: 14, tone: "muted" },
      ],
    },
    after: {
      boxes: [
        // one shared stack, each card with a colored tier rail on the left
        ...column(18, 8, 3, "b"),
        { x: 14, y: 8, w: 2.5, h: CARD_H, tone: "a" },
        { x: 14, y: 20, w: 2.5, h: CARD_H, tone: "b" },
        { x: 14, y: 32, w: 2.5, h: CARD_H, tone: "muted" },
      ],
    },
  },

  // COLUMNS — Lane split
  "lanesplit.off": {
    before: {
      // two dependent lanes piled into the same columns (overlap → tall)
      boxes: [
        ...column(22, 3, 4, "a"),
        ...column(22, 3, 4, "b").map((b) => ({ ...b, x: 26 })),
      ],
    },
  },
  "lanesplit.on": {
    before: { boxes: column(22, 3, 4, "b") },
    after: {
      // lanes pushed into disjoint columns → wider but shorter
      boxes: [...grid(8, 14, 2, 2, "b")],
    },
  },

  // COLUMNS — Column spread
  "columnspread.off": {
    before: { boxes: column(22, 1, 5, "b") },
  },
  "columnspread.on": {
    before: { boxes: column(22, 1, 5, "b") },
    after: {
      boxes: [
        ...column(14, 6, 3, "b"),
        // independent cards promoted one column right
        { x: 36, y: 9, w: CARD_W, h: CARD_H, tone: "a" },
        { x: 36, y: 27, w: CARD_W, h: CARD_H, tone: "a" },
      ],
    },
  },

  // ORDERING — crossing reduction
  "ordering.off": {
    before: {
      boxes: [...column(4, 8, 2, "b"), ...column(40, 8, 2, "b")],
      lines: [
        { x1: 20, y1: 12, x2: 40, y2: 32 },
        { x1: 20, y1: 32, x2: 40, y2: 12 },
      ],
    },
  },
  "ordering.on": {
    before: {
      boxes: [...column(4, 8, 2, "b"), ...column(40, 8, 2, "b")],
      lines: [
        { x1: 20, y1: 12, x2: 40, y2: 32 },
        { x1: 20, y1: 32, x2: 40, y2: 12 },
      ],
    },
    after: {
      boxes: [...column(4, 8, 2, "b"), ...column(40, 8, 2, "b")],
      lines: [
        { x1: 20, y1: 12, x2: 40, y2: 12 },
        { x1: 20, y1: 32, x2: 40, y2: 32 },
      ],
    },
  },

  // VERTICAL — Lane height
  "laneheight.stacked": {
    before: { boxes: column(22, 1, 5, "b") },
  },
  "laneheight.risen": {
    before: { boxes: column(22, 1, 5, "b") },
    after: { boxes: grid(8, 14, 2, 2, "b") },
  },

  // VERTICAL — Cycle height
  "cycleheight.stacked": {
    before: {
      boxes: [...column(22, 1, 2, "b"), ...column(22, 25, 2, "a")],
    },
  },
  "cycleheight.risen": {
    before: {
      boxes: [...column(22, 1, 2, "b"), ...column(22, 25, 2, "a")],
    },
    after: {
      boxes: [...column(10, 18, 2, "b"), ...column(34, 18, 2, "a")],
    },
  },

  // VERTICAL — Straighten
  "straighten.off": {
    before: {
      // hub fanning out to mis-aligned (zig-zag) neighbours
      boxes: [
        { x: 4, y: 23, w: CARD_W, h: CARD_H, tone: "b" },
        { x: 40, y: 4, w: CARD_W, h: CARD_H, tone: "a" },
        { x: 40, y: 23, w: CARD_W, h: CARD_H, tone: "a" },
        { x: 40, y: 42, w: CARD_W, h: CARD_H, tone: "a" },
      ],
      lines: [
        { x1: 20, y1: 27, x2: 40, y2: 8 },
        { x1: 20, y1: 27, x2: 40, y2: 27 },
        { x1: 20, y1: 27, x2: 40, y2: 46 },
      ],
    },
  },
  "straighten.on": {
    before: {
      boxes: [
        { x: 4, y: 23, w: CARD_W, h: CARD_H, tone: "b" },
        { x: 40, y: 4, w: CARD_W, h: CARD_H, tone: "a" },
        { x: 40, y: 23, w: CARD_W, h: CARD_H, tone: "a" },
        { x: 40, y: 42, w: CARD_W, h: CARD_H, tone: "a" },
      ],
      lines: [
        { x1: 20, y1: 27, x2: 40, y2: 8 },
        { x1: 20, y1: 27, x2: 40, y2: 27 },
        { x1: 20, y1: 27, x2: 40, y2: 46 },
      ],
    },
    after: {
      // neighbours aligned into one flat spine row
      boxes: [
        { x: 4, y: 23, w: CARD_W, h: CARD_H, tone: "b" },
        ...Array.from({ length: 3 }, (_, i) => ({
          x: 30 + i * (CARD_W + 2),
          y: 23,
          w: CARD_W,
          h: CARD_H,
          tone: "a" as Tone,
        })),
      ],
      lines: [{ x1: 20, y1: 27, x2: 30, y2: 27 }],
    },
  },
};

/**
 * The figure for an option, or null when the option has no geometry to show
 * (content filters like Detail / Resources). The settings panel renders this in
 * the help aside above the body.
 */
export const renderOptionFigure = (
  key: OptionHelpKey,
): React.ReactNode | null => {
  const figure = FIGURES[key];
  return figure ? <MiniDiagram figure={figure} /> : null;
};

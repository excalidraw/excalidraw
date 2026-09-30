/**
 * Deterministic Mermaid -> Excalidraw conversion for the API / MCP (no AI, no DOM).
 * Supports flowcharts (`flowchart` / `graph`); other diagram types are converted by the
 * editor's own Mermaid dialog in the browser.
 */
export class UnsupportedDiagramError extends Error {}
export class MermaidSyntaxError extends Error {}

type Shape = "rect" | "round" | "stadium" | "ellipse" | "diamond";
type Dir = "TD" | "LR" | "BT" | "RL";

interface NodeDef {
  id: string;
  label: string;
  shape: Shape;
}
interface EdgeDef {
  from: string;
  to: string;
  label: string;
  style: "solid" | "dashed" | "thick";
  arrow: boolean;
  bothWays: boolean;
}
export interface FlowGraph {
  dir: Dir;
  nodes: Map<string, NodeDef>;
  edges: EdgeDef[];
}

const MAX_NODES = 300;

const cleanLabel = (raw: string) =>
  raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

// A node reference: id followed by an optional shape wrapper.
const NODE_RE =
  /^([A-Za-z0-9_À-￿]+(?:[.-][A-Za-z0-9_À-￿]+)*)(?:\s*(\(\(.*?\)\)|\(\[.*?\]\)|\[\[.*?\]\]|\[\(.*?\)\]|\{\{.*?\}\}|\[.*?\]|\(.*?\)|\{.*?\}|>.*?\]))?/s;

const shapeOf = (
  wrapped: string | undefined,
): { shape: Shape; label: string | null } => {
  if (!wrapped) {
    return { shape: "rect", label: null };
  }
  const pairs: Array<[string, string, Shape]> = [
    ["((", "))", "ellipse"],
    ["([", "])", "stadium"],
    ["[[", "]]", "rect"],
    ["[(", ")]", "round"],
    ["{{", "}}", "diamond"],
    ["[", "]", "rect"],
    ["(", ")", "round"],
    ["{", "}", "diamond"],
    [">", "]", "rect"],
  ];
  for (const [open, close, shape] of pairs) {
    if (wrapped.startsWith(open) && wrapped.endsWith(close)) {
      return {
        shape,
        label: cleanLabel(
          wrapped.slice(open.length, wrapped.length - close.length),
        ),
      };
    }
  }
  return { shape: "rect", label: null };
};

// link operators, longest first
const LINK_RE =
  /^\s*(<)?(?:(-\.+->|-\.+-|--[ox](?=\s|$)|={2,}>?|-{2,}>?|~~~)\s*(?:\|([^|]*)\|)?)/;
const LABELLED_LINK_RE =
  /^\s*(<)?(--|==|-\.)\s+([^->=.|][^|]*?)\s+(-->|---|==>|===|\.->|-\.->|--[ox])/;

export const parseFlowchart = (source: string): FlowGraph => {
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/%%.*$/, "").trim())
    .filter(Boolean);
  const header = /^(flowchart|graph)\s*(TD|TB|LR|RL|BT)?\s*;?$/i.exec(
    lines[0] ?? "",
  );
  if (!header) {
    const first = (lines[0] ?? "").split(/\s+/)[0] ?? "";
    if (
      /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline)/i.test(
        first,
      )
    ) {
      throw new UnsupportedDiagramError(
        `Server-side conversion supports flowcharts only; "${first}" diagrams are converted by the editor's Mermaid dialog.`,
      );
    }
    throw new MermaidSyntaxError(
      'Expected a diagram starting with "flowchart" or "graph".',
    );
  }
  const dirRaw = (header[2] ?? "TD").toUpperCase();
  const dir: Dir = dirRaw === "TB" ? "TD" : (dirRaw as Dir);
  const nodes = new Map<string, NodeDef>();
  const edges: EdgeDef[] = [];

  const declare = (id: string, wrapped?: string): string => {
    const { shape, label } = shapeOf(wrapped);
    const existing = nodes.get(id);
    if (!existing) {
      if (nodes.size >= MAX_NODES) {
        throw new MermaidSyntaxError(`Too many nodes (limit ${MAX_NODES}).`);
      }
      nodes.set(id, { id, label: label ?? id, shape });
    } else if (label !== null) {
      existing.label = label;
      existing.shape = shape;
    }
    return id;
  };

  const readNodeGroup = (s: string): { ids: string[]; rest: string } => {
    const ids: string[] = [];
    let rest = s.trim();
    for (;;) {
      const m = NODE_RE.exec(rest);
      if (!m) {
        throw new MermaidSyntaxError(`Cannot parse "${rest.slice(0, 40)}".`);
      }
      ids.push(declare(m[1]!, m[2]));
      rest = rest.slice(m[0].length).trim();
      if (rest.startsWith("&")) {
        rest = rest.slice(1).trim();
        continue;
      }
      return { ids, rest };
    }
  };

  const IGNORED =
    /^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr|title)\b/i;
  for (const rawLine of lines.slice(1)) {
    for (const stmt of rawLine
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (
        IGNORED.test(stmt) ||
        /^end$/i.test(stmt) ||
        /^subgraph\b/i.test(stmt)
      ) {
        continue; // grouping/styling is cosmetic: nodes inside subgraphs are still drawn
      }
      let { ids: left, rest } = readNodeGroup(stmt);
      while (rest) {
        let label = "";
        let style: EdgeDef["style"] = "solid";
        let arrow = true;
        let both = false;
        const lab = LABELLED_LINK_RE.exec(rest);
        if (lab) {
          both = !!lab[1];
          label = cleanLabel(lab[3]!);
          const op = lab[4]!;
          style = op.startsWith("=")
            ? "thick"
            : op.includes(".")
            ? "dashed"
            : "solid";
          arrow = /[>ox]$/.test(op);
          rest = rest.slice(lab[0].length).trim();
        } else {
          const m = LINK_RE.exec(rest);
          if (!m) {
            throw new MermaidSyntaxError(
              `Cannot parse link near "${rest.slice(0, 30)}".`,
            );
          }
          both = !!m[1];
          const op = m[2]!;
          style = op.startsWith("=")
            ? "thick"
            : op.includes(".")
            ? "dashed"
            : "solid";
          arrow = /[>ox]$/.test(op);
          label = m[3] ? cleanLabel(m[3]) : "";
          rest = rest.slice(m[0].length).trim();
        }
        const right = readNodeGroup(rest);
        for (const a of left) {
          for (const b of right.ids) {
            edges.push({ from: a, to: b, label, style, arrow, bothWays: both });
          }
        }
        left = right.ids;
        rest = right.rest;
      }
    }
  }
  if (nodes.size === 0) {
    throw new MermaidSyntaxError("The diagram has no nodes.");
  }
  return { dir, nodes, edges };
};

// ------------------------------------------------------------------------------ layout

const FONT = 20;
const LINE_H = FONT * 1.25;
const CHAR_W = FONT * 0.56;
const RANK_GAP = 90;
const NODE_GAP = 50;

interface Placed extends NodeDef {
  w: number;
  h: number;
  x: number;
  y: number;
  rank: number;
  order: number;
}

const sizeOf = (n: NodeDef) => {
  const lines = n.label.split("\n");
  const textW = Math.max(...lines.map((l) => l.length)) * CHAR_W;
  const textH = lines.length * LINE_H;
  let w = Math.max(110, textW + 36);
  let h = Math.max(54, textH + 26);
  if (n.shape === "diamond") {
    w = Math.max(140, textW * 1.7 + 30);
    h = Math.max(90, textH * 1.9 + 30);
  } else if (n.shape === "ellipse") {
    w = Math.max(120, textW * 1.35 + 30);
    h = Math.max(70, textH * 1.5 + 26);
  }
  return { w: Math.ceil(w), h: Math.ceil(h) };
};

/** Layered layout: cycle-safe longest-path ranking + barycenter ordering. */
export const layout = (g: FlowGraph) => {
  const ids = [...g.nodes.keys()];
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  const inn = new Map<string, string[]>(ids.map((i) => [i, []]));
  // drop back edges (found by DFS) so ranking terminates on cyclic graphs
  const state = new Map<string, 0 | 1 | 2>();
  const dag: Array<[string, string]> = [];
  const adj = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of g.edges) {
    if (e.from !== e.to) {
      adj.get(e.from)!.push(e.to);
    }
  }
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of adj.get(u)!) {
      if (state.get(v) === 1) {
        continue; // back edge
      }
      dag.push([u, v]);
      if (!state.get(v)) {
        dfs(v);
      }
    }
    state.set(u, 2);
  };
  for (const id of ids) {
    if (!state.get(id)) {
      dfs(id);
    }
  }
  for (const [u, v] of dag) {
    out.get(u)!.push(v);
    inn.get(v)!.push(u);
  }
  const rank = new Map<string, number>();
  const rankOf = (id: string): number => {
    const cached = rank.get(id);
    if (cached !== undefined) {
      return cached;
    }
    rank.set(id, 0);
    const r = inn.get(id)!.length
      ? 1 + Math.max(...inn.get(id)!.map(rankOf))
      : 0;
    rank.set(id, r);
    return r;
  };
  ids.forEach(rankOf);

  const layers: string[][] = [];
  for (const id of ids) {
    (layers[rank.get(id)!] ??= []).push(id);
  }
  const pos = new Map<string, number>();
  layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  const bary = (id: string, neighbours: string[]) =>
    neighbours.length
      ? neighbours.reduce((s, n) => s + pos.get(n)!, 0) / neighbours.length
      : pos.get(id)!;
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    const seq = down ? layers : [...layers].reverse();
    for (const layer of seq) {
      layer.sort(
        (a, b) =>
          bary(a, down ? inn.get(a)! : out.get(a)!) -
          bary(b, down ? inn.get(b)! : out.get(b)!),
      );
      layer.forEach((id, i) => pos.set(id, i));
    }
  }

  const horizontal = g.dir === "LR" || g.dir === "RL";
  const placed = new Map<string, Placed>();
  let cursor = 0; // along the rank axis
  const layerExtent: number[] = [];
  for (const layer of layers) {
    const sizes = layer.map((id) => sizeOf(g.nodes.get(id)!));
    const rankThickness = Math.max(
      ...sizes.map((s) => (horizontal ? s.w : s.h)),
    );
    const total =
      sizes.reduce((s, z) => s + (horizontal ? z.h : z.w), 0) +
      NODE_GAP * (layer.length - 1);
    let across = -total / 2;
    const rankStart = cursor;
    layer.forEach((id, i) => {
      const s = sizes[i]!;
      const along = rankStart + (rankThickness - (horizontal ? s.w : s.h)) / 2;
      const n = g.nodes.get(id)!;
      placed.set(id, {
        ...n,
        ...s,
        x: horizontal ? along : across,
        y: horizontal ? across : along,
        rank: rank.get(id)!,
        order: i,
      });
      across += (horizontal ? s.h : s.w) + NODE_GAP;
    });
    layerExtent.push(rankThickness);
    cursor += rankThickness + RANK_GAP;
  }
  // BT / RL mirror the rank axis
  if (g.dir === "BT" || g.dir === "RL") {
    const max = cursor - RANK_GAP;
    for (const p of placed.values()) {
      if (horizontal) {
        p.x = max - p.x - p.w;
      } else {
        p.y = max - p.y - p.h;
      }
    }
  }
  return placed;
};

// ------------------------------------------------------------------------ element emit

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Ordered fractional-index style keys ("a0".."aZ", "b00"...), valid for Excalidraw's `index`. */
export const indexKey = (n: number): string => {
  let len = 1;
  let base = 0;
  let span = 62;
  while (n >= base + span) {
    base += span;
    span *= 62;
    len++;
  }
  let v = n - base;
  let digits = "";
  for (let i = 0; i < len; i++) {
    digits = B62[v % 62]! + digits;
    v = Math.floor(v / 62);
  }
  return String.fromCharCode("a".charCodeAt(0) + len - 1) + digits;
};

const rnd = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
};

const PALETTE: Record<Shape, string> = {
  rect: "#a5d8ff",
  round: "#b2f2bb",
  stadium: "#d0bfff",
  ellipse: "#ffec99",
  diamond: "#ffc9c9",
};

const edgePoint = (p: Placed, toward: { x: number; y: number }) => {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }
  let t: number;
  if (p.shape === "ellipse") {
    t = 1 / Math.sqrt((dx / (p.w / 2)) ** 2 + (dy / (p.h / 2)) ** 2);
  } else if (p.shape === "diamond") {
    t = 1 / (Math.abs(dx) / (p.w / 2) + Math.abs(dy) / (p.h / 2));
  } else {
    t = Math.min(
      dx !== 0 ? p.w / 2 / Math.abs(dx) : Infinity,
      dy !== 0 ? p.h / 2 / Math.abs(dy) : Infinity,
    );
  }
  return { x: cx + dx * t, y: cy + dy * t };
};

export interface ConvertOptions {
  /** scene-space top-left of the generated diagram */
  origin?: { x: number; y: number };
  /** id prefix so repeated conversions never collide */
  idPrefix?: string;
  seed?: number;
  /** fractional-index offset when appending to an existing scene */
  indexStart?: number;
}

export const mermaidToElements = (
  source: string,
  opts: ConvertOptions = {},
) => {
  const graph = parseFlowchart(source);
  const placed = layout(graph);
  const origin = opts.origin ?? { x: 0, y: 0 };
  const prefix = opts.idPrefix ?? "mm";
  const next = rnd(opts.seed ?? 1);
  let idx = opts.indexStart ?? 0;
  const now = Date.now();
  const common = () => ({
    angle: 0,
    strokeColor: "#1e1e1e",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null,
    seed: next(),
    version: 1,
    versionNonce: next(),
    isDeleted: false,
    updated: now,
    link: null,
    locked: false,
    index: indexKey(idx++),
  });

  const elements: any[] = [];
  const shapeId = (id: string) => `${prefix}-n-${id}`;
  const shapeEls = new Map<string, any>();

  for (const p of placed.values()) {
    const el = {
      ...common(),
      id: shapeId(p.id),
      type:
        p.shape === "ellipse"
          ? "ellipse"
          : p.shape === "diamond"
          ? "diamond"
          : "rectangle",
      x: origin.x + p.x,
      y: origin.y + p.y,
      width: p.w,
      height: p.h,
      backgroundColor: PALETTE[p.shape],
      roundness:
        p.shape === "round" || p.shape === "stadium"
          ? { type: 3 }
          : p.shape === "rect"
          ? null
          : { type: 2 },
      boundElements: [] as Array<{ id: string; type: "text" | "arrow" }>,
    };
    if (p.shape === "rect") {
      el.roundness = null;
    }
    shapeEls.set(p.id, el);
    elements.push(el);
    const lines = p.label.split("\n");
    const tw = Math.max(...lines.map((l) => l.length)) * CHAR_W;
    const th = lines.length * LINE_H;
    const textEl = {
      ...common(),
      id: `${prefix}-t-${p.id}`,
      type: "text",
      x: el.x + (p.w - tw) / 2,
      y: el.y + (p.h - th) / 2,
      width: tw,
      height: th,
      backgroundColor: "transparent",
      roundness: null,
      boundElements: null,
      text: p.label,
      originalText: p.label,
      fontSize: FONT,
      fontFamily: 5,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: el.id,
      autoResize: true,
      lineHeight: 1.25,
    };
    el.boundElements.push({ id: textEl.id, type: "text" });
    elements.push(textEl);
  }

  graph.edges.forEach((e, i) => {
    const a = placed.get(e.from)!;
    const b = placed.get(e.to)!;
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    let start = edgePoint(a, cb);
    let end = edgePoint(b, ca);
    if (e.from === e.to) {
      // self loop: a small hook on the right side
      start = { x: a.x + a.w, y: ca.y - 8 };
      end = { x: a.x + a.w, y: ca.y + 8 };
    }
    const arrow: any = {
      ...common(),
      id: `${prefix}-e-${i}`,
      type: "arrow",
      x: origin.x + start.x,
      y: origin.y + start.y,
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
      backgroundColor: "transparent",
      strokeStyle: e.style === "dashed" ? "dashed" : "solid",
      strokeWidth: e.style === "thick" ? 4 : 2,
      roundness: { type: 2 },
      boundElements: [] as Array<{ id: string; type: "text" }>,
      points:
        e.from === e.to
          ? [
              [0, 0],
              [40, -8],
              [40, 24],
              [0, 16],
            ]
          : [
              [0, 0],
              [end.x - start.x, end.y - start.y],
            ],
      lastCommittedPoint: null,
      startBinding: { elementId: shapeId(e.from), focus: 0, gap: 4 },
      endBinding: { elementId: shapeId(e.to), focus: 0, gap: 4 },
      startArrowhead: e.bothWays ? "arrow" : null,
      endArrowhead: e.arrow ? "arrow" : null,
      elbowed: false,
    };
    shapeEls.get(e.from).boundElements.push({ id: arrow.id, type: "arrow" });
    if (e.to !== e.from) {
      shapeEls.get(e.to).boundElements.push({ id: arrow.id, type: "arrow" });
    }
    elements.push(arrow);
    if (e.label) {
      const lines = e.label.split("\n");
      const tw = Math.max(...lines.map((l) => l.length)) * CHAR_W * 0.9;
      const th = lines.length * LINE_H * 0.9;
      const label = {
        ...common(),
        id: `${prefix}-l-${i}`,
        type: "text",
        x: origin.x + (start.x + end.x) / 2 - tw / 2,
        y: origin.y + (start.y + end.y) / 2 - th / 2,
        width: tw,
        height: th,
        backgroundColor: "transparent",
        roundness: null,
        boundElements: null,
        text: e.label,
        originalText: e.label,
        fontSize: 16,
        fontFamily: 5,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: arrow.id,
        autoResize: true,
        lineHeight: 1.25,
      };
      arrow.boundElements.push({ id: label.id, type: "text" });
      elements.push(label);
    }
  });

  const xs = [...placed.values()].flatMap((p) => [p.x, p.x + p.w]);
  const ys = [...placed.values()].flatMap((p) => [p.y, p.y + p.h]);
  return {
    elements,
    bounds: {
      x: origin.x + Math.min(...xs),
      y: origin.y + Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
  };
};

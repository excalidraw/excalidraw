import { indexKey } from "./mermaid";

/**
 * Deterministic low-fidelity wireframes from a compact spec (no AI): a frame containing
 * stacked UI blocks. Meant for agents ("a login screen with two inputs and a button").
 */
export type BlockType =
  | "header"
  | "nav"
  | "hero"
  | "text"
  | "heading"
  | "button"
  | "input"
  | "image"
  | "card"
  | "list"
  | "footer"
  | "divider";

export interface Block {
  type: BlockType;
  label?: string;
  /** list rows / card lines */
  items?: string[];
  lines?: number;
}

export interface WireframeSpec {
  title?: string;
  device?: "mobile" | "tablet" | "desktop";
  blocks: Block[];
}

export const DEVICE_WIDTH = {
  mobile: 390,
  tablet: 768,
  desktop: 1200,
} as const;
const PAD = 16;
const GAP = 14;
const FONT = 16;
export const MAX_BLOCKS = 60;

const INK = "#343a40";
const MUTED = "#868e96";
const FILL = "#f1f3f5";
const FILL_STRONG = "#dee2e6";

export const blockHeight = (b: Block): number => {
  switch (b.type) {
    case "header":
      return 56;
    case "nav":
      return 48;
    case "hero":
      return 200;
    case "heading":
      return 36;
    case "text":
      return Math.max(1, Math.min(b.lines ?? 3, 12)) * 22;
    case "button":
    case "input":
      return 44;
    case "image":
      return 160;
    case "card":
      return 40 + Math.max(1, Math.min(b.items?.length ?? 2, 8)) * 24;
    case "list":
      return Math.max(1, Math.min(b.items?.length ?? 3, 20)) * 46 - 6;
    case "footer":
      return 64;
    case "divider":
      return 2;
  }
};

export const buildWireframe = (
  spec: WireframeSpec,
  opts: {
    origin?: { x: number; y: number };
    idPrefix?: string;
    indexStart?: number;
  } = {},
) => {
  const blocks = spec.blocks.slice(0, MAX_BLOCKS);
  const width = DEVICE_WIDTH[spec.device ?? "mobile"];
  const origin = opts.origin ?? { x: 0, y: 0 };
  const prefix = opts.idPrefix ?? "wf";
  let idx = opts.indexStart ?? 0;
  let n = 0;
  let seed = 7;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const now = Date.now();
  const elements: any[] = [];

  const base = (frameId: string | null) => ({
    angle: 0,
    strokeColor: INK,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [] as string[],
    frameId,
    roundness: null,
    seed: rnd(),
    version: 1,
    versionNonce: rnd(),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    index: indexKey(idx++),
  });

  const totalHeight =
    PAD + blocks.reduce((h, b) => h + blockHeight(b) + GAP, 0) + PAD - GAP;
  const frameId = `${prefix}-frame`;
  elements.push({
    ...base(null),
    id: frameId,
    type: "frame",
    name: spec.title?.trim() || "Wireframe",
    x: origin.x,
    y: origin.y,
    width,
    height: Math.max(totalHeight, 120),
    strokeColor: "#bbb",
    roundness: null,
  });

  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    extra: object = {},
  ) => {
    const el = {
      ...base(frameId),
      id: `${prefix}-${n++}`,
      type: "rectangle",
      x: origin.x + x,
      y: origin.y + y,
      width: w,
      height: h,
      ...extra,
    };
    elements.push(el);
    return el;
  };
  const text = (
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    extra: {
      size?: number;
      align?: string;
      color?: string;
      valign?: string;
    } = {},
  ) => {
    const size = extra.size ?? FONT;
    const tw = Math.min(w, label.length * size * 0.56);
    const align = extra.align ?? "center";
    const tx =
      align === "left" ? x : align === "right" ? x + w - tw : x + (w - tw) / 2;
    elements.push({
      ...base(frameId),
      id: `${prefix}-${n++}`,
      type: "text",
      x: origin.x + tx,
      y: origin.y + y + (h - size * 1.25) / (extra.valign === "top" ? 999 : 2),
      width: tw,
      height: size * 1.25,
      strokeColor: extra.color ?? INK,
      text: label,
      originalText: label,
      fontSize: size,
      fontFamily: 2,
      textAlign: align,
      verticalAlign: "middle",
      containerId: null,
      autoResize: true,
      lineHeight: 1.25,
    });
  };
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = MUTED,
  ) => {
    elements.push({
      ...base(frameId),
      id: `${prefix}-${n++}`,
      type: "line",
      x: origin.x + x1,
      y: origin.y + y1,
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      strokeColor: color,
      points: [
        [0, 0],
        [x2 - x1, y2 - y1],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    });
  };

  const w = width - PAD * 2;
  const draw = (b: Block, y: number) => {
    const h = blockHeight(b);
    const label = b.label?.slice(0, 80);
    switch (b.type) {
      case "header":
        rect(PAD, y, w, h, { backgroundColor: FILL_STRONG });
        text(label ?? "Header", PAD + 12, y, w - 24, h, {
          align: "left",
          size: 18,
        });
        break;
      case "nav": {
        rect(PAD, y, w, h, { backgroundColor: FILL });
        const items = b.items?.length
          ? b.items.slice(0, 6)
          : ["Home", "About", "Contact"];
        const cell = w / items.length;
        items.forEach((it, i) =>
          text(it, PAD + i * cell, y, cell, h, { size: 14 }),
        );
        break;
      }
      case "hero":
        rect(PAD, y, w, h, { backgroundColor: FILL_STRONG });
        text(label ?? "Hero", PAD, y, w, h, { size: 22 });
        break;
      case "heading":
        text(label ?? "Heading", PAD, y, w, h, { align: "left", size: 24 });
        break;
      case "text": {
        const lines = Math.max(1, Math.min(b.lines ?? 3, 12));
        for (let i = 0; i < lines; i++) {
          line(
            PAD,
            y + i * 22 + 11,
            PAD + (i === lines - 1 ? w * 0.6 : w),
            y + i * 22 + 11,
            "#adb5bd",
          );
        }
        break;
      }
      case "button":
        rect(PAD, y, w, h, {
          backgroundColor: INK,
          roundness: { type: 3 },
          strokeColor: INK,
        });
        text(label ?? "Button", PAD, y, w, h, { color: "#ffffff" });
        break;
      case "input":
        rect(PAD, y, w, h, { roundness: { type: 3 }, strokeColor: MUTED });
        text(label ?? "Input", PAD + 12, y, w - 24, h, {
          align: "left",
          color: MUTED,
          size: 15,
        });
        break;
      case "image":
        rect(PAD, y, w, h, { backgroundColor: FILL, strokeColor: MUTED });
        line(PAD, y, PAD + w, y + h);
        line(PAD + w, y, PAD, y + h);
        if (label) {
          text(label, PAD, y, w, h, { color: MUTED });
        }
        break;
      case "card": {
        rect(PAD, y, w, h, {
          roundness: { type: 3 },
          backgroundColor: "#ffffff",
        });
        text(label ?? "Card", PAD + 12, y + 8, w - 24, 24, {
          align: "left",
          size: 17,
        });
        (b.items?.length
          ? b.items.slice(0, 8)
          : ["Line one", "Line two"]
        ).forEach((it, i) =>
          text(it, PAD + 12, y + 40 + i * 24, w - 24, 22, {
            align: "left",
            size: 14,
            color: MUTED,
          }),
        );
        break;
      }
      case "list":
        (b.items?.length
          ? b.items.slice(0, 20)
          : ["Item 1", "Item 2", "Item 3"]
        ).forEach((it, i) => {
          rect(PAD, y + i * 46, w, 40, {
            backgroundColor: FILL,
            roundness: { type: 3 },
            strokeColor: "#ced4da",
          });
          text(it, PAD + 12, y + i * 46, w - 24, 40, {
            align: "left",
            size: 15,
          });
        });
        break;
      case "footer":
        rect(PAD, y, w, h, { backgroundColor: FILL_STRONG });
        text(label ?? "Footer", PAD, y, w, h, { size: 14, color: MUTED });
        break;
      case "divider":
        line(PAD, y + 1, PAD + w, y + 1, "#ced4da");
        break;
    }
  };

  let y = PAD;
  for (const b of blocks) {
    draw(b, y);
    y += blockHeight(b) + GAP;
  }
  return { elements, width, height: Math.max(totalHeight, 120), frameId };
};

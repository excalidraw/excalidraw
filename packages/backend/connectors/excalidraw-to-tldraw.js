/**
 * Excalidraw scene -> tldraw shape partials.
 *
 * This mirrors the original frontend converter behavior so backend and frontend
 * produce parity-compatible shape payloads.
 */

function toRichText(text) {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: text || "" }] },
    ],
  };
}

function slug(input) {
  return (
    String(input || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "shape"
  );
}

function stableShapeId(kind, sourceId) {
  return `shape:${kind}-${slug(sourceId)}`;
}

const HEX_TO_TLDRAW = [
  { test: /^#?(000|111|222|333)/i, color: "black" },
  { test: /^#?(444|555|666|777|888|999|aaa|bbb|ccc)/i, color: "grey" },
  { test: /red|#?(c[0-9a-f]{2}|d[0-9a-f]{2}|e[0-3])/i, color: "red" },
  { test: /orange|#?(f[58]|fa|fb)/i, color: "orange" },
  { test: /yellow|#?(fc|fd|fe|ff[a-c])/i, color: "yellow" },
  { test: /green|#?(0f|2f|3f|4f|5f)/i, color: "green" },
  { test: /violet|purple|#?(9[0-9a-f]|a[0-7])/i, color: "violet" },
  { test: /blue|#?(0[0-9a-f]{2}[5-9a-f]|1[0-9a-f][a-f])/i, color: "blue" },
];

function mapColor(hex) {
  if (!hex) {
    return "black";
  }
  for (const { test, color } of HEX_TO_TLDRAW) {
    if (test.test(hex)) {
      return color;
    }
  }
  return "grey";
}

function mapStrokeSize(strokeWidth) {
  if (!strokeWidth || strokeWidth <= 1) {
    return "s";
  }
  if (strokeWidth <= 2) {
    return "m";
  }
  if (strokeWidth <= 4) {
    return "l";
  }
  return "xl";
}

function mapExcalidrawTextAlignToTldraw(align) {
  switch (align) {
    case "left":
    case "start":
      return "start";
    case "center":
    case "middle":
      return "middle";
    case "right":
    case "end":
      return "end";
    default:
      return "start";
  }
}

function isContainerElement(el) {
  if (el.type !== "rectangle") {
    return false;
  }
  const cd = el.customData;
  return Boolean(cd && cd.container);
}

function extractTerraformMeta(el) {
  const cd = el.customData;
  if (!cd || typeof cd !== "object") {
    return undefined;
  }
  const keys = [
    "terraformVisibilityRole",
    "terraformVisibilityKey",
    "terraformInitiallyVisible",
    "terraformNodeKind",
    "terraformExplodeParent",
    "terraformExplodeParentKeys",
    "terraformGroupChildKeys",
    "terraformExploded",
    "terraformEdgeLayer",
    "relationship",
    "terraformCategoryId",
    "nodePath",
    "resourceType",
    "action",
  ];
  const meta = {};
  for (const key of keys) {
    if (key in cd) {
      meta[key] = cd[key];
    }
  }
  return Object.keys(meta).length ? meta : undefined;
}

function excalidrawSceneToTldrawShapes(scene) {
  const elements = (scene.elements || []).filter((el) => {
    if (!el.isDeleted) {
      return true;
    }
    // Keep soft-hidden Terraform elements so tldraw can drive explode/collapse
    // from the same graph semantics Excalidraw uses.
    const cd = el.customData;
    return Boolean(
      cd &&
        (cd.terraformVisibilityRole ||
          cd.terraformVisibilityKey ||
          cd.terraformEdgeLayer ||
          cd.relationship),
    );
  });
  const idMap = new Map();
  for (const el of elements) {
    idMap.set(el.id, stableShapeId("el", el.id));
  }

  const shapes = [];

  for (const el of elements) {
    const id = idMap.get(el.id);
    const color = mapColor(el.strokeColor);
    const size = mapStrokeSize(el.strokeWidth);
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const w = Math.max(1, el.width ?? 1);
    const h = Math.max(1, el.height ?? 1);
    const meta = extractTerraformMeta(el);

    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const geo =
          el.type === "ellipse"
            ? "ellipse"
            : el.type === "diamond"
            ? "diamond"
            : "rectangle";
        shapes.push({
          id,
          type: "geo",
          x,
          y,
          meta,
          props: {
            geo,
            w,
            h,
            color,
            size,
            fill: isContainerElement(el) ? "none" : "semi",
            dash: "solid",
          },
        });
        break;
      }
      case "text": {
        shapes.push({
          id,
          type: "text",
          x,
          y,
          meta,
          props: {
            richText: toRichText(el.text ?? ""),
            color,
            size:
              !el.fontSize || el.fontSize <= 14
                ? "s"
                : el.fontSize <= 20
                ? "m"
                : el.fontSize <= 32
                ? "l"
                : "xl",
            font: "sans",
            textAlign: mapExcalidrawTextAlignToTldraw(el.textAlign),
            autoSize: true,
          },
        });
        break;
      }
      case "arrow":
      case "line": {
        const points = el.points && el.points.length >= 2 ? el.points : null;
        const start = points ? points[0] : [0, 0];
        const end = points ? points[points.length - 1] : [w, h];
        shapes.push({
          id,
          type: "arrow",
          x,
          y,
          meta,
          props: {
            kind: "arc",
            start: { x: start[0], y: start[1] },
            end: { x: end[0], y: end[1] },
            bend: 0,
            color,
            fill: "none",
            dash: "solid",
            size,
            arrowheadStart: "none",
            arrowheadEnd: el.type === "arrow" ? "arrow" : "none",
          },
        });
        break;
      }
      default: {
        idMap.delete(el.id);
        break;
      }
    }
  }

  return { shapes, idMap };
}

module.exports = {
  excalidrawSceneToTldrawShapes,
  mapExcalidrawTextAlignToTldraw,
};

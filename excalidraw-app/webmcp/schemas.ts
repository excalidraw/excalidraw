const ID_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
} as const;

const REVISION_SCHEMA = {
  type: "string",
  minLength: 1,
} as const;

const COORDINATE_SCHEMA = {
  type: "number",
  minimum: -1_000_000,
  maximum: 1_000_000,
} as const;

const DIMENSION_SCHEMA = {
  type: "number",
  exclusiveMinimum: 0,
  maximum: 100_000,
} as const;

const STYLE_PROPERTIES = {
  strokeColor: { type: "string", minLength: 1, maxLength: 64 },
  backgroundColor: { type: "string", minLength: 1, maxLength: 64 },
  fillStyle: { enum: ["hachure", "cross-hatch", "solid", "zigzag"] },
  strokeWidth: { type: "number", minimum: 0.5, maximum: 20 },
  strokeStyle: { enum: ["solid", "dashed", "dotted"] },
  roughness: { type: "number", minimum: 0, maximum: 2 },
  opacity: { type: "number", minimum: 0, maximum: 100 },
} as const;

const ELEMENT_PROPERTIES = {
  id: ID_SCHEMA,
  type: { enum: ["rectangle", "ellipse", "diamond", "line", "arrow", "text"] },
  x: COORDINATE_SCHEMA,
  y: COORDINATE_SCHEMA,
  width: DIMENSION_SCHEMA,
  height: DIMENSION_SCHEMA,
  text: { type: "string", maxLength: 10_000 },
  fontSize: { type: "number", minimum: 1, maximum: 512 },
  points: {
    type: "array",
    minItems: 2,
    maxItems: 1_000,
    items: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: COORDINATE_SCHEMA,
    },
  },
  startArrowhead: { enum: [null, "arrow", "bar", "dot", "triangle"] },
  endArrowhead: { enum: [null, "arrow", "bar", "dot", "triangle"] },
  label: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", maxLength: 10_000 },
      fontSize: { type: "number", minimum: 1, maximum: 512 },
    },
  },
  ...STYLE_PROPERTIES,
} as const;

const ELEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "x", "y"],
  properties: ELEMENT_PROPERTIES,
} as const;

const CHANGES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    x: COORDINATE_SCHEMA,
    y: COORDINATE_SCHEMA,
    width: DIMENSION_SCHEMA,
    height: DIMENSION_SCHEMA,
    text: { type: "string", maxLength: 10_000 },
    fontSize: { type: "number", minimum: 1, maximum: 512 },
    ...STYLE_PROPERTIES,
  },
} as const;

/** WebMCP 工具使用的严格 JSON Schema。 */
export const TOOL_SCHEMAS = {
  read_canvas: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      cursor: { type: "string", minLength: 1 },
    },
  },
  add_elements: {
    type: "object",
    additionalProperties: false,
    required: ["expected_revision", "elements"],
    properties: {
      expected_revision: REVISION_SCHEMA,
      elements: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ELEMENT_SCHEMA,
      },
    },
  },
  update_elements: {
    type: "object",
    additionalProperties: false,
    required: ["expected_revision", "patches"],
    properties: {
      expected_revision: REVISION_SCHEMA,
      patches: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "changes"],
          properties: {
            id: ID_SCHEMA,
            changes: CHANGES_SCHEMA,
          },
        },
      },
    },
  },
  delete_elements: {
    type: "object",
    additionalProperties: false,
    required: ["expected_revision", "ids"],
    properties: {
      expected_revision: REVISION_SCHEMA,
      ids: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        uniqueItems: true,
        items: ID_SCHEMA,
      },
    },
  },
  fit_to_content: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: { enum: ["all", "selection"], default: "all" },
      animate: { type: "boolean", default: true },
    },
  },
} as const;

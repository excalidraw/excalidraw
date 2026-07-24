import {
  ADOBE_BRAND_RED,
  EDITOR_LS_KEYS,
  EXPORT_DATA_TYPES,
  VERSIONS,
  getExportSource,
  randomId,
} from "@excalidraw/common";

import {
  getNonDeletedElements,
  newElement,
  newTextElement,
} from "@excalidraw/element";

import { EditorLocalStorage } from "./EditorLocalStorage";
import { restoreElements } from "./restore";

import type {
  ExportedShapeTemplatesData,
  ImportedShapeTemplatesData,
} from "./types";
import type { ShapeTemplate, ShapeTemplates } from "../types";

export type ShapeTemplatesPersistedData = {
  templates: ShapeTemplates;
};

const BUILTIN_TEMPLATE_IDS = {
  LABEL_BOX: "builtin-label-box",
  STICKY_NOTE: "builtin-sticky-note",
  FLOWCHART_NODE: "builtin-flowchart-node",
} as const;

const createLabelBoxTemplate = (): ShapeTemplate => {
  const rectangle = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 160,
    height: 60,
    strokeColor: ADOBE_BRAND_RED,
    roundness: { type: 3 },
  });
  const text = newTextElement({
    x: 80,
    y: 30,
    text: "Label",
    fontSize: 20,
    containerId: rectangle.id,
    textAlign: "center",
    verticalAlign: "middle",
  });
  const rectangleWithBinding = {
    ...rectangle,
    boundElements: [{ type: "text" as const, id: text.id }],
  };
  return {
    id: BUILTIN_TEMPLATE_IDS.LABEL_BOX,
    name: "Label box",
    category: "Basic",
    builtin: true,
    elements: [rectangleWithBinding, text],
  };
};

const createStickyNoteTemplate = (): ShapeTemplate => {
  const rectangle = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 140,
    height: 140,
    backgroundColor: "#fff9b1",
    strokeColor: "#8e8e8e",
    roundness: { type: 3 },
  });
  const text = newTextElement({
    x: 70,
    y: 70,
    text: "Note",
    fontSize: 16,
    containerId: rectangle.id,
    textAlign: "center",
    verticalAlign: "middle",
  });
  const rectangleWithBinding = {
    ...rectangle,
    boundElements: [{ type: "text" as const, id: text.id }],
  };
  return {
    id: BUILTIN_TEMPLATE_IDS.STICKY_NOTE,
    name: "Sticky note",
    category: "Basic",
    builtin: true,
    elements: [rectangleWithBinding, text],
  };
};

const createFlowchartNodeTemplate = (): ShapeTemplate => {
  const diamond = newElement({
    type: "diamond",
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    strokeColor: ADOBE_BRAND_RED,
  });
  const text = newTextElement({
    x: 60,
    y: 40,
    text: "Step",
    fontSize: 16,
    containerId: diamond.id,
    textAlign: "center",
    verticalAlign: "middle",
  });
  const diamondWithBinding = {
    ...diamond,
    boundElements: [{ type: "text" as const, id: text.id }],
  };
  return {
    id: BUILTIN_TEMPLATE_IDS.FLOWCHART_NODE,
    name: "Flowchart step",
    category: "Flowchart",
    builtin: true,
    elements: [diamondWithBinding, text],
  };
};

export const BUILTIN_SHAPE_TEMPLATES: ShapeTemplates = [
  createLabelBoxTemplate(),
  createStickyNoteTemplate(),
  createFlowchartNodeTemplate(),
];

const restoreShapeTemplate = (
  template: ShapeTemplate,
): ShapeTemplate | null => {
  const elements = restoreElements(
    getNonDeletedElements(template.elements),
    null,
  );
  return elements.length
    ? { ...template, elements: elements as ShapeTemplate["elements"] }
    : null;
};

export const restoreShapeTemplates = (
  templates: ShapeTemplates = [],
): ShapeTemplates => {
  const restored: ShapeTemplate[] = [];
  for (const template of templates) {
    const restoredTemplate = restoreShapeTemplate({
      ...template,
      id: template.id || randomId(),
    });
    if (restoredTemplate) {
      restored.push(restoredTemplate);
    }
  }
  return restored;
};

export const isValidShapeTemplates = (
  json: unknown,
): json is ImportedShapeTemplatesData => {
  return (
    typeof json === "object" &&
    json != null &&
    "type" in json &&
    (json as ImportedShapeTemplatesData).type ===
      EXPORT_DATA_TYPES.excalidrawTemplates &&
    "templates" in json &&
    Array.isArray((json as ImportedShapeTemplatesData).templates)
  );
};

export const serializeShapeTemplatesAsJSON = (templates: ShapeTemplates) => {
  const data: ExportedShapeTemplatesData = {
    type: EXPORT_DATA_TYPES.excalidrawTemplates,
    version: VERSIONS.excalidrawTemplates,
    source: getExportSource(),
    templates,
  };
  return JSON.stringify(data, null, 2);
};

export const parseShapeTemplatesJSON = (
  json: string,
): ShapeTemplates | null => {
  try {
    const data: unknown = JSON.parse(json);
    if (!isValidShapeTemplates(data)) {
      return null;
    }
    return restoreShapeTemplates(data.templates);
  } catch {
    return null;
  }
};

export const loadUserShapeTemplates = (): ShapeTemplates => {
  const data = EditorLocalStorage.get<ShapeTemplatesPersistedData>(
    EDITOR_LS_KEYS.SHAPE_TEMPLATES,
  );
  if (!data?.templates?.length) {
    return [];
  }
  return restoreShapeTemplates(data.templates);
};

export const saveUserShapeTemplates = (templates: ShapeTemplates): boolean => {
  const userTemplates = templates.filter((t) => !t.builtin);
  return EditorLocalStorage.set(EDITOR_LS_KEYS.SHAPE_TEMPLATES, {
    templates: userTemplates,
  });
};

export const getAllShapeTemplates = (): ShapeTemplates => {
  const userTemplates = loadUserShapeTemplates();
  const builtinIds = new Set(BUILTIN_SHAPE_TEMPLATES.map((t) => t.id));
  const filteredUser = userTemplates.filter((t) => !builtinIds.has(t.id));
  return [...BUILTIN_SHAPE_TEMPLATES, ...filteredUser];
};

export const getShapeTemplatesByIds = (
  ids: ShapeTemplate["id"][],
): ShapeTemplates => {
  const all = getAllShapeTemplates();
  return all.filter((t) => ids.includes(t.id));
};

export const getShapeTemplatesGroupedByCategory = (
  templates: ShapeTemplates,
): Map<string, ShapeTemplates> => {
  const grouped = new Map<string, ShapeTemplate[]>();
  for (const template of templates) {
    const category = template.category || "Other";
    const list = grouped.get(category) || [];
    list.push(template);
    grouped.set(category, list);
  }
  return grouped;
};

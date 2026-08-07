import { act } from "@testing-library/react";
import React from "react";

import {
  EDITOR_LS_KEYS,
  MIME_TYPES,
  TEMPLATES_SIDEBAR_TAB,
} from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import { EditorLocalStorage } from "../data/EditorLocalStorage";
import {
  BUILTIN_SHAPE_TEMPLATES,
  getAllShapeTemplates,
  getShapeTemplatesByIds,
  loadUserShapeTemplates,
  parseShapeTemplatesJSON,
  saveUserShapeTemplates,
  serializeShapeTemplatesAsJSON,
} from "../data/shapeTemplates";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

describe("shape templates data", () => {
  beforeEach(() => {
    EditorLocalStorage.delete(EDITOR_LS_KEYS.SHAPE_TEMPLATES);
  });

  it("includes built-in templates", () => {
    const templates = getAllShapeTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(
      BUILTIN_SHAPE_TEMPLATES.length,
    );
    expect(templates.some((t) => t.id === BUILTIN_SHAPE_TEMPLATES[0].id)).toBe(
      true,
    );
  });

  it("serializes and parses template JSON", () => {
    const templates = getAllShapeTemplates().slice(0, 1);
    const json = serializeShapeTemplatesAsJSON(templates);
    const parsed = parseShapeTemplatesJSON(json);
    expect(parsed).toHaveLength(1);
    expect(parsed![0].name).toBe(templates[0].name);
  });

  it("persists user templates to localStorage", () => {
    const userTemplate = {
      id: "user-template-1",
      name: "Custom",
      category: "Custom",
      elements: BUILTIN_SHAPE_TEMPLATES[0].elements,
    };
    saveUserShapeTemplates([userTemplate]);
    const loaded = loadUserShapeTemplates();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("user-template-1");
    expect(getAllShapeTemplates().some((t) => t.id === "user-template-1")).toBe(
      true,
    );
  });

  it("resolves templates by id", () => {
    const id = BUILTIN_SHAPE_TEMPLATES[0].id;
    const found = getShapeTemplatesByIds([id]);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(id);
  });
});

describe("shape templates UI", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    await act(() => {
      h.app.setState({
        openSidebar: { name: "default", tab: TEMPLATES_SIDEBAR_TAB },
      });
    });
  });

  it("renders search and tab controls", () => {
    expect(
      document.querySelector('[data-testid="shape-templates-search"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="shape-templates-tab-recent"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="shape-templates-tab-favorites"]'),
    ).toBeTruthy();
  });

  it("inserts template on click", async () => {
    const templateUnit = document.querySelector(".library-unit__dragger");
    expect(templateUnit).toBeTruthy();

    fireEvent.click(templateUnit!);

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });
  });

  it("inserts template via drag and drop", async () => {
    const templateId = BUILTIN_SHAPE_TEMPLATES[0].id;

    await API.drop([
      {
        kind: "string",
        value: JSON.stringify({ templateIds: [templateId] }),
        type: MIME_TYPES.excalidrawTemplateIds,
      },
    ]);

    await waitFor(() => {
      const elements = h.elements;
      expect(elements.length).toBeGreaterThan(0);
      const template = getShapeTemplatesByIds([templateId])[0];
      const duplicated = duplicateElements({
        type: "everything",
        elements: template.elements,
        randomizeSeed: true,
        preserveFrameChildrenOrder: true,
      }).duplicatedElements;
      expect(elements.length).toBe(duplicated.length);
    });
  });
});

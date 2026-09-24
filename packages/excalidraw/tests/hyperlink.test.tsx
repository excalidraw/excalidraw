import React from "react";

import { KEYS } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { t } from "../i18n";
import { actionUngroup } from "../actions/actionGroup";
import { actionDuplicateSelection } from "../actions/actionDuplicateSelection";
import { serializeAsJSON } from "../data/json";
import { restoreElements } from "../data/restore";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, screen } from "./test-utils";

const { h } = window;

describe("group hyperlinks", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("creates a shared hyperlink from the keyboard for a selected group", () => {
    const elements = [
      API.createElement({ type: "ellipse", groupIds: ["icon"] }),
      API.createElement({ type: "ellipse", x: 100, groupIds: ["icon"] }),
    ];
    API.setElements(elements);
    API.setSelectedElements(elements);

    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.K));
    const input = screen.getByPlaceholderText(t("labels.link.hint"));
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.keyDown(input, { key: KEYS.ENTER });

    expect(h.elements.map((element) => element.link)).toEqual([
      "https://example.com",
      "https://example.com",
    ]);
  });
});

const openEditor = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.K));
  return screen.getByPlaceholderText(t("labels.link.hint"));
};

const submitLink = (value: string) => {
  const input = openEditor();
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: KEYS.ENTER });
};

const selectGroup = (link: string | null = null) => {
  const elements = [
    API.createElement({ type: "ellipse", groupIds: ["icon"] }),
    API.createElement({ type: "ellipse", x: 100, groupIds: ["icon"] }),
  ];
  const linkedElements = elements.map((element) => ({ ...element, link }));
  API.setElements(linkedElements);
  API.setSelectedElements(linkedElements);
  return linkedElements;
};

describe("editing group hyperlinks", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("edits and removes the shared URL for every member", () => {
    selectGroup("https://example.com/old");
    submitLink("https://example.com/new");
    expect(
      h.elements.every(({ link }) => link === "https://example.com/new"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t("buttons.remove") }));
    expect(h.elements.every(({ link }) => link === null)).toBe(true);
  });

  it("commits a draft when selection changes, without changing the new selection", () => {
    const elements = selectGroup();
    const other = API.createElement({ type: "rectangle", x: 400 });
    API.setElements([...elements, other]);
    const input = openEditor();
    fireEvent.change(input, { target: { value: "https://example.com" } });
    API.setSelectedElements([other]);
    expect(h.elements.map(({ link }) => link)).toEqual([
      "https://example.com",
      "https://example.com",
      null,
    ]);
  });

  it("undoes and redoes a group link as one edit", () => {
    selectGroup();
    submitLink("https://example.com");
    API.setSelectedElements([]);
    Keyboard.undo();
    expect(h.elements.map(({ link }) => link)).toEqual([null, null]);
    Keyboard.redo();
    expect(h.elements.map(({ link }) => link)).toEqual([
      "https://example.com",
      "https://example.com",
    ]);
  });

  it("opens from the properties panel", () => {
    selectGroup();
    fireEvent.click(
      screen.getByRole("button", { name: t("labels.link.create") }),
    );
    expect(
      screen.getByPlaceholderText(t("labels.link.hint")),
    ).toBeInTheDocument();
  });

  it("edits a nested group inside its parent without changing its siblings", () => {
    const inner = [
      API.createElement({ type: "ellipse", groupIds: ["inner", "outer"] }),
      API.createElement({
        type: "ellipse",
        x: 100,
        groupIds: ["inner", "outer"],
      }),
    ];
    const sibling = API.createElement({
      type: "rectangle",
      x: 300,
      groupIds: ["outer"],
    });
    API.setElements([...inner, sibling]);
    API.setSelectedElements(inner, "outer");
    submitLink("https://example.com");
    expect(h.elements.map(({ link }) => link)).toEqual([
      "https://example.com",
      "https://example.com",
      null,
    ]);
  });

  it.each([
    "mixed",
    "partly linked",
    "embeddable",
    "locked",
    "ungrouped",
    "two groups",
  ])("does not bulk-edit a %s selection", (kind) => {
    const elements = [
      API.createElement({
        type: "ellipse",
        groupIds: kind === "ungrouped" ? [] : ["icon"],
      }),
      API.createElement({
        type: kind === "embeddable" ? "embeddable" : "ellipse",
        x: 100,
        groupIds:
          kind === "ungrouped"
            ? []
            : kind === "two groups"
            ? ["other"]
            : ["icon"],
        locked: kind === "locked",
      }),
    ];
    const linkedElements = elements.map((element, index) => ({
      ...element,
      link:
        kind === "mixed"
          ? `https://example.com/${index}`
          : kind === "partly linked" && index === 0
          ? "https://example.com"
          : null,
    }));
    API.setElements(linkedElements);
    API.setSelectedElements(linkedElements);
    const originalLinks = h.elements.map(({ link }) => link);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.K));
    expect(
      screen.queryByPlaceholderText(t("labels.link.hint")),
    ).not.toBeInTheDocument();
    expect(h.elements.map(({ link }) => link)).toEqual(originalLinks);
  });

  it("preserves group links through duplication and ungrouping", () => {
    selectGroup();
    submitLink("https://example.com");
    API.executeAction(actionDuplicateSelection);
    expect(h.elements).toHaveLength(4);
    expect(h.elements.every(({ link }) => link === "https://example.com")).toBe(
      true,
    );
    API.executeAction(actionUngroup);
    expect(
      API.getSelectedElements().every(
        ({ groupIds, link }) =>
          groupIds.length === 0 && link === "https://example.com",
      ),
    ).toBe(true);
  });

  it("preserves working links in saved scenes and SVG exports", async () => {
    selectGroup();
    submitLink("https://example.com");
    const saved = JSON.parse(serializeAsJSON(h.elements, h.state, {}, "local"));
    const restored = restoreElements(saved.elements, null);
    expect(restored.map(({ groupIds, link }) => ({ groupIds, link }))).toEqual([
      { groupIds: ["icon"], link: "https://example.com" },
      { groupIds: ["icon"], link: "https://example.com" },
    ]);
    const svg = await exportToSvg(getNonDeletedElements(restored), h.state, {});
    expect(svg.querySelectorAll("a")).toHaveLength(2);
    for (const anchor of svg.querySelectorAll("a")) {
      expect(
        anchor.getAttribute("href") || anchor.getAttribute("xlink:href"),
      ).toBe("https://example.com");
    }
  });

  it("still edits a single element inside a group independently", () => {
    const elements = selectGroup("https://example.com/shared");
    API.setSelectedElements([elements[0]], "icon");
    submitLink("https://example.com/individual");
    expect(h.elements.map(({ link }) => link)).toEqual([
      "https://example.com/individual",
      "https://example.com/shared",
    ]);
  });
});

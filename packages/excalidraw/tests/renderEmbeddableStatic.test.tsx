// On SVG export, the host can supply a static rendering of an embeddable
// (e.g. a widget) instead of the grey placeholder.
import type {
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { render } from "./test-utils";

import type { RenderEmbeddableStatic } from "../scene/types";

const SVG_NS = "http://www.w3.org/2000/svg";

const widget = (overrides: Partial<ExcalidrawEmbeddableElement> = {}) => ({
  ...API.createElement({
    type: "embeddable",
    x: 10,
    y: 20,
    width: 120,
    height: 80,
    ...overrides,
  }),
  customData: { widget: "poll" },
});

const exportSvg = (
  elements: readonly NonDeletedExcalidrawElement[],
  config: Extract<
    Parameters<typeof exportScene>[0],
    { type: "svg" }
  >["config"] = {},
) =>
  exportScene({
    type: "svg",
    data: { elements, appState: getDefaultAppState(), files: {} },
    config,
  });

const hostNode = (document: Document, text = "widget") => {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("data-testid", "widget-static");
  node.textContent = text;
  return node;
};

const staticNode = (svg: SVGSVGElement) =>
  svg.querySelector("[data-testid=widget-static]");

describe("exportScene svg with renderEmbeddableStatic", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("renders the default placeholder when the host gives nothing", async () => {
    const svg = await exportSvg([widget()]);
    expect(staticNode(svg)).toBe(null);
    // the placeholder label is a <text> node
    expect(svg.querySelectorAll("text").length).toBeGreaterThan(0);
  });

  it("inserts the host node instead of the placeholder, positioned like the element", async () => {
    const element = widget();
    const svg = await exportSvg([element], {
      renderEmbeddableStatic: (el, { document }) => {
        expect(el.id).toBe(element.id);
        return hostNode(document, `${el.customData?.widget} static`);
      },
    });
    const node = staticNode(svg);
    expect(node).not.toBe(null);
    expect(node?.textContent).toBe("poll static");
    // default export padding is 10px, so the element's top-left corner lands
    // at (10, 10); the rotation pivot is the element's center, in local
    // coordinates
    expect(node?.getAttribute("transform")).toBe(
      "translate(10 10) rotate(0 60 40)",
    );
    // no placeholder label nor iframe next to it
    expect(svg.querySelectorAll("text").length).toBe(1);
    expect(svg.querySelector("foreignObject")).toBe(null);
  });

  it("rotates the host node around the element's center", async () => {
    const svg = await exportSvg([widget({ angle: (Math.PI / 2) as Radians })], {
      renderEmbeddableStatic: (_el, { document }) => hostNode(document),
    });
    const transform = staticNode(svg)?.getAttribute("transform");
    expect(transform).toEqual(expect.any(String));
    const match = transform?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    // the rotated 120×80 box spans 80×120 around (70, 60): its top-left is
    // (30, 0), so the element's origin lands at (-10, 30) after padding
    expect(Number(match?.[1])).toBeCloseTo(-10);
    expect(Number(match?.[2])).toBeCloseTo(30);
    expect(transform).toMatch(/rotate\(90 60 40\)$/);
  });

  it("combines the host node's opacity with the element's", async () => {
    const svg = await exportSvg([widget({ opacity: 50 })], {
      renderEmbeddableStatic: (_el, { document }) => {
        const node = hostNode(document);
        node.setAttribute("opacity", "0.5");
        return node;
      },
    });
    expect(staticNode(svg)?.getAttribute("opacity")).toBe("0.25");
  });

  it("leaves the opacity alone when both are 1", async () => {
    const svg = await exportSvg([widget()], {
      renderEmbeddableStatic: (_el, { document }) => hostNode(document),
    });
    expect(staticNode(svg)?.getAttribute("opacity")).toBe(null);
  });

  it("tells the host which theme the export uses", async () => {
    const themes: string[] = [];
    const callback: RenderEmbeddableStatic = (_el, { theme }) => {
      themes.push(theme);
      return null;
    };
    await exportSvg([widget()], { renderEmbeddableStatic: callback });
    await exportSvg([widget()], {
      renderEmbeddableStatic: callback,
      theme: "dark",
    });
    expect(themes).toEqual(["light", "dark"]);
  });

  it("falls back to the placeholder when the host returns null", async () => {
    const svg = await exportSvg([widget()], {
      renderEmbeddableStatic: () => null,
    });
    expect(staticNode(svg)).toBe(null);
    expect(svg.querySelectorAll("text").length).toBeGreaterThan(0);
  });

  it("clips the host node to the element's frame", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 60,
      height: 60,
    });
    const element = { ...widget(), frameId: frame.id };
    const svg = await exportSvg([frame, element], {
      renderEmbeddableStatic: (_el, { document }) => hostNode(document),
    });
    const node = staticNode(svg);
    expect(node?.parentElement?.tagName.toLowerCase()).toBe("g");
    expect(node?.parentElement?.getAttribute("clip-path")).toMatch(/^url\(#/);
  });

  it("does not call the callback for iframe elements", async () => {
    const iframe = API.createElement({
      type: "iframe",
      x: 10,
      y: 20,
      width: 120,
      height: 80,
    });
    const seen: string[] = [];
    const svg = await exportScene({
      type: "svg",
      data: {
        elements: [iframe],
        appState: getDefaultAppState(),
        files: {},
      },
      config: {
        renderEmbeddableStatic: (el, { document }) => {
          seen.push(el.id);
          return hostNode(document);
        },
      },
    });
    expect(seen).toEqual([]);
    expect(staticNode(svg)).toBe(null);
  });
});

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "..";
import { exportToSvg } from "../scene/export";

import { getDefaultAppState } from "../appState";

import { API } from "./helpers/api";
import { render } from "./test-utils";

// TextDecoder polyfill
Object.defineProperty(window, "TextDecoder", {
  value: class TextDecoder {
    decode(ab: ArrayBuffer) {
      return new Uint8Array(ab).reduce(
        (acc, c) => acc + String.fromCharCode(c),
        "",
      );
    }
  },
});

describe("exportToSvg", () => {
  // Common state for all SVG tests
  const appState = { ...getDefaultAppState(), exportBackground: false };
  const files = {};

  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  // NOTE: The `!svgRoot` guard  is intentionally not tested
  // in this integration suite. The public `exportToSvg` API always
  // creates a valid SVG root element, making this branch unreachable.
  // This case would be covered by a direct unit test on `renderSceneToSvg`.

  it("should not render text element individually if it is bound to a container", async () => {
    // Setup: A container and a text element bound to it
    const container = API.createElement({ type: "rectangle", id: "c1" });
    const text = API.createElement({
      type: "text",
      id: "t1",
      text: "Hello",
      containerId: "c1",
      width: 16, // jsdom hack
      height: 16,
    });
    const elements = [container, text] as ExcalidrawElement[];

    // Action
    const svg = await exportToSvg(elements, appState, files);

    // Assert: The text is rendered *inside* the container's <g>, not as its own.
    expect(svg.outerHTML).toMatchSnapshot(`export-svg-bound-text`);
  });

  it("should render text element individually if its container is missing (orphan text)", async () => {
    // Setup: An orphan text. Its containerId points to a non-existent element.
    const orphanText = API.createElement({
      type: "text",
      id: "t1_orphan",
      text: "Orphan",
      containerId: "c_nonexistent",
      width: 16,
      height: 16,
    });
    const elements = [orphanText] as ExcalidrawElement[];

    // Action
    const svg = await exportToSvg(elements, appState, files);

    // Assert: The snapshot should show a separate <g> for the orphan text.
    expect(svg.outerHTML).toMatchSnapshot(`export-svg-orphan-text`);
  });

  it("should render a regular, unbound text element individually", async () => {
    // Setup: A regular text element with no containerId.
    const regularText = API.createElement({
      type: "text",
      id: "t2_regular",
      text: "Regular",
      containerId: null,
      width: 16,
      height: 16,
    });
    const elements = [regularText] as ExcalidrawElement[];

    // Action
    const svg = await exportToSvg(elements, appState, files);

    // Assert: The snapshot should show a separate <g> for the regular text.
    expect(svg.outerHTML).toMatchSnapshot(`export-svg-regular-text`);
  });

  it("should render non-text elements individually", async () => {
    // Setup: A simple rectangle with no bound text.
    const rect = API.createElement({
      type: "rectangle",
      id: "r1",
    });
    const elements = [rect] as ExcalidrawElement[];

    // Action
    const svg = await exportToSvg(elements, appState, files);

    // Assert: The snapshot should show one <g> for the rectangle.
    expect(svg.outerHTML).toMatchSnapshot(`export-svg-non-text`);
  });

  it("should handle deleted elements, iframes, and bound text correctly", async () => {
    // Setup
    // 1. A deleted element
    const deletedRect = API.createElement({
      type: "rectangle",
      id: "deleted_rect",
      isDeleted: true,
    });

    // 2. An element with bound text
    const containerWithText = API.createElement({
      type: "rectangle",
      id: "container_with_text",
    });
    const boundText = API.createElement({
      type: "text",
      id: "bound_text",
      text: "Bound Text",
      containerId: "container_with_text",
      width: 16,
      height: 16,
    });

    // 3. A valid iframe
    const iframeOK = API.createElement({
      type: "iframe",
      id: "iframe_ok",
      isDeleted: false,
    });

    // 4. A deleted iframe
    const iframeDeleted = API.createElement({
      type: "iframe",
      id: "iframe_deleted",
      isDeleted: true,
    });

    const elements = [
      deletedRect,
      containerWithText,
      boundText,
      iframeOK,
      iframeDeleted,
    ] as ExcalidrawElement[];

    // Action
    const svg = await exportToSvg(elements, appState, files);

    // Assert: The snapshot should *only* contain the rendered elements.
    expect(svg.outerHTML).toMatchSnapshot(`export-svg-mixed-elements`);
  });
});

import { THEME } from "../../constants";
import { NonDeletedExcalidrawElement } from "../../element/types";
import * as exportUtils from "../../scene/export";
import {
  diamondFixture,
  ellipseFixture,
  rectangleWithLinkFixture,
} from "../fixtures/elementFixture";

describe("exportToSvg", () => {
  const ELEMENT_HEIGHT = 100;
  const ELEMENT_WIDTH = 100;
  const ELEMENTS = [
    { ...diamondFixture, height: ELEMENT_HEIGHT, width: ELEMENT_WIDTH },
    { ...ellipseFixture, height: ELEMENT_HEIGHT, width: ELEMENT_WIDTH },
  ] as NonDeletedExcalidrawElement[];

  const DEFAULT_OPTIONS = {
    exportBackground: false,
    viewBackgroundColor: "#ffffff",
    files: {},
  };

  it("with default arguments", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      DEFAULT_OPTIONS,
      null,
    );

    expect(svgElement).toMatchSnapshot();
  });

  it("with background color", async () => {
    const BACKGROUND_COLOR = "#abcdef";

    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportBackground: true,
        viewBackgroundColor: BACKGROUND_COLOR,
      },
      null,
    );

    expect(svgElement.querySelector("rect")).toHaveAttribute(
      "fill",
      BACKGROUND_COLOR,
    );
  });

  it("with dark mode", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportTheme: THEME.DARK,
      },
      null,
    );

    const css = svgElement.querySelector("style")?.innerHTML;
    expect(css).not.toBeNull();

    // find the filter value with a regex, to be sure its under the right CSS rule
    const match = css?.match(/#group-[\w-]+,\s*image\s*\{\s*filter:\s*(.*?);/);
    expect(match).not.toBeNull();

    expect(match ? match[1] : "").toMatchInlineSnapshot(`"themeFilter"`);
  });

  it("with exportPadding", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportPadding: 0,
      },
      null,
    );

    expect(svgElement).toHaveAttribute("height", ELEMENT_HEIGHT.toString());
    expect(svgElement).toHaveAttribute("width", ELEMENT_WIDTH.toString());
    expect(svgElement).toHaveAttribute(
      "viewBox",
      `0 0 ${ELEMENT_WIDTH} ${ELEMENT_HEIGHT}`,
    );
  });

  it("with scale", async () => {
    const SCALE = 2;

    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportPadding: 0,
        exportScale: SCALE,
      },
      null,
    );

    expect(svgElement).toHaveAttribute(
      "height",
      (ELEMENT_HEIGHT * SCALE).toString(),
    );
    expect(svgElement).toHaveAttribute(
      "width",
      (ELEMENT_WIDTH * SCALE).toString(),
    );
  });

  it("with exportEmbedScene", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportEmbedScene: true,
      },
      null,
    );
    expect(svgElement.innerHTML).toMatchSnapshot();
  });

  it("with elements that have a link", async () => {
    const svgElement = await exportUtils.exportToSvg(
      [rectangleWithLinkFixture],
      DEFAULT_OPTIONS,
      null,
    );
    expect(svgElement.innerHTML).toMatchSnapshot();
  });
});

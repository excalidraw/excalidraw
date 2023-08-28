import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_LOGO_URL,
  EXPORT_LOGO_URL_DARK,
  FANCY_BACKGROUND_IMAGES,
  FANCY_BG_BORDER_RADIUS,
  FANCY_BG_LOGO_PADDING,
  FANCY_BG_PADDING,
  IMAGE_INVERT_FILTER,
  SVG_NS,
  THEME,
  THEME_FILTER,
} from "../constants";
import { loadHTMLImageElement, loadSVGElement } from "../element/image";
import { getScaleToFill } from "../packages/utils";
import { roundRect } from "../renderer/roundRect";
import { AppState, DataURL, Dimensions, ExportPadding } from "../types";

export const getFancyBackgroundPadding = (
  exportPadding: ExportPadding = [
    DEFAULT_EXPORT_PADDING,
    DEFAULT_EXPORT_PADDING,
    DEFAULT_EXPORT_PADDING,
    DEFAULT_EXPORT_PADDING,
  ],
  includeLogo = false,
): ExportPadding =>
  exportPadding.map(
    (padding, index) =>
      FANCY_BG_PADDING +
      FANCY_BG_BORDER_RADIUS +
      padding +
      (index === 2 && includeLogo ? 20 : 0),
  ) as [number, number, number, number];

const addImageBackground = (
  context: CanvasRenderingContext2D,
  canvasDimensions: Dimensions,
  fancyBackgroundImage: HTMLImageElement,
  exportScale: AppState["exportScale"],
) => {
  context.save();
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(
      0,
      0,
      canvasDimensions.width,
      canvasDimensions.height,
      FANCY_BG_BORDER_RADIUS * exportScale,
    );
  } else {
    roundRect(
      context,
      0,
      0,
      canvasDimensions.width,
      canvasDimensions.height,
      FANCY_BG_BORDER_RADIUS * exportScale,
    );
  }
  const scale = getScaleToFill(
    { width: fancyBackgroundImage.width, height: fancyBackgroundImage.height },
    { width: canvasDimensions.width, height: canvasDimensions.height },
  );
  const x = (canvasDimensions.width - fancyBackgroundImage.width * scale) / 2;
  const y = (canvasDimensions.height - fancyBackgroundImage.height * scale) / 2;
  context.clip();
  context.drawImage(
    fancyBackgroundImage,
    x,
    y,
    fancyBackgroundImage.width * scale,
    fancyBackgroundImage.height * scale,
  );
  context.closePath();
  context.restore();
};

const getContentBackgound = (
  contentSize: Dimensions,
  normalizedDimensions: Dimensions,
  exportScale: number,
  includeLogo: boolean,
): { x: number; y: number; width: number; height: number } => {
  const x =
    (normalizedDimensions.width - contentSize.width * exportScale) / 2 -
    FANCY_BG_PADDING * exportScale;

  const y =
    (normalizedDimensions.height - contentSize.height * exportScale) / 2 -
    FANCY_BG_PADDING * exportScale;

  const width =
    (contentSize.width +
      (DEFAULT_EXPORT_PADDING + FANCY_BG_BORDER_RADIUS) * 2) *
    exportScale;

  const height =
    (contentSize.height -
      (includeLogo ? FANCY_BG_LOGO_PADDING : 0) +
      (DEFAULT_EXPORT_PADDING + FANCY_BG_BORDER_RADIUS) * 2) *
    exportScale;

  return { x, y, width, height };
};

const addContentBackground = (
  context: CanvasRenderingContext2D,
  normalizedDimensions: Dimensions,
  contentBackgroundColor: string,
  exportScale: AppState["exportScale"],
  theme: AppState["theme"],
  contentSize: Dimensions,
  includeLogo: boolean,
) => {
  const shadows = [
    {
      offsetX: 0,
      offsetY: 0,
      blur: 2,
      alpha: 0.02,
    },
    {
      offsetX: 0,
      offsetY: 1,
      blur: 4,
      alpha: 0.04,
    },
    {
      offsetX: 0,
      offsetY: 4,
      blur: 10,
      alpha: 0.05,
    },
    { offsetX: 0, offsetY: 13, blur: 33, alpha: 0.07 },
  ];

  shadows.forEach((shadow, index): void => {
    context.save();
    context.beginPath();
    context.shadowColor = `rgba(0, 0, 0, ${shadow.alpha})`;
    context.shadowBlur = shadow.blur * exportScale;
    context.shadowOffsetX = shadow.offsetX * exportScale;
    context.shadowOffsetY = shadow.offsetY * exportScale;

    const { x, y, width, height } = getContentBackgound(
      contentSize,
      normalizedDimensions,
      exportScale,
      includeLogo,
    );

    if (context.roundRect) {
      context.roundRect(
        x,
        y,
        width,
        height,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    } else {
      roundRect(
        context,
        x,
        y,
        width,
        height,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    }

    if (index === shadows.length - 1) {
      if (theme === THEME.DARK) {
        context.filter = THEME_FILTER;
      }
      context.fillStyle = contentBackgroundColor;
      context.fill();
    }
    context.closePath();
    context.restore();
  });
};

const addLogo = (
  context: CanvasRenderingContext2D,
  canvasDimensions: Dimensions,
  logoImage: HTMLImageElement,
  exportScale: number,
) => {
  context.save();
  context.beginPath();
  context.drawImage(
    logoImage,
    ((canvasDimensions.width - logoImage.width) / 2) * exportScale, // center horizontally
    (canvasDimensions.height - logoImage.height - 12) * exportScale, // 12px from bottom
    logoImage.width * exportScale,
    logoImage.height * exportScale,
  );

  context.closePath();
  context.restore();
};

export const applyFancyBackgroundOnCanvas = async ({
  canvas,
  fancyBackgroundImageKey,
  backgroundColor,
  exportScale,
  theme,
  contentSize,
  includeLogo,
}: {
  canvas: HTMLCanvasElement;
  fancyBackgroundImageKey: Exclude<
    keyof typeof FANCY_BACKGROUND_IMAGES,
    "solid"
  >;
  backgroundColor: string;
  exportScale: AppState["exportScale"];
  theme: AppState["theme"];
  contentSize: Dimensions;
  includeLogo: boolean;
}) => {
  const context = canvas.getContext("2d")!;

  const fancyBackgroundImageUrl =
    FANCY_BACKGROUND_IMAGES[fancyBackgroundImageKey][theme];

  const fancyBackgroundImage = await loadHTMLImageElement(
    fancyBackgroundImageUrl,
  );

  const canvasDimensions: Dimensions = {
    width: canvas.width,
    height: canvas.height,
  };

  addImageBackground(
    context,
    canvasDimensions,
    fancyBackgroundImage,
    exportScale,
  );

  addContentBackground(
    context,
    canvasDimensions,
    backgroundColor,
    exportScale,
    theme,
    contentSize,
    includeLogo,
  );

  if (includeLogo) {
    const logoImage = await loadHTMLImageElement(
      theme === THEME.DARK ? EXPORT_LOGO_URL_DARK : EXPORT_LOGO_URL,
    );
    addLogo(context, canvasDimensions, logoImage, exportScale);
  }
};

const addImageBackgroundToSvg = async ({
  svgRoot,
  fancyBackgroundImageUrl,
  dimensions,
  theme,
}: {
  svgRoot: SVGSVGElement;
  fancyBackgroundImageUrl: DataURL;
  dimensions: Dimensions;
  theme: AppState["theme"];
}) => {
  const fancyBackgroundImage = await loadSVGElement(fancyBackgroundImageUrl);

  fancyBackgroundImage.setAttribute("x", "0");
  fancyBackgroundImage.setAttribute("y", "0");
  fancyBackgroundImage.setAttribute("width", `${dimensions.width}`);
  fancyBackgroundImage.setAttribute("height", `${dimensions.height}`);
  fancyBackgroundImage.setAttribute("preserveAspectRatio", "none");
  if (theme === THEME.DARK) {
    fancyBackgroundImage.setAttribute("filter", IMAGE_INVERT_FILTER);
  }

  svgRoot.appendChild(fancyBackgroundImage);
};
const addContentBackgroundToSvg = ({
  svgRoot,
  exportScale,
  contentSize,
  backgroundColor,
  dimensions,
  includeLogo,
}: {
  svgRoot: SVGSVGElement;
  exportScale: number;
  contentSize: Dimensions;
  backgroundColor: string;
  dimensions: Dimensions;
  includeLogo: boolean;
}) => {
  // Create the shadow filter
  const filter = svgRoot.ownerDocument!.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", "shadow");

  const feGaussianBlur = svgRoot.ownerDocument!.createElementNS(
    SVG_NS,
    "feGaussianBlur",
  );
  feGaussianBlur.setAttribute("in", "SourceAlpha");
  feGaussianBlur.setAttribute("stdDeviation", "3");

  const feOffset = svgRoot.ownerDocument!.createElementNS(SVG_NS, "feOffset");
  feOffset.setAttribute("dx", "4");
  feOffset.setAttribute("dy", "4");
  feOffset.setAttribute("result", "offsetblur");

  const feFlood = svgRoot.ownerDocument!.createElementNS(SVG_NS, "feFlood");
  feFlood.setAttribute("flood-color", "black");
  feFlood.setAttribute("flood-opacity", "0.04");
  feFlood.setAttribute("result", "color");

  const feComposite = svgRoot.ownerDocument!.createElementNS(
    SVG_NS,
    "feComposite",
  );
  feComposite.setAttribute("in", "color");
  feComposite.setAttribute("in2", "offsetblur");
  feComposite.setAttribute("operator", "in");
  feComposite.setAttribute("result", "shadow");

  const feMerge = svgRoot.ownerDocument!.createElementNS(SVG_NS, "feMerge");
  const feMergeNodeIn = svgRoot.ownerDocument!.createElementNS(
    SVG_NS,
    "feMergeNode",
  );
  feMergeNodeIn.setAttribute("in", "shadow");
  const feMergeNodeGraphic = svgRoot.ownerDocument!.createElementNS(
    SVG_NS,
    "feMergeNode",
  );
  feMergeNodeGraphic.setAttribute("in", "SourceGraphic");
  feMerge.appendChild(feMergeNodeIn);
  feMerge.appendChild(feMergeNodeGraphic);

  filter.appendChild(feGaussianBlur);
  filter.appendChild(feOffset);
  filter.appendChild(feFlood);
  filter.appendChild(feComposite);
  filter.appendChild(feMerge);

  svgRoot.appendChild(filter);

  // Solid color background
  const { x, y, width, height } = getContentBackgound(
    contentSize,
    dimensions,
    exportScale,
    includeLogo,
  );
  const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", x.toString());
  rect.setAttribute("y", y.toString());
  rect.setAttribute("width", width.toString());
  rect.setAttribute("height", height.toString());
  rect.setAttribute("rx", (FANCY_BG_BORDER_RADIUS * exportScale).toString());
  rect.setAttribute("ry", (FANCY_BG_BORDER_RADIUS * exportScale).toString());
  rect.setAttribute("fill", backgroundColor);
  rect.setAttribute("filter", "url(#shadow)");
  svgRoot.appendChild(rect);
};

const addLogoToSvg = (
  svgRoot: SVGSVGElement,
  canvasDimensions: Dimensions,
  logoImage: SVGSVGElement,
  exportScale: number,
) => {
  const logoWidth = parseFloat(logoImage.getAttribute("width") || "0");
  const logoHeight = parseFloat(logoImage.getAttribute("height") || "0");

  const x = (canvasDimensions.width - logoWidth) / 2; // center horizontally
  const y = canvasDimensions.height - logoHeight - 12; // 12px from bottom

  logoImage.setAttribute("x", `${x}`);
  logoImage.setAttribute("y", `${y * exportScale}`);
  svgRoot.appendChild(logoImage);
};

export const applyFancyBackgroundOnSvg = async ({
  svgRoot,
  fancyBackgroundImageKey,
  backgroundColor,
  dimensions,
  exportScale,
  theme,
  contentSize,
  includeLogo,
}: {
  svgRoot: SVGSVGElement;
  fancyBackgroundImageKey: Exclude<
    keyof typeof FANCY_BACKGROUND_IMAGES,
    "solid"
  >;
  backgroundColor: string;
  dimensions: Dimensions;
  exportScale: AppState["exportScale"];
  theme: AppState["theme"];
  contentSize: Dimensions;
  includeLogo: boolean;
}) => {
  // Image background
  const fancyBackgroundImageUrl =
    FANCY_BACKGROUND_IMAGES[fancyBackgroundImageKey][theme];

  await addImageBackgroundToSvg({
    svgRoot,
    fancyBackgroundImageUrl,
    dimensions,
    theme,
  });

  addContentBackgroundToSvg({
    svgRoot,
    exportScale,
    contentSize,
    backgroundColor,
    dimensions,
    includeLogo,
  });

  if (includeLogo) {
    const logoImage = await loadSVGElement(
      theme === THEME.DARK ? EXPORT_LOGO_URL_DARK : EXPORT_LOGO_URL,
    );
    addLogoToSvg(svgRoot, dimensions, logoImage, exportScale);
  }
};

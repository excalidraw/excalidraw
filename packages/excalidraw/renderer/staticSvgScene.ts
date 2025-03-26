import {
  FRAME_STYLE,
  MAX_DECIMALS_FOR_SVG_EXPORT,
  MIME_TYPES,
  SVG_NS,
  getFontFamilyString,
  isRTL,
  isTestEnv,
  getVerticalOffset,
} from "@excalidraw/common";
import { normalizeLink, toValidURL } from "@excalidraw/common";
import { hashString } from "@excalidraw/element";
import { getUncroppedWidthAndHeight } from "@excalidraw/element/cropElement";
import {
  createPlaceholderEmbeddableLabel,
  getEmbedLink,
} from "@excalidraw/element/embeddable";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";
import {
  getBoundTextElement,
  getContainerElement,
} from "@excalidraw/element/textElement";
import { getLineHeightInPx } from "@excalidraw/element/textMeasurements";
import {
  isArrowElement,
  isIframeLikeElement,
  isInitializedImageElement,
  isTextElement,
} from "@excalidraw/element/typeChecks";

import { getContainingFrame } from "@excalidraw/element/frame";

import { getCornerRadius, isPathALoop } from "@excalidraw/element/shapes";

import { ShapeCache } from "@excalidraw/element/ShapeCache";

import {
  getFreeDrawSvgPath,
  IMAGE_INVERT_FILTER,
} from "@excalidraw/element/renderElement";

import { getElementAbsoluteCoords } from "@excalidraw/element/bounds";

import type {
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { RenderableElementsMap, SVGRenderConfig } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";
import type { Drawable } from "roughjs/bin/core";
import type { RoughSVG } from "roughjs/bin/svg";

const roughSVGDrawWithPrecision = (
  rsvg: RoughSVG,
  drawable: Drawable,
  precision?: number,
) => {
  if (typeof precision === "undefined") {
    return rsvg.draw(drawable);
  }
  const pshape: Drawable = {
    sets: drawable.sets,
    shape: drawable.shape,
    options: { ...drawable.options, fixedDecimalPlaceDigits: precision },
  };
  return rsvg.draw(pshape);
};

const maybeWrapNodesInFrameClipPath = (
  element: NonDeletedExcalidrawElement,
  root: SVGElement,
  nodes: SVGElement[],
  frameRendering: AppState["frameRendering"],
  elementsMap: RenderableElementsMap,
) => {
  if (!frameRendering.enabled || !frameRendering.clip) {
    return null;
  }
  const frame = getContainingFrame(element, elementsMap);
  if (frame) {
    const g = root.ownerDocument!.createElementNS(SVG_NS, "g");
    g.setAttributeNS(SVG_NS, "clip-path", `url(#${frame.id})`);
    nodes.forEach((node) => g.appendChild(node));
    return g;
  }

  return null;
};

const renderElementToSvg = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  offsetX: number,
  offsetY: number,
  renderConfig: SVGRenderConfig,
) => {
  const offset = { x: offsetX, y: offsetY };
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  let cx = (x2 - x1) / 2 - (element.x - x1);
  let cy = (y2 - y1) / 2 - (element.y - y1);
  if (isTextElement(element)) {
    const container = getContainerElement(element, elementsMap);
    if (isArrowElement(container)) {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(container, elementsMap);

      const boundTextCoords = LinearElementEditor.getBoundTextElementPosition(
        container,
        element as ExcalidrawTextElementWithContainer,
        elementsMap,
      );
      cx = (x2 - x1) / 2 - (boundTextCoords.x - x1);
      cy = (y2 - y1) / 2 - (boundTextCoords.y - y1);
      offsetX = offsetX + boundTextCoords.x - element.x;
      offsetY = offsetY + boundTextCoords.y - element.y;
    }
  }
  const degree = (180 * element.angle) / Math.PI;

  // element to append node to, most of the time svgRoot
  let root = svgRoot;

  // if the element has a link, create an anchor tag and make that the new root
  if (element.link) {
    const anchorTag = svgRoot.ownerDocument!.createElementNS(SVG_NS, "a");
    anchorTag.setAttribute("href", normalizeLink(element.link));
    root.appendChild(anchorTag);
    root = anchorTag;
  }

  const addToRoot = (node: SVGElement, element: ExcalidrawElement) => {
    if (isTestEnv()) {
      node.setAttribute("data-id", element.id);
    }
    root.appendChild(node);
  };

  const opacity =
    ((getContainingFrame(element, elementsMap)?.opacity ?? 100) *
      element.opacity) /
    10000;

  switch (element.type) {
    case "selection": {
      // Since this is used only during editing experience, which is canvas based,
      // this should not happen
      throw new Error("Selection rendering is not supported for SVG");
    }
    case "rectangle":
    case "diamond":
    case "ellipse": {
      const shape = ShapeCache.generateElementShape(element, null);
      const node = roughSVGDrawWithPrecision(
        rsvg,
        shape,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [node],
        renderConfig.frameRendering,
        elementsMap,
      );

      addToRoot(g || node, element);
      break;
    }
    case "iframe":
    case "embeddable": {
      // render placeholder rectangle
      const shape = ShapeCache.generateElementShape(element, renderConfig);
      const node = roughSVGDrawWithPrecision(
        rsvg,
        shape,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
      const opacity = element.opacity / 100;
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      addToRoot(node, element);

      const label: ExcalidrawElement =
        createPlaceholderEmbeddableLabel(element);
      renderElementToSvg(
        label,
        elementsMap,
        rsvg,
        root,
        files,
        label.x + offset.x - element.x,
        label.y + offset.y - element.y,
        renderConfig,
      );

      // render embeddable element + iframe
      const embeddableNode = roughSVGDrawWithPrecision(
        rsvg,
        shape,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
      embeddableNode.setAttribute("stroke-linecap", "round");
      embeddableNode.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      while (embeddableNode.firstChild) {
        embeddableNode.removeChild(embeddableNode.firstChild);
      }
      const radius = getCornerRadius(
        Math.min(element.width, element.height),
        element,
      );

      const embedLink = getEmbedLink(toValidURL(element.link || ""));

      // if rendering embeddables explicitly disabled or
      // embedding documents via srcdoc (which doesn't seem to work for SVGs)
      // replace with a link instead
      if (
        renderConfig.renderEmbeddables === false ||
        embedLink?.type === "document"
      ) {
        const anchorTag = svgRoot.ownerDocument!.createElementNS(SVG_NS, "a");
        anchorTag.setAttribute("href", normalizeLink(element.link || ""));
        anchorTag.setAttribute("target", "_blank");
        anchorTag.setAttribute("rel", "noopener noreferrer");
        anchorTag.style.borderRadius = `${radius}px`;

        embeddableNode.appendChild(anchorTag);
      } else {
        const foreignObject = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "foreignObject",
        );
        foreignObject.style.width = `${element.width}px`;
        foreignObject.style.height = `${element.height}px`;
        foreignObject.style.border = "none";
        const div = foreignObject.ownerDocument!.createElementNS(SVG_NS, "div");
        div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        div.style.width = "100%";
        div.style.height = "100%";
        const iframe = div.ownerDocument!.createElement("iframe");
        iframe.src = embedLink?.link ?? "";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = `${radius}px`;
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.allowFullscreen = true;
        div.appendChild(iframe);
        foreignObject.appendChild(div);

        embeddableNode.appendChild(foreignObject);
      }
      addToRoot(embeddableNode, element);
      break;
    }
    case "line":
    case "arrow": {
      const boundText = getBoundTextElement(element, elementsMap);
      const maskPath = svgRoot.ownerDocument!.createElementNS(SVG_NS, "mask");
      if (boundText) {
        maskPath.setAttribute("id", `mask-${element.id}`);
        const maskRectVisible = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "rect",
        );
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        maskRectVisible.setAttribute("x", "0");
        maskRectVisible.setAttribute("y", "0");
        maskRectVisible.setAttribute("fill", "#fff");
        maskRectVisible.setAttribute(
          "width",
          `${element.width + 100 + offsetX}`,
        );
        maskRectVisible.setAttribute(
          "height",
          `${element.height + 100 + offsetY}`,
        );

        maskPath.appendChild(maskRectVisible);
        const maskRectInvisible = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "rect",
        );
        const boundTextCoords = LinearElementEditor.getBoundTextElementPosition(
          element,
          boundText,
          elementsMap,
        );

        const maskX = offsetX + boundTextCoords.x - element.x;
        const maskY = offsetY + boundTextCoords.y - element.y;

        maskRectInvisible.setAttribute("x", maskX.toString());
        maskRectInvisible.setAttribute("y", maskY.toString());
        maskRectInvisible.setAttribute("fill", "#000");
        maskRectInvisible.setAttribute("width", `${boundText.width}`);
        maskRectInvisible.setAttribute("height", `${boundText.height}`);
        maskRectInvisible.setAttribute("opacity", "1");
        maskPath.appendChild(maskRectInvisible);
      }
      const group = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      if (boundText) {
        group.setAttribute("mask", `url(#mask-${element.id})`);
      }
      group.setAttribute("stroke-linecap", "round");

      const shapes = ShapeCache.generateElementShape(element, renderConfig);
      shapes.forEach((shape) => {
        const node = roughSVGDrawWithPrecision(
          rsvg,
          shape,
          MAX_DECIMALS_FOR_SVG_EXPORT,
        );
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }
        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        if (
          element.type === "line" &&
          isPathALoop(element.points) &&
          element.backgroundColor !== "transparent"
        ) {
          node.setAttribute("fill-rule", "evenodd");
        }
        group.appendChild(node);
      });

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [group, maskPath],
        renderConfig.frameRendering,
        elementsMap,
      );
      if (g) {
        addToRoot(g, element);
        root.appendChild(g);
      } else {
        addToRoot(group, element);
        root.append(maskPath);
      }
      break;
    }
    case "freedraw": {
      const backgroundFillShape = ShapeCache.generateElementShape(
        element,
        renderConfig,
      );
      const node = backgroundFillShape
        ? roughSVGDrawWithPrecision(
            rsvg,
            backgroundFillShape,
            MAX_DECIMALS_FOR_SVG_EXPORT,
          )
        : svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      node.setAttribute("stroke", "none");
      const path = svgRoot.ownerDocument!.createElementNS(SVG_NS, "path");
      path.setAttribute("fill", element.strokeColor);
      path.setAttribute("d", getFreeDrawSvgPath(element));
      node.appendChild(path);

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [node],
        renderConfig.frameRendering,
        elementsMap,
      );

      addToRoot(g || node, element);
      break;
    }
    case "image": {
      const width = Math.round(element.width);
      const height = Math.round(element.height);
      const fileData =
        isInitializedImageElement(element) && files[element.fileId];
      if (fileData) {
        const { reuseImages = true } = renderConfig;

        let symbolId = `image-${fileData.id}`;

        let uncroppedWidth = element.width;
        let uncroppedHeight = element.height;
        if (element.crop) {
          ({ width: uncroppedWidth, height: uncroppedHeight } =
            getUncroppedWidthAndHeight(element));

          symbolId = `image-crop-${fileData.id}-${hashString(
            `${uncroppedWidth}x${uncroppedHeight}`,
          )}`;
        }

        if (!reuseImages) {
          symbolId = `image-${element.id}`;
        }

        let symbol = svgRoot.querySelector(`#${symbolId}`);
        if (!symbol) {
          symbol = svgRoot.ownerDocument!.createElementNS(SVG_NS, "symbol");
          symbol.id = symbolId;

          const image = svgRoot.ownerDocument!.createElementNS(SVG_NS, "image");
          image.setAttribute("href", fileData.dataURL);
          image.setAttribute("preserveAspectRatio", "none");

          if (element.crop || !reuseImages) {
            image.setAttribute("width", `${uncroppedWidth}`);
            image.setAttribute("height", `${uncroppedHeight}`);
          } else {
            image.setAttribute("width", "100%");
            image.setAttribute("height", "100%");
          }

          symbol.appendChild(image);

          (root.querySelector("defs") || root).prepend(symbol);
        }

        const use = svgRoot.ownerDocument!.createElementNS(SVG_NS, "use");
        use.setAttribute("href", `#${symbolId}`);

        // in dark theme, revert the image color filter
        if (
          renderConfig.exportWithDarkMode &&
          fileData.mimeType !== MIME_TYPES.svg
        ) {
          use.setAttribute("filter", IMAGE_INVERT_FILTER);
        }

        let normalizedCropX = 0;
        let normalizedCropY = 0;

        if (element.crop) {
          const { width: uncroppedWidth, height: uncroppedHeight } =
            getUncroppedWidthAndHeight(element);
          normalizedCropX =
            element.crop.x / (element.crop.naturalWidth / uncroppedWidth);
          normalizedCropY =
            element.crop.y / (element.crop.naturalHeight / uncroppedHeight);
        }

        const adjustedCenterX = cx + normalizedCropX;
        const adjustedCenterY = cy + normalizedCropY;

        use.setAttribute("width", `${width + normalizedCropX}`);
        use.setAttribute("height", `${height + normalizedCropY}`);
        use.setAttribute("opacity", `${opacity}`);

        // We first apply `scale` transforms (horizontal/vertical mirroring)
        // on the <use> element, then apply translation and rotation
        // on the <g> element which wraps the <use>.
        // Doing this separately is a quick hack to to work around compositing
        // the transformations correctly (the transform-origin was not being
        // applied correctly).
        if (element.scale[0] !== 1 || element.scale[1] !== 1) {
          use.setAttribute(
            "transform",
            `translate(${adjustedCenterX} ${adjustedCenterY}) scale(${
              element.scale[0]
            } ${
              element.scale[1]
            }) translate(${-adjustedCenterX} ${-adjustedCenterY})`,
          );
        }

        const g = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");

        if (element.crop) {
          const mask = svgRoot.ownerDocument!.createElementNS(SVG_NS, "mask");
          mask.setAttribute("id", `mask-image-crop-${element.id}`);
          mask.setAttribute("fill", "#fff");
          const maskRect = svgRoot.ownerDocument!.createElementNS(
            SVG_NS,
            "rect",
          );

          maskRect.setAttribute("x", `${normalizedCropX}`);
          maskRect.setAttribute("y", `${normalizedCropY}`);
          maskRect.setAttribute("width", `${width}`);
          maskRect.setAttribute("height", `${height}`);

          mask.appendChild(maskRect);
          root.appendChild(mask);
          g.setAttribute("mask", `url(#${mask.id})`);
        }

        g.appendChild(use);
        g.setAttribute(
          "transform",
          `translate(${offsetX - normalizedCropX} ${
            offsetY - normalizedCropY
          }) rotate(${degree} ${adjustedCenterX} ${adjustedCenterY})`,
        );

        if (element.roundness) {
          const clipPath = svgRoot.ownerDocument!.createElementNS(
            SVG_NS,
            "clipPath",
          );
          clipPath.id = `image-clipPath-${element.id}`;

          const clipRect = svgRoot.ownerDocument!.createElementNS(
            SVG_NS,
            "rect",
          );
          const radius = getCornerRadius(
            Math.min(element.width, element.height),
            element,
          );
          clipRect.setAttribute("width", `${element.width}`);
          clipRect.setAttribute("height", `${element.height}`);
          clipRect.setAttribute("rx", `${radius}`);
          clipRect.setAttribute("ry", `${radius}`);
          clipPath.appendChild(clipRect);
          addToRoot(clipPath, element);

          g.setAttributeNS(SVG_NS, "clip-path", `url(#${clipPath.id})`);
        }

        const clipG = maybeWrapNodesInFrameClipPath(
          element,
          root,
          [g],
          renderConfig.frameRendering,
          elementsMap,
        );
        addToRoot(clipG || g, element);
      }
      break;
    }
    // frames are not rendered and only acts as a container
    case "frame":
    case "magicframe": {
      if (
        renderConfig.frameRendering.enabled &&
        renderConfig.frameRendering.outline
      ) {
        const rect = document.createElementNS(SVG_NS, "rect");

        rect.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );

        rect.setAttribute("width", `${element.width}px`);
        rect.setAttribute("height", `${element.height}px`);
        // Rounded corners
        rect.setAttribute("rx", FRAME_STYLE.radius.toString());
        rect.setAttribute("ry", FRAME_STYLE.radius.toString());

        rect.setAttribute("fill", "none");
        rect.setAttribute("stroke", FRAME_STYLE.strokeColor);
        rect.setAttribute("stroke-width", FRAME_STYLE.strokeWidth.toString());

        addToRoot(rect, element);
      }
      break;
    }
    default: {
      if (isTextElement(element)) {
        const node = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }

        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeightPx = getLineHeightInPx(
          element.fontSize,
          element.lineHeight,
        );
        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        const verticalOffset = getVerticalOffset(
          element.fontFamily,
          element.fontSize,
          lineHeightPx,
        );
        const direction = isRTL(element.text) ? "rtl" : "ltr";
        const textAnchor =
          element.textAlign === "center"
            ? "middle"
            : element.textAlign === "right" || direction === "rtl"
            ? "end"
            : "start";
        for (let i = 0; i < lines.length; i++) {
          const text = svgRoot.ownerDocument!.createElementNS(SVG_NS, "text");
          text.textContent = lines[i];
          text.setAttribute("x", `${horizontalOffset}`);
          text.setAttribute("y", `${i * lineHeightPx + verticalOffset}`);
          text.setAttribute("font-family", getFontFamilyString(element));
          text.setAttribute("font-size", `${element.fontSize}px`);
          text.setAttribute("fill", element.strokeColor);
          text.setAttribute("text-anchor", textAnchor);
          text.setAttribute("style", "white-space: pre;");
          text.setAttribute("direction", direction);
          text.setAttribute("dominant-baseline", "alphabetic");
          node.appendChild(text);
        }

        const g = maybeWrapNodesInFrameClipPath(
          element,
          root,
          [node],
          renderConfig.frameRendering,
          elementsMap,
        );

        addToRoot(g || node, element);
      } else {
        // @ts-ignore
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};

export const renderSceneToSvg = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: RenderableElementsMap,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  renderConfig: SVGRenderConfig,
) => {
  if (!svgRoot) {
    return;
  }

  // render elements
  elements
    .filter((el) => !isIframeLikeElement(el))
    .forEach((element) => {
      if (!element.isDeleted) {
        if (
          isTextElement(element) &&
          element.containerId &&
          elementsMap.has(element.containerId)
        ) {
          // will be rendered with the container
          return;
        }

        try {
          renderElementToSvg(
            element,
            elementsMap,
            rsvg,
            svgRoot,
            files,
            element.x + renderConfig.offsetX,
            element.y + renderConfig.offsetY,
            renderConfig,
          );

          const boundTextElement = getBoundTextElement(element, elementsMap);
          if (boundTextElement) {
            renderElementToSvg(
              boundTextElement,
              elementsMap,
              rsvg,
              svgRoot,
              files,
              boundTextElement.x + renderConfig.offsetX,
              boundTextElement.y + renderConfig.offsetY,
              renderConfig,
            );
          }
        } catch (error: any) {
          console.error(error);
        }
      }
    });

  // render embeddables on top
  elements
    .filter((el) => isIframeLikeElement(el))
    .forEach((element) => {
      if (!element.isDeleted) {
        try {
          renderElementToSvg(
            element,
            elementsMap,
            rsvg,
            svgRoot,
            files,
            element.x + renderConfig.offsetX,
            element.y + renderConfig.offsetY,
            renderConfig,
          );
        } catch (error: any) {
          console.error(error);
        }
      }
    });
};

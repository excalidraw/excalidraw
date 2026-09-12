import { useEffect, useState } from "react";
import Spinner from "@excalidraw/excalidraw/components/Spinner";

interface QRCodeProps {
  value: string;
}

const sanitizeSVG = (svgString: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");

    // Check if DOMParser encountered parsing errors
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      return "";
    }

    const allowedTags = [
      "svg",
      "path",
      "rect",
      "circle",
      "polygon",
      "line",
      "g",
    ];
    const allowedAttrs = new Set([
      "xmlns",
      "viewbox",
      "width",
      "height",
      "fill",
      "stroke",
      "d",
      "x",
      "y",
      "cx",
      "cy",
      "r",
      "points",
      "x1",
      "y1",
      "x2",
      "y2",
      "stroke-width",
      "class",
      "style",
      "shape-rendering",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-opacity",
      "fill-rule",
      "fill-opacity",
      "opacity",
    ]);

    const cleanElement = (el: Element): Element => {
      const tagName = el.tagName.toLowerCase();
      if (!allowedTags.includes(tagName)) {
        const placeholder = doc.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        return placeholder;
      }

      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || !allowedAttrs.has(name)) {
          el.removeAttribute(attr.name);
        }
      }

      const children = Array.from(el.children);
      for (const child of children) {
        const cleanedChild = cleanElement(child);
        if (cleanedChild !== child) {
          el.replaceChild(cleanedChild, child);
        }
      }

      return el;
    };

    const root = doc.documentElement;
    if (root && root.tagName.toLowerCase() === "svg") {
      const cleanedRoot = cleanElement(root);
      const serializer = new XMLSerializer();
      return serializer.serializeToString(cleanedRoot);
    }
  } catch (err) {
    console.error("SVG sanitization failed:", err);
  }
  return "";
};

export const QRCode = ({ value }: QRCodeProps) => {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    import("./qrcode.chunk")
      .then(({ generateQRCodeSVG }) => {
        if (mounted) {
          try {
            setSvgData(generateQRCodeSVG(value));
          } catch {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [value]);

  if (error) {
    return null;
  }

  if (!svgData) {
    return (
      <div className="ShareDialog__active__qrcode ShareDialog__active__qrcode--loading">
        <Spinner />
      </div>
    );
  }

  const sanitizedSvg = sanitizeSVG(svgData);

  return (
    <div
      className="ShareDialog__active__qrcode"
      role="img"
      aria-label="QR code for collaboration link"
      dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
    />
  );
};

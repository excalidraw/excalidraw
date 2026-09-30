import { outlineLine } from "./textOutlines";

import type { FontLibrary } from "./fontLibrary";

const SVG_NS = "http://www.w3.org/2000/svg";

/** css family -> the bundled family that actually has outlines for it */
const ALIASES: Record<string, string> = {
  helvetica: "Liberation Sans",
  arial: "Liberation Sans",
  "sans-serif": "Liberation Sans",
  monospace: "Cascadia",
};
/** the emoji font is colour-only; emoji are drawn via the platform instead */
const SKIP_FAMILIES = new Set(["segoe ui emoji"]);

export const parseFamilies = (attr: string | null): string[] => {
  const out: string[] = [];
  for (const raw of (attr ?? "").split(",")) {
    const name = raw.trim().replace(/^["']|["']$/g, "");
    if (!name || SKIP_FAMILIES.has(name.toLowerCase())) {
      continue;
    }
    out.push(ALIASES[name.toLowerCase()] ?? name);
  }
  // always end with a family that has broad Latin coverage
  if (!out.includes("Liberation Sans")) {
    out.push("Liberation Sans");
  }
  return out;
};

export interface CharRaster {
  dataUrl: string;
  /** css px */
  width: number;
  height: number;
  /** distance from the top of the bitmap to the text baseline, css px */
  ascent: number;
}

export interface OutlineDeps {
  library: FontLibrary;
  /** advance width in px for a character no bundled font has (emoji etc.) */
  measureChar: (char: string, fontSize: number) => number;
  /** draws a single character with platform fonts */
  rasterizeChar: (
    char: string,
    fontSize: number,
    color: string,
  ) => CharRaster | null;
}

const isLatin1 = (s: string) =>
  Array.from(s).every((c) => c.codePointAt(0)! <= 0xff);

/**
 * Replaces every <text> with vector glyph outlines so the PDF looks exactly like the
 * canvas regardless of fonts installed anywhere, and keeps an invisible text layer
 * (when representable in a standard PDF font) so the text stays searchable/selectable.
 */
export const replaceTextWithOutlines = async (
  svg: SVGSVGElement,
  deps: OutlineDeps,
) => {
  const texts = Array.from(svg.querySelectorAll("text"));
  let outlined = 0;
  for (const text of texts) {
    const content = text.textContent ?? "";
    const parent = text.parentNode;
    if (!parent) {
      continue;
    }
    if (content.trim() === "") {
      text.remove();
      continue;
    }
    const fontSize = parseFloat(text.getAttribute("font-size") ?? "16") || 16;
    const families = parseFamilies(text.getAttribute("font-family"));
    const x = parseFloat(text.getAttribute("x") ?? "0") || 0;
    const y = parseFloat(text.getAttribute("y") ?? "0") || 0;
    const anchor = text.getAttribute("text-anchor") ?? "start";
    const direction = text.getAttribute("direction") === "rtl" ? "rtl" : "ltr";
    const fill = text.getAttribute("fill") ?? "#000000";
    const fillOpacity = text.getAttribute("fill-opacity");

    const line = await outlineLine(
      deps.library,
      content,
      families,
      fontSize,
      (ch) => deps.measureChar(ch, fontSize),
      direction,
    );
    const x0 =
      anchor === "middle"
        ? x - line.width / 2
        : anchor === "end"
        ? x - line.width
        : x;

    if (line.d) {
      const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
      path.setAttribute("d", line.d);
      path.setAttribute("transform", `translate(${x0} ${y})`);
      path.setAttribute("fill", fill);
      if (fillOpacity) {
        path.setAttribute("fill-opacity", fillOpacity);
      }
      parent.insertBefore(path, text);
    }
    for (const m of line.missing) {
      const r = deps.rasterizeChar(m.char, fontSize, fill);
      if (!r) {
        continue;
      }
      const img = svg.ownerDocument.createElementNS(SVG_NS, "image");
      img.setAttribute("href", r.dataUrl);
      img.setAttribute("x", `${x0 + m.x}`);
      img.setAttribute("y", `${y - r.ascent}`);
      img.setAttribute("width", `${r.width}`);
      img.setAttribute("height", `${r.height}`);
      parent.insertBefore(img, text);
    }

    if (isLatin1(content) && direction === "ltr") {
      // invisible, but real, text for search / copy
      text.setAttribute("font-family", "Helvetica");
      text.setAttribute("fill", "#000000");
      text.setAttribute("fill-opacity", "0");
      text.removeAttribute("style");
    } else {
      text.remove();
    }
    outlined++;
  }
  return outlined;
};

// ---------------------------------------------------------------------------- images

const PDF_IMAGE = /^data:image\/(png|jpe?g);/i;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });

/**
 * jsPDF embeds PNG and JPEG only; anything else (svg, webp, gif, bmp) is re-encoded
 * to PNG at up to 2x its displayed size.
 */
export const rasterizeUnsupportedImages = async (svg: SVGSVGElement) => {
  const images = Array.from(svg.querySelectorAll("image"));
  for (const el of images) {
    const href =
      el.getAttribute("href") ??
      el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href || !href.startsWith("data:") || PDF_IMAGE.test(href)) {
      continue;
    }
    try {
      const img = await loadImage(href);
      const dw =
        parseFloat(el.getAttribute("width") ?? "") || img.naturalWidth || 512;
      const dh =
        parseFloat(el.getAttribute("height") ?? "") || img.naturalHeight || 512;
      const scale = Math.min(2, 4096 / Math.max(dw, dh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(dw * scale));
      canvas.height = Math.max(1, Math.round(dh * scale));
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      el.setAttribute("href", canvas.toDataURL("image/png"));
      el.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    } catch {
      el.remove(); // an undecodable image should not sink the whole export
    }
  }
};

// ---------------------------------------------------------------------------- browser deps

export const browserCharTools = () => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const stack = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  return {
    measureChar: (char: string, fontSize: number) => {
      ctx.font = `${fontSize}px ${stack}`;
      return ctx.measureText(char).width;
    },
    rasterizeChar: (
      char: string,
      fontSize: number,
      color: string,
    ): CharRaster | null => {
      const scale = 3;
      ctx.font = `${fontSize * scale}px ${stack}`;
      const m = ctx.measureText(char);
      const w = Math.ceil(m.width) + 4;
      const ascent =
        Math.ceil(m.actualBoundingBoxAscent || fontSize * scale * 0.9) + 2;
      const descent =
        Math.ceil(m.actualBoundingBoxDescent || fontSize * scale * 0.25) + 2;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = ascent + descent;
      const cx = c.getContext("2d")!;
      cx.font = `${fontSize * scale}px ${stack}`;
      cx.fillStyle = color;
      cx.textBaseline = "alphabetic";
      cx.fillText(char, 2, ascent);
      return {
        dataUrl: c.toDataURL("image/png"),
        width: c.width / scale,
        height: c.height / scale,
        ascent: ascent / scale,
      };
    },
  };
};

import { exportToSvg } from "@excalidraw/excalidraw";
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { getSlideElements } from "../presentation/slides";

import { getBrowserFontLibrary } from "./browserFonts";
import { pageSizeFromSvg, safeFileName } from "./pdfUtils";
import {
  browserCharTools,
  rasterizeUnsupportedImages,
  replaceTextWithOutlines,
} from "./svgPrep";

import type { OutlineDeps } from "./svgPrep";

export type PdfScope = "frames" | "scene" | "selection";

export interface PdfExportOptions {
  elements: readonly any[];
  files: BinaryFiles;
  appState: Partial<AppState>;
  scope: PdfScope;
  /** ids for scope "selection" (bound text is included automatically by the editor export) */
  selectedIds?: readonly string[];
  background: boolean;
  darkMode: boolean;
  title: string;
  padding?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface PdfPage {
  svg: SVGSVGElement;
  widthPx: number;
  heightPx: number;
  name: string;
}

const PX_TO_PT = 0.75; // Excalidraw units are CSS px; PDF units are pt

export class NothingToExportError extends Error {}

/** SVG page sources: one per frame (in slide order) or a single page for the scene / selection. */
export const buildPageSvgs = async (
  o: PdfExportOptions,
): Promise<PdfPage[]> => {
  const live = o.elements.filter((e) => !e.isDeleted);
  const appState = {
    ...o.appState,
    exportBackground: o.background,
    exportWithDarkMode: o.darkMode,
    exportEmbedScene: false,
  } as any;
  const render = (
    elements: readonly any[],
    frame: any | null,
    padding: number,
  ) =>
    exportToSvg({
      elements: elements as any,
      appState,
      files: o.files,
      exportPadding: padding,
      exportingFrame: frame,
      // fonts are replaced by outlines below; embedding them would only bloat the SVG
      skipInliningFonts: true,
    });

  const toPage = (svg: SVGSVGElement, name: string): PdfPage => ({
    svg,
    name,
    ...pageSizeFromSvg(svg),
  });

  if (o.scope === "frames") {
    const frames = getSlideElements(live);
    if (frames.length > 0) {
      const pages: PdfPage[] = [];
      for (const [i, frame] of frames.entries()) {
        pages.push(
          toPage(await render(live, frame, 0), frame.name || `Slide ${i + 1}`),
        );
      }
      return pages;
    }
    // no frames: behave like "scene" rather than failing
  }

  let elements = live;
  if (o.scope === "selection") {
    const ids = new Set(o.selectedIds ?? []);
    elements = live.filter(
      (e) => ids.has(e.id) || (e.containerId && ids.has(e.containerId)),
    );
  }
  if (elements.length === 0) {
    throw new NothingToExportError("There is nothing to export.");
  }
  return [toPage(await render(elements, null, o.padding ?? 24), o.title)];
};

const attachOffscreen = (svg: SVGSVGElement) => {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  host.appendChild(svg);
  document.body.appendChild(host);
  return () => host.remove();
};

export const exportPdf = async (
  o: PdfExportOptions,
  deps: OutlineDeps = {
    library: getBrowserFontLibrary(),
    ...browserCharTools(),
  },
): Promise<Blob> => {
  const pages = await buildPageSvgs(o);
  let doc: jsPDF | null = null;

  for (const [i, page] of pages.entries()) {
    await replaceTextWithOutlines(page.svg, deps);
    await rasterizeUnsupportedImages(page.svg);

    const w = Math.max(1, page.widthPx * PX_TO_PT);
    const h = Math.max(1, page.heightPx * PX_TO_PT);
    const orientation = w >= h ? "landscape" : "portrait";
    if (!doc) {
      doc = new jsPDF({
        unit: "pt",
        format: [w, h],
        orientation,
        compress: true,
        putOnlyUsedFonts: true,
      });
    } else {
      doc.addPage([w, h], orientation);
    }
    const detach = attachOffscreen(page.svg);
    try {
      await svg2pdf(page.svg, doc, { x: 0, y: 0, width: w, height: h });
    } finally {
      detach();
    }
    o.onProgress?.(i + 1, pages.length);
  }

  doc!.setProperties({
    title: o.title,
    creator: "Excalidraw Workspace",
    subject: `${pages.length} page(s)`,
  });
  return doc!.output("blob");
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

export { pageSizeFromSvg, safeFileName };

import { exportToBlob } from "@excalidraw/excalidraw";
import { getCommonBounds } from "@excalidraw/element";
import PptxGenJS from "pptxgenjs";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { getSlideElements } from "../presentation/slides";

import { NothingToExportError } from "./pdf";
import { deckSize, elementsForPage, planPage } from "./pptxPlan";

import type { Command, PageSpec } from "./pptxPlan";

export type PptxMode = "editable" | "picture";

export interface PptxExportOptions {
  elements: readonly any[];
  files: BinaryFiles;
  appState: Partial<AppState>;
  scope: "frames" | "scene";
  mode: PptxMode;
  background: boolean;
  title: string;
  onProgress?: (done: number, total: number) => void;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });

/** PowerPoint-safe bitmap: PNG/JPEG only, with Excalidraw's crop applied. */
export const prepareImage = async (
  dataUrl: string,
  crop: any | null,
): Promise<string> => {
  const plain = /^data:image\/(png|jpe?g);/i.test(dataUrl);
  if (plain && !crop) {
    return dataUrl;
  }
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  if (crop && crop.naturalWidth) {
    // crop rect is expressed in the image's natural pixel space
    const sx = (img.naturalWidth / crop.naturalWidth) * crop.x;
    const sy = (img.naturalHeight / crop.naturalHeight) * crop.y;
    const sw = (img.naturalWidth / crop.naturalWidth) * crop.width;
    const sh = (img.naturalHeight / crop.naturalHeight) * crop.height;
    c.width = Math.max(1, Math.round(sw));
    c.height = Math.max(1, Math.round(sh));
    c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  } else {
    c.width = img.naturalWidth || 512;
    c.height = img.naturalHeight || 512;
    c.getContext("2d")!.drawImage(img, 0, 0);
  }
  return c.toDataURL("image/png");
};

export const buildPages = (
  elements: readonly any[],
  scope: "frames" | "scene",
  title: string,
): PageSpec[] => {
  const live = elements.filter((e) => !e.isDeleted);
  if (scope === "frames") {
    const frames = getSlideElements(live);
    if (frames.length) {
      return frames.map((f, i) => ({
        name: f.name || `Slide ${i + 1}`,
        bounds: { x: f.x, y: f.y, w: f.width, h: f.height },
        frameId: f.id as string,
      }));
    }
  }
  const drawable = live.filter(
    (e) => e.type !== "frame" && e.type !== "magicframe",
  );
  if (drawable.length === 0) {
    throw new NothingToExportError("There is nothing to export.");
  }
  const [x1, y1, x2, y2] = getCommonBounds(drawable as any);
  const pad = 32;
  return [
    {
      name: title,
      bounds: {
        x: x1 - pad,
        y: y1 - pad,
        w: x2 - x1 + pad * 2,
        h: y2 - y1 + pad * 2,
      },
      frameId: null,
    },
  ];
};

const SHAPES = {
  rect: "rect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  diamond: "diamond",
} as const;

const applyCommand = async (
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  cmd: Command,
  files: BinaryFiles,
  imageCache: Map<string, Promise<string>>,
) => {
  const box = { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h };
  switch (cmd.kind) {
    case "shape":
      slide.addShape(pptx.ShapeType[SHAPES[cmd.shape]], {
        ...box,
        rotate: cmd.rotate,
        ...(cmd.radius !== undefined ? { rectRadius: cmd.radius } : {}),
        fill: cmd.fill.color
          ? { color: cmd.fill.color, transparency: cmd.fill.transparency }
          : { type: "none" },
        line: cmd.stroke
          ? {
              color: cmd.stroke.color,
              width: cmd.stroke.widthPt,
              dashType: cmd.stroke.dash,
              transparency: cmd.stroke.transparency,
            }
          : { type: "none" },
      } as any);
      break;
    case "path":
      slide.addShape(
        "custGeom" as any,
        {
          ...box,
          points: cmd.points,
          fill: cmd.fill.color
            ? { color: cmd.fill.color, transparency: cmd.fill.transparency }
            : { type: "none" },
          line: cmd.stroke
            ? {
                color: cmd.stroke.color,
                width: cmd.stroke.widthPt,
                dashType: cmd.stroke.dash,
                transparency: cmd.stroke.transparency,
                beginArrowType: cmd.beginArrow,
                endArrowType: cmd.endArrow,
              }
            : { type: "none" },
        } as any,
      );
      break;
    case "text":
      slide.addText(cmd.text, {
        ...box,
        fontFace: cmd.fontFace,
        fontSize: cmd.fontPt,
        color: cmd.color,
        align: cmd.align,
        valign: cmd.valign,
        margin: 0,
        wrap: false,
        fit: "none",
        lineSpacingMultiple: cmd.lineSpacing,
        rotate: cmd.rotate,
        transparency: cmd.transparency,
      } as any);
      break;
    case "image": {
      const file = files[cmd.fileId];
      if (!file) {
        break; // missing bytes: leave a hole rather than failing the export
      }
      const key = `${cmd.fileId}:${JSON.stringify(cmd.crop)}`;
      let p = imageCache.get(key);
      if (!p) {
        p = prepareImage(file.dataURL, cmd.crop);
        imageCache.set(key, p);
      }
      try {
        slide.addImage({
          ...box,
          data: await p,
          rotate: cmd.rotate,
          flipH: cmd.flipH,
          flipV: cmd.flipV,
          transparency: cmd.transparency,
        } as any);
      } catch {
        /* undecodable image: skip it */
      }
      break;
    }
  }
};

export const exportPptx = async (o: PptxExportOptions): Promise<Blob> => {
  const pages = buildPages(o.elements, o.scope, o.title);
  const deck = deckSize(pages);
  const pptx = new PptxGenJS();
  pptx.title = o.title;
  pptx.author = "Excalidraw Workspace";
  pptx.company = "Excalidraw Workspace";
  pptx.defineLayout({ name: "SCENE", width: deck.w / 96, height: deck.h / 96 });
  pptx.layout = "SCENE";

  const live = o.elements.filter((e) => !e.isDeleted);
  const bg = (o.appState.viewBackgroundColor ?? "#ffffff")
    .replace("#", "")
    .slice(0, 6);
  const imageCache = new Map<string, Promise<string>>();

  for (const [i, page] of pages.entries()) {
    const slide = pptx.addSlide();
    if (o.background) {
      slide.background = { color: bg };
    }
    const onPage = elementsForPage(live, page);
    const notes = onPage
      .filter((e) => e.type === "text" && e.text)
      .map((e) => e.text)
      .join("\n");
    slide.addNotes(`${page.name}${notes ? `\n\n${notes}` : ""}`);

    if (o.mode === "picture") {
      const frame = page.frameId
        ? live.find((e) => e.id === page.frameId)
        : null;
      const blob = await exportToBlob({
        elements: live as any,
        appState: {
          ...o.appState,
          exportBackground: o.background,
          exportWithDarkMode: false,
          exportScale: 2,
        } as any,
        files: o.files,
        mimeType: "image/png",
        exportingFrame: frame as any,
        exportPadding: frame ? 0 : 32,
      } as any);
      slide.addImage({
        data: await blobToDataUrl(blob),
        x: 0,
        y: 0,
        w: deck.w / 96,
        h: deck.h / 96,
        sizing: { type: "contain", w: deck.w / 96, h: deck.h / 96 },
      } as any);
    } else {
      for (const cmd of planPage(live, page, deck)) {
        await applyCommand(pptx, slide, cmd, o.files, imageCache);
      }
    }
    o.onProgress?.(i + 1, pages.length);
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
};

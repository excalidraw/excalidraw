/**
 * Small canvas affordance for tiles that repeat the same Terraform `nodePath` with a distinct
 * layout id (VPC endpoint SG satellites, route-table column duplicates, etc.).
 */

import { MIME_TYPES, randomId } from "@excalidraw/common";

import {
  newElementWith,
  newImageElement,
  normalizeSVG,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/element/types";

import { getDataURL_sync } from "../data/blob";

import type { BinaryFileData, BinaryFiles } from "../types";

const GLYPH_PX = 14;
const GLYPH_PAD = 3;

async function readTerraformLayoutDuplicateInfoSvg(): Promise<string> {
  if (import.meta.env.VITEST) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const base = path.dirname(fileURLToPath(import.meta.url));
    return fs.readFileSync(
      path.join(base, "info-circle-svgrepo-com.svg"),
      "utf-8",
    );
  }
  const res = await fetch(
    new URL("./info-circle-svgrepo-com.svg", import.meta.url),
  );
  if (!res.ok) {
    throw new Error(`Failed to load info SVG: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Inserts a tiny “info” image above each `terraformSemanticLayoutDuplicate` resource card.
 * Returns binary file data for a single shared SVG so the host can register it (e.g.
 * `app.addFiles`) before the scene renders.
 */
export async function injectTerraformLayoutDuplicateInfoGlyphs(
  elements: readonly ExcalidrawElement[],
): Promise<{ elements: ExcalidrawElement[]; files: BinaryFiles }> {
  const targets: { insertAt: number; rect: ExcalidrawElement }[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    if (el.type !== "rectangle" || el.isDeleted) {
      continue;
    }
    const cd = el.customData ?? {};
    if (cd.terraformSemanticLayoutDuplicate !== true) {
      continue;
    }
    targets.push({ insertAt: i + 1, rect: el });
  }
  if (targets.length === 0) {
    return { elements: elements as ExcalidrawElement[], files: {} };
  }

  let svgText: string;
  try {
    svgText = await readTerraformLayoutDuplicateInfoSvg();
  } catch {
    return { elements: elements as ExcalidrawElement[], files: {} };
  }

  const fileId = randomId() as FileId;
  const dataURL = getDataURL_sync(
    normalizeSVG(svgText),
    MIME_TYPES.svg,
  ) as BinaryFileData["dataURL"];

  const fileEntry: BinaryFileData = {
    id: fileId,
    mimeType: MIME_TYPES.svg,
    dataURL,
    created: Date.now(),
  };

  const sorted = [...targets].sort((a, b) => b.insertAt - a.insertAt);
  const next = elements.slice() as ExcalidrawElement[];

  for (const { insertAt, rect } of sorted) {
    const img = newElementWith(
      newImageElement({
        type: "image",
        x: rect.x + (rect.width ?? 0) - GLYPH_PX - GLYPH_PAD,
        y: rect.y + GLYPH_PAD,
        width: GLYPH_PX,
        height: GLYPH_PX,
        fileId,
        status: "saved",
        frameId: rect.frameId ?? null,
        opacity: rect.opacity ?? 100,
        customData: {
          terraform: true,
          terraformLayoutDuplicateGlyph: true,
        },
      }),
      { isDeleted: rect.isDeleted },
    );
    next.splice(insertAt, 0, img);
  }

  return {
    elements: next,
    files: { [fileId]: fileEntry } as BinaryFiles,
  };
}

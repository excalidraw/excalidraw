import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import terraformAwsIconTypeNames from "../assets/terraform-aws-icon-type-names.json";

import { tfComfortPx } from "./terraformLayoutComfort";

const px = tfComfortPx;

const TERRAFORM_AWS_ICON_PAD = px(12);
const TERRAFORM_AWS_ICON_SIZE = px(36);
/** Matches `TERRAFORM_RESOURCE_LABEL_STROKE` in `terraformElkLayout.ts`. */
const TERRAFORM_RESOURCE_LABEL_STROKE = "#1e1e1e";

type IconLibItem =
  | readonly unknown[]
  | { name?: string; elements?: readonly unknown[] };

let libraryItems: IconLibItem[] | null = null;
let nameToIndexLower: Record<string, number> = {};

function rand() {
  return Math.floor(Math.random() * 2147483647);
}

async function readAwsIconLibraryText(): Promise<string> {
  if (import.meta.env.VITEST) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const base = path.dirname(fileURLToPath(import.meta.url));
    return fs.readFileSync(
      path.join(base, "../assets/aws-architecture-icons.excalidrawlib"),
      "utf-8",
    );
  }
  const res = await fetch(
    new URL("../assets/aws-architecture-icons.excalidrawlib", import.meta.url),
  );
  if (!res.ok) {
    throw new Error(`Failed to load AWS icon library: HTTP ${res.status}`);
  }
  return res.text();
}

/** Parses and caches the `.excalidrawlib` (v1 or v2). Safe to call multiple times. */
export async function ensureTerraformAwsIconLibraryLoaded(): Promise<void> {
  if (libraryItems) {
    return;
  }
  const text = await readAwsIconLibraryText();
  const raw = JSON.parse(text) as {
    libraryItems?: IconLibItem[];
    library?: IconLibItem[];
  };
  const items = raw.libraryItems || raw.library || [];
  libraryItems = items;
  nameToIndexLower = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = (
      Array.isArray(item) ? undefined : (item as { name?: string }).name
    )
      ?.toLowerCase()
      .trim();
    if (name) {
      nameToIndexLower[name] = i;
    }
  }
}

function getIconTemplateElements(
  resourceType: string,
): readonly Record<string, unknown>[] | null {
  if (!libraryItems) {
    return null;
  }
  const names = terraformAwsIconTypeNames as Record<string, string>;
  const iconName = names[resourceType];
  if (!iconName) {
    return null;
  }
  const idx = nameToIndexLower[iconName.toLowerCase()];
  if (idx === undefined || idx >= libraryItems.length) {
    return null;
  }
  const item = libraryItems[idx];
  const raw = Array.isArray(item)
    ? item
    : (item as { elements?: readonly unknown[] }).elements || null;
  if (!raw?.length) {
    return null;
  }
  return raw as readonly Record<string, unknown>[];
}

function cloneIconElements(
  origElements: readonly Record<string, unknown>[],
  targetX: number,
  targetY: number,
  targetSize: number,
  parentGroupIds: string[],
  opts: { frameId: string | null; opacity: number },
): ExcalidrawElement[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of origElements) {
    const x = e.x as number;
    const y = e.y as number;
    const w = (e.width as number) || 0;
    const h = (e.height as number) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  const origW = maxX - minX || 1;
  const origH = maxY - minY || 1;
  const scale = Math.min(targetSize / origW, targetSize / origH);
  const scaledW = origW * scale;
  const scaledH = origH * scale;
  const offsetX = targetX + (targetSize - scaledW) / 2;
  const offsetY = targetY + (targetSize - scaledH) / 2;

  const groupIdMap: Record<string, string> = {};
  for (const e of origElements) {
    for (const gid of (e.groupIds as string[] | undefined) || []) {
      if (!groupIdMap[gid]) {
        groupIdMap[gid] = `icg-${rand()}`;
      }
    }
  }

  const outerGroupId = `ico-${rand()}`;

  return origElements.map((e) => {
    const cloned = {
      ...e,
      id: `ic-${rand()}`,
      x: ((e.x as number) - minX) * scale + offsetX,
      y: ((e.y as number) - minY) * scale + offsetY,
      width: ((e.width as number) || 0) * scale,
      height: ((e.height as number) || 0) * scale,
      seed: rand(),
      versionNonce: rand(),
      groupIds: [
        ...parentGroupIds,
        outerGroupId,
        ...((e.groupIds as string[] | undefined) || []).map(
          (gid) => groupIdMap[gid],
        ),
      ],
      boundElements: null,
      containerId: null,
      updated: Date.now(),
      frameId: opts.frameId,
      opacity: opts.opacity,
      link: null,
      locked: false,
      isDeleted: false,
    } as Record<string, unknown>;
    if (typeof e.fontSize === "number") {
      cloned.fontSize = Math.max(1, e.fontSize * scale);
    }
    if (typeof e.strokeWidth === "number") {
      cloned.strokeWidth = Math.max(1, e.strokeWidth * scale);
    }
    if (Array.isArray(e.points)) {
      cloned.points = (e.points as number[][]).map(([px, py]) => [
        px * scale,
        py * scale,
      ]);
    }
    return cloned as unknown as ExcalidrawElement;
  });
}

/**
 * After `mirrorAndDetachTerraformResourceLabels`, insert AWS icon glyphs for resource cards and
 * shift detached labels left gutter (matches backend `excalidraw.js` card layout).
 */
export async function injectTerraformAwsIconsIntoElements(
  elements: readonly ExcalidrawElement[],
): Promise<ExcalidrawElement[]> {
  await ensureTerraformAwsIconLibraryLoaded();

  const iconPad = TERRAFORM_AWS_ICON_PAD;
  const iconSize = TERRAFORM_AWS_ICON_SIZE;
  const iconArea = iconSize + iconPad;

  type Work = {
    textIdx: number;
    rectId: string;
    resourceType: string;
  };
  const work: Work[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type !== "rectangle") {
      continue;
    }
    const cd = el.customData ?? {};
    if (cd.terraformVisibilityRole !== "resource") {
      continue;
    }
    const nodePath = cd.terraformVisibilityKey as string | undefined;
    const resourceType = cd.resourceType as string | undefined;
    if (!nodePath || !resourceType) {
      continue;
    }
    const template = getIconTemplateElements(resourceType);
    if (!template?.length) {
      continue;
    }

    let textIdx = -1;
    for (let j = 0; j < elements.length; j++) {
      const t = elements[j];
      if (t.type !== "text") {
        continue;
      }
      if ("containerId" in t && t.containerId) {
        continue;
      }
      const tcd = t.customData ?? {};
      if (
        tcd.terraformVisibilityRole === "resource" &&
        tcd.terraformVisibilityKey === nodePath
      ) {
        textIdx = j;
        break;
      }
    }
    if (textIdx < 0) {
      continue;
    }

    work.push({ textIdx, rectId: el.id, resourceType });
  }

  work.sort((a, b) => b.textIdx - a.textIdx);

  const out = elements.slice() as ExcalidrawElement[];
  for (const { textIdx, rectId, resourceType } of work) {
    const rectIdx = out.findIndex((e) => e.id === rectId);
    if (rectIdx < 0) {
      continue;
    }
    const rectInOut = out[rectIdx];
    if (rectInOut.type !== "rectangle") {
      continue;
    }
    const template = getIconTemplateElements(resourceType);
    if (!template?.length) {
      continue;
    }

    const pinId = `tfpin-${rand()}`;
    const baseGroups = rectInOut.groupIds ?? [];
    const stacked = [...baseGroups, pinId];

    out[rectIdx] = newElementWith(rectInOut, { groupIds: stacked });

    const card = out[rectIdx]!;
    const iconX = card.x + iconPad;
    const iconY = card.y + (card.height - iconSize) / 2;
    const iconCustomData = {
      terraform: true,
      terraformAwsIconGlyph: true,
    };

    const icons = cloneIconElements(
      [...template],
      iconX,
      iconY,
      iconSize,
      stacked,
      {
        frameId: card.frameId ?? null,
        opacity: card.opacity ?? 100,
      },
    ).map((iconEl) =>
      newElementWith(iconEl, {
        isDeleted: card.isDeleted,
        customData: {
          ...iconCustomData,
        },
      }),
    );

    out.splice(textIdx, 0, ...icons);
    const textEl = out[textIdx + icons.length];
    if (!textEl || textEl.type !== "text") {
      continue;
    }
    out[textIdx + icons.length] = newElementWith(textEl, {
      x: card.x + iconArea + px(8),
      y: card.y + px(10),
      width: card.width - iconArea - px(16),
      height: card.height - px(20),
      textAlign: "left",
      verticalAlign: "middle",
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
      groupIds: stacked,
    });
  }

  return out;
}

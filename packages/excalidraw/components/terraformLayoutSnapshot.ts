import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformVisibilityKey } from "./terraformVisibility";

type LooseElement = ExcalidrawElement & {
  customData?: Record<string, unknown>;
  name?: string | null;
};

const ROUND = 2;

function roundNum(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return null;
  }
  const f = 10 ** ROUND;
  return Math.round(n * f) / f;
}

function pickCustomData(customData: Record<string, unknown> | undefined) {
  if (!customData) {
    return undefined;
  }
  const keys = [
    "nodePath",
    "terraformVisibilityKey",
    "terraformVisibilityRole",
    "terraformTopologyRole",
    "terraformTopologyPath",
    "terraformEdgeLayer",
    "terraformProviderFamily",
    "resourceType",
    "terraformCategoryId",
    "terraformModulePath",
    "terraformExplodeParentKeys",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = customData[key];
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function stableElementKey(
  element: LooseElement,
  index: number,
  idToKey: Map<string, string>,
): string {
  const visibilityKey = getTerraformVisibilityKey(element);
  if (typeof visibilityKey === "string" && visibilityKey.length > 0) {
    return visibilityKey;
  }

  const customData = element.customData;
  if (element.type === "frame") {
    const topologyPath = customData?.terraformTopologyPath;
    if (Array.isArray(topologyPath) && topologyPath.length > 0) {
      return `frame:${topologyPath.join("/")}`;
    }
    if (typeof element.name === "string" && element.name.length > 0) {
      return `frame:${element.name}`;
    }
  }

  if (
    (element.type === "arrow" || element.type === "line") &&
    typeof customData?.nodePath === "string"
  ) {
    return `edge:${customData.nodePath}`;
  }

  if (element.type === "text") {
    const nodePath =
      typeof customData?.nodePath === "string" ? customData.nodePath : "";
    const role =
      typeof customData?.terraformVisibilityRole === "string"
        ? customData.terraformVisibilityRole
        : "text";
    if (nodePath) {
      return `text:${nodePath}:${role}`;
    }
  }

  if (
    "containerId" in element &&
    typeof element.containerId === "string" &&
    idToKey.has(element.containerId)
  ) {
    return `${idToKey.get(element.containerId)}::${element.type}:${index}`;
  }

  if (typeof element.frameId === "string" && idToKey.has(element.frameId)) {
    return `${idToKey.get(element.frameId)}::${element.type}:${index}`;
  }

  return `${element.type}:orphan:${index}`;
}

function stableRef(
  id: string | null | undefined,
  idToKey: Map<string, string>,
): string | null {
  if (!id) {
    return null;
  }
  return idToKey.get(id) ?? null;
}

function layoutBox(element: LooseElement) {
  return {
    x: roundNum(element.x),
    y: roundNum(element.y),
    width: roundNum(element.width),
    height: roundNum(element.height),
    angle: roundNum(element.angle),
  };
}

export type TerraformLayoutSnapshot = {
  meta: Record<string, unknown>;
  elements: Array<Record<string, unknown>>;
};

/** Deterministic layout fingerprint for golden snapshot tests. */
export function buildTerraformLayoutSnapshot(body: {
  meta?: Record<string, unknown>;
  elements?: readonly LooseElement[];
}): TerraformLayoutSnapshot {
  const elements = [...(body.elements ?? [])].sort((a, b) => {
    const ak = a.customData?.nodePath ?? a.name ?? a.type;
    const bk = b.customData?.nodePath ?? b.name ?? b.type;
    const cmp = String(ak).localeCompare(String(bk));
    if (cmp !== 0) {
      return cmp;
    }
    return String(a.type).localeCompare(String(b.type));
  });

  const idToKey = new Map<string, string>();
  elements.forEach((element, index) => {
    idToKey.set(element.id, stableElementKey(element, index, new Map()));
  });
  elements.forEach((element, index) => {
    idToKey.set(element.id, stableElementKey(element, index, idToKey));
  });

  const snapshotElements = elements.map((element, index) => {
    const key = stableElementKey(element, index, idToKey);
    const record: Record<string, unknown> = {
      key,
      type: element.type,
      ...layoutBox(element),
      isDeleted: element.isDeleted === true,
    };

    if (typeof element.name === "string" && element.name.length > 0) {
      record.name = element.name;
    }

    const customData = pickCustomData(element.customData);
    if (customData) {
      record.customData = customData;
    }

    const parentFrame = stableRef(element.frameId, idToKey);
    if (parentFrame) {
      record.parentFrame = parentFrame;
    }

    if ("containerId" in element && element.containerId) {
      record.container = stableRef(element.containerId, idToKey);
    }

    if (Array.isArray(element.groupIds) && element.groupIds.length > 0) {
      record.groupIds = element.groupIds
        .map((id) => stableRef(id, idToKey))
        .filter(Boolean);
    }

    if (element.type === "arrow" || element.type === "line") {
      const bound = element.boundElements ?? [];
      if (bound.length > 0) {
        record.boundElements = bound.map((b) => ({
          id: stableRef(b.id, idToKey),
          type: b.type,
        }));
      }
      if ("startBinding" in element && element.startBinding) {
        record.startBinding = stableRef(
          element.startBinding.elementId,
          idToKey,
        );
      }
      if ("endBinding" in element && element.endBinding) {
        record.endBinding = stableRef(element.endBinding.elementId, idToKey);
      }
    }

    if (element.strokeColor) {
      record.strokeColor = element.strokeColor;
    }
    if (element.backgroundColor) {
      record.backgroundColor = element.backgroundColor;
    }

    return record;
  });

  snapshotElements.sort((a, b) => String(a.key).localeCompare(String(b.key)));

  const meta = { ...(body.meta ?? {}) };
  delete meta.importWarnings;
  delete meta.warnings;

  return {
    meta,
    elements: snapshotElements,
  };
}

export function serializeTerraformLayoutSnapshot(
  snapshot: TerraformLayoutSnapshot,
): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

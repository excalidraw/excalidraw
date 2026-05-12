import type { TLShapePartial } from "tldraw";

type TerraformEdgeLayer = "dependency" | "dataFlow";
type TerraformVisibilityRole = "resource" | "group";

export type TerraformMeta = {
  terraformVisibilityRole?: TerraformVisibilityRole;
  terraformVisibilityKey?: string;
  terraformInitiallyVisible?: boolean;
  terraformNodeKind?: string;
  terraformExplodeParent?: string;
  terraformExplodeParentKeys?: string[];
  terraformGroupChildKeys?: string[];
  terraformExploded?: boolean;
  terraformEdgeLayer?: TerraformEdgeLayer;
  relationship?: { source?: string; target?: string };
  terraformCategoryId?: string;
  nodePath?: string;
};

export type TerraformLayerState = {
  dependencyLayerEnabled: boolean;
  dataFlowLayerEnabled: boolean;
};

const getMeta = (shape: TLShapePartial): TerraformMeta =>
  ((shape.meta as TerraformMeta | undefined) ?? {}) as TerraformMeta;

const getVisibilityKey = (shape: TLShapePartial): string | null => {
  const meta = getMeta(shape);
  return (
    meta.terraformVisibilityKey ??
    meta.terraformCategoryId ??
    meta.nodePath ??
    null
  );
};

const getParentKeys = (shape: TLShapePartial): Set<string> => {
  const meta = getMeta(shape);
  const out = new Set<string>();
  if (typeof meta.terraformExplodeParent === "string") {
    out.add(meta.terraformExplodeParent);
  }
  if (Array.isArray(meta.terraformExplodeParentKeys)) {
    for (const key of meta.terraformExplodeParentKeys) {
      if (typeof key === "string") {
        out.add(key);
      }
    }
  }
  return out;
};

const isResourceRole = (shape: TLShapePartial) =>
  getMeta(shape).terraformVisibilityRole === "resource";

const isGroupRole = (shape: TLShapePartial) =>
  getMeta(shape).terraformVisibilityRole === "group";

const getEdgeLayer = (shape: TLShapePartial): TerraformEdgeLayer | null => {
  const meta = getMeta(shape);
  const layer = meta.terraformEdgeLayer;
  if (layer === "dependency" || layer === "dataFlow") {
    return layer;
  }
  if (shape.type === "arrow" && meta.relationship) {
    // Some exported Terraform arrows omit explicit layer but still carry relationship metadata.
    return "dependency";
  }
  return null;
};

const isTerraformShape = (shape: TLShapePartial) =>
  Boolean(getMeta(shape).terraformVisibilityRole || getEdgeLayer(shape));

const computeVisibleResourceKeys = (
  shapes: readonly TLShapePartial[],
  expandedKeys: Set<string>,
) => {
  const visible = new Set<string>();
  const resources = shapes.filter((shape) => isResourceRole(shape));

  for (const shape of resources) {
    const key = getVisibilityKey(shape);
    if (!key) {
      continue;
    }
    if (getMeta(shape).terraformInitiallyVisible === true) {
      visible.add(key);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const shape of resources) {
      const key = getVisibilityKey(shape);
      if (!key || visible.has(key)) {
        continue;
      }
      const parents = getParentKeys(shape);
      for (const parent of parents) {
        if (expandedKeys.has(parent) && visible.has(parent)) {
          visible.add(key);
          changed = true;
          break;
        }
      }
    }
  }

  return visible;
};

const computeParentKeysWithChildren = (shapes: readonly TLShapePartial[]) => {
  const out = new Set<string>();
  for (const shape of shapes) {
    if (!isResourceRole(shape)) {
      continue;
    }
    for (const parent of getParentKeys(shape)) {
      out.add(parent);
    }
  }
  return out;
};

const hasChildren = (shapes: readonly TLShapePartial[], parentKey: string) => {
  return shapes.some((shape) => getParentKeys(shape).has(parentKey));
};

export const getSelectedExplodeTriggerKey = (
  selectedShapes: readonly TLShapePartial[],
  allShapes: readonly TLShapePartial[] = selectedShapes,
) => {
  for (const shape of selectedShapes) {
    const key = getVisibilityKey(shape);
    if (key && hasChildren(allShapes, key)) {
      return key;
    }
  }
  return null;
};

export const getSelectedExplodeTriggerKeys = (
  selectedShapes: readonly TLShapePartial[],
  allShapes: readonly TLShapePartial[] = selectedShapes,
) => {
  const keys = new Set<string>();
  for (const shape of selectedShapes) {
    const key = getVisibilityKey(shape);
    if (key && hasChildren(allShapes, key)) {
      keys.add(key);
    }
  }
  return [...keys];
};

export const toggleExpandedKey = (
  shapes: readonly TLShapePartial[],
  expandedKeys: Set<string>,
  key: string | null,
) => {
  if (!key || !hasChildren(shapes, key)) {
    return expandedKeys;
  }
  const next = new Set(expandedKeys);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
};

export const expandAllKeys = (shapes: readonly TLShapePartial[]) =>
  computeParentKeysWithChildren(shapes);

export const collapseAllKeys = () => new Set<string>();

export const filterTerraformShapes = (
  shapes: readonly TLShapePartial[],
  expandedKeys: Set<string>,
  layerState: TerraformLayerState,
) => {
  const visibleResourceKeys = computeVisibleResourceKeys(shapes, expandedKeys);

  return shapes.filter((shape) => {
    if (!isTerraformShape(shape)) {
      return true;
    }

    const layer = getEdgeLayer(shape);
    if (layer) {
      if (layer === "dependency" && !layerState.dependencyLayerEnabled) {
        return false;
      }
      if (layer === "dataFlow" && !layerState.dataFlowLayerEnabled) {
        return false;
      }
      const rel = getMeta(shape).relationship;
      return Boolean(
        rel?.source &&
          rel?.target &&
          visibleResourceKeys.has(rel.source) &&
          visibleResourceKeys.has(rel.target),
      );
    }

    if (isGroupRole(shape)) {
      const childKeys = getMeta(shape).terraformGroupChildKeys;
      return Boolean(
        Array.isArray(childKeys) &&
          childKeys.some((key) => visibleResourceKeys.has(key)),
      );
    }

    if (isResourceRole(shape)) {
      const key = getVisibilityKey(shape);
      return Boolean(key && visibleResourceKeys.has(key));
    }

    const key = getVisibilityKey(shape);
    return !key || visibleResourceKeys.has(key);
  });
};

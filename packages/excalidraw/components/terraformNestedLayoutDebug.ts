import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformVisibilityKey } from "./terraformVisibility";

/** Same analysis without HTTP — for tests. */
export function analyzeTerraformNestedLayout(
  elements: readonly ExcalidrawElement[],
) {
  const visibilityKeys = new Set<string>();
  for (const el of elements) {
    const key = getTerraformVisibilityKey(el);
    if (key) {
      visibilityKeys.add(key);
    }
  }
  let orphanExplodeParents = 0;
  for (const el of elements) {
    const cd = el.customData as
      | { terraformExplodeParentKeys?: string[] }
      | undefined;
    for (const p of cd?.terraformExplodeParentKeys ?? []) {
      if (typeof p === "string" && !visibilityKeys.has(p)) {
        orphanExplodeParents++;
      }
    }
  }
  return { orphanExplodeParents, visibilityKeyCount: visibilityKeys.size };
}

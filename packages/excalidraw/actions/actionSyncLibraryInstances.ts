import { newElementWith } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";

import { t } from "../i18n";
import { libraryItemsAtom } from "../data/library";
import { editorJotaiStore } from "../editor-jotai";

import { register } from "./register";

/**
 * Style properties that are safe to propagate from a library item to its
 * canvas instances. Structural/positional properties are intentionally
 * excluded so each instance retains its own position, size and shape.
 */
const SYNCABLE_STYLE_PROPS = [
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
] as const;

type SyncableStyleProp = typeof SYNCABLE_STYLE_PROPS[number];

export const actionSyncLibraryInstances = register({
  name: "syncLibraryInstances",
  trackEvent: { category: "element" },
  perform: (elements, appState, _value, _app) => {
    const { libraryItems } = editorJotaiStore.get(libraryItemsAtom);

    if (!libraryItems.length) {
      return {
        appState: {
          ...appState,
          toast: { message: t("toast.noLibraryInstancesToSync") },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    // Build a lookup: libraryItemId → style snapshot from the item's first element.
    // The first element is used as the style authority for the whole library item.
    const styleByLibraryItemId = new Map<
      string,
      Record<SyncableStyleProp, unknown>
    >();

    for (const item of libraryItems) {
      if (!item.elements.length) {
        continue;
      }
      const source = item.elements[0];
      const styleSnapshot = {} as Record<SyncableStyleProp, unknown>;
      for (const prop of SYNCABLE_STYLE_PROPS) {
        styleSnapshot[prop] = (source as Record<string, unknown>)[prop];
      }
      styleByLibraryItemId.set(item.id, styleSnapshot);
    }

    let syncedCount = 0;

    const nextElements = elements.map((el) => {
      if (!el.libraryItemId) {
        return el;
      }
      const styleSnapshot = styleByLibraryItemId.get(el.libraryItemId);
      if (!styleSnapshot) {
        return el;
      }
      syncedCount++;
      return newElementWith(el, styleSnapshot as any);
    });

    if (syncedCount === 0) {
      return {
        appState: {
          ...appState,
          toast: { message: t("toast.noLibraryInstancesToSync") },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      elements: nextElements,
      appState: {
        ...appState,
        toast: {
          message: t("toast.syncedLibraryInstances", {
            count: String(syncedCount),
          }),
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  label: "labels.syncLibraryInstances",
});

import { CaptureUpdateAction } from "@excalidraw/element";
import { register } from "./register";
import type { IndexItem } from "../types";

export const actionAddIndexItem = register({
  name: "addIndexItem",
  label: "Add index item",
  trackEvent: { category: "canvas" },
  predicate: () => true,
  perform: (elements, appState, formData: IndexItem) => {
    return {
      appState: {
        indexItems: [...appState.indexItems, formData],
      },
      captureUpdate: CaptureUpdateAction.UPDATE,
    };
  },
});

export const actionRemoveIndexItem = register({
  name: "removeIndexItem", 
  label: "Remove index item",
  trackEvent: { category: "canvas" },
  predicate: () => true,
  perform: (elements, appState, formData: { id: string }) => {
    return {
      appState: {
        indexItems: appState.indexItems.filter(item => item.id !== formData.id),
      },
      captureUpdate: CaptureUpdateAction.UPDATE,
    };
  },
});

export const actionUpdateIndexItem = register({
  name: "updateIndexItem",
  label: "Update index item", 
  trackEvent: { category: "canvas" },
  predicate: () => true,
  perform: (elements, appState, formData: { id: string; updates: Partial<IndexItem> }) => {
    return {
      appState: {
        indexItems: appState.indexItems.map(item => 
          item.id === formData.id ? { ...item, ...formData.updates } : item
        ),
      },
      captureUpdate: CaptureUpdateAction.UPDATE,
    };
  },
});
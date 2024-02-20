import { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import { orderByFractionalIndex } from "../../packages/excalidraw/fractionalIndex";
import { AppState } from "../../packages/excalidraw/types";
import { arrayToMap } from "../../packages/excalidraw/utils";

export type ReconciledElements = readonly ExcalidrawElement[] & {
  _brand: "reconciledElements";
};

export type BroadcastedExcalidrawElement = ExcalidrawElement;

const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: ExcalidrawElement | undefined,
  remote: BroadcastedExcalidrawElement,
): boolean => {
  if (
    local &&
    // local element is being edited
    (local.id === localAppState.editingElement?.id ||
      local.id === localAppState.resizingElement?.id ||
      local.id === localAppState.draggingElement?.id ||
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce < remote.versionNonce))
  ) {
    return true;
  }
  return false;
};

export const reconcileElements = (
  localElements: readonly ExcalidrawElement[],
  remoteElements: readonly BroadcastedExcalidrawElement[],
  localAppState: AppState,
): ReconciledElements => {
  const localElementsData = arrayToMap(localElements);

  const reconciledElements: ExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsData.get(remoteElement.id);
      const discardRemoteElement = shouldDiscardRemoteElement(
        localAppState,
        localElement,
        remoteElement,
      );

      if (localElement && discardRemoteElement) {
        reconciledElements.push(localElement);
        added.add(localElement.id);
      } else {
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  // TODO_FI: should we do it now? could we log out differences between actual old and new order?
  return orderByFractionalIndex(
    reconciledElements,
  ) as readonly ExcalidrawElement[] as ReconciledElements;
};

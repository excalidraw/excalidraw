import { ExcalidrawElement } from "../../src/element/types";
import { AppState } from "../../src/types";
import { arrayToMap, arrayToMapWithIndex } from "../../src/utils";
import { orderByFractionalIndex } from "../../src/zindex";

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
    if (localElementsData.has(remoteElement.id)) {
      const localElement = localElementsData.get(remoteElement.id);

      if (
        localElement &&
        shouldDiscardRemoteElement(localAppState, localElement, remoteElement)
      ) {
        continue;
      } else {
        if (!added.has(remoteElement.id)) {
          reconciledElements.push(remoteElement);
          added.add(remoteElement.id);
        }
      }
    } else {
      if (!added.has(remoteElement.id)) {
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  return orderByFractionalIndex(
    reconciledElements,
  ) as readonly ExcalidrawElement[] as ReconciledElements;
};

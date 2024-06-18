import type { OrderedExcalidrawElement } from "../element/types";
import { orderByFractionalIndex, syncInvalidIndices } from "../fractionalIndex";
import type { AppState } from "../types";
import type { MakeBrand } from "../utility-types";
import { arrayToMap } from "../utils";

export type ReconciledExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"ReconciledElement">;

export type RemoteExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"RemoteExcalidrawElement">;

export let globalCoverageData = {
  localDef: false,
  editing: false,
  resizing: false,
  dragging: false,
  version: false,
  versionNonce: false,
  falseBranch: false,
};

export const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: OrderedExcalidrawElement | undefined,
  remote: RemoteExcalidrawElement,
): boolean => {
  let ret = false;
  if (local) {
    globalCoverageData.localDef = true;
    if (local.id === localAppState.editingElement?.id) {
      globalCoverageData.editing = true;
      ret = true;
    }
    if (local.id === localAppState.resizingElement?.id) {
      globalCoverageData.resizing = true;
      ret = true;
    }
    if (local.id === localAppState.draggingElement?.id) {
      globalCoverageData.dragging = true;
      ret = true;
    }
    if (local.version > remote.version) {
      globalCoverageData.version = true;
      ret = true;
    }
    if (local.version === remote.version && local.versionNonce < remote.versionNonce) {
      globalCoverageData.versionNonce = true;
      ret = true;
    }
  } else {
    globalCoverageData.falseBranch = true;
  }
  return ret;
};

export const reconcileElements = (
  localElements: readonly OrderedExcalidrawElement[],
  remoteElements: readonly RemoteExcalidrawElement[],
  localAppState: AppState,
): ReconciledExcalidrawElement[] => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements: OrderedExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsMap.get(remoteElement.id);
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

  const orderedElements = orderByFractionalIndex(reconciledElements);

  // de-duplicate indices
  syncInvalidIndices(orderedElements);

  return orderedElements as ReconciledExcalidrawElement[];
};

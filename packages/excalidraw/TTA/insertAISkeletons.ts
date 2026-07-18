import {
  getCommonBounds,
  isBoundToContainer,
  getContainerElement,
  redrawTextBoundingBox,
  makeNextSelectedElementIds,
  Scene,
  CaptureUpdateAction,
  normalizeElbowArrows,
  newElementWith,
} from "@excalidraw/element";

import { convertToExcalidrawElements } from "@excalidraw/element";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { CaptureUpdateActionType } from "@excalidraw/element";

import { restoreElements } from "../data/restore";

import type { AppClassProperties } from "../types";

const getViewportCenter = (appState: AppClassProperties["state"]) => {
  // Viewport center in client (page) coordinates: the canvas occupies
  // `width`×`height` px starting at `offsetLeft`/`offsetTop`. Routing through
  // the canonical client→scene transform (rather than hand-rolling it) keeps
  // this in lockstep with how the rest of the editor centers content — see
  // `addElementsFromPasteOrLibrary`'s `position: "center"` handling. Note the
  // offsets cancel out of the math; a previous inline version dropped them on
  // the wrong side and inserted off-center in embedded hosts (C4 in tta.md).
  const { x, y } = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );

  return { sceneX: x, sceneY: y };
};

export const AI_GENERATED_ELEMENTS_KEY = "aiSidebarGenerationId";
export const INTERMEDIATE_PREVIEW_ELEMENT_KEY = "intermediatePreviewElement";

interface InsertSkeletonsOptions {
  targetCenter?: { x: number; y: number };
  generationId?: string;
  regenerateIds?: boolean;
  selectInsertedElements?: boolean;
  captureUpdate?: CaptureUpdateActionType;
  deleteGenerationTags?: readonly string[];
  intermediatePreviewElement?: boolean;
}

export const fixBoundTextElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  // `restoreElements()` already repairs the `text.containerId -> container.boundElements`
  // direction. This pass only makes the inverse container-declared binding
  // authoritative when the payload already references the text from the container.
  for (const element of elements) {
    if (!element.boundElements?.length) {
      continue;
    }
    const boundTextId = element.boundElements.find(
      (boundElement) => boundElement.type === "text",
    )?.id;
    if (!boundTextId) {
      continue;
    }
    const boundTextElement = elementsMap.get(boundTextId);
    if (!boundTextElement || boundTextElement.isDeleted) {
      continue;
    }
    if (
      boundTextElement.type === "text" &&
      boundTextElement.containerId !== element.id
    ) {
      scene.mutateElement(boundTextElement, {
        containerId: element.id,
      });
    }
  }

  for (const element of elements) {
    if (!isBoundToContainer(element)) {
      continue;
    }

    const container = getContainerElement(element, elementsMap);
    if (!container) {
      continue;
    }

    redrawTextBoundingBox(element, container, scene);
  }
};

const convertAISkeletonsToElements = (
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
  options?: { regenerateIds?: boolean },
): readonly NonDeletedExcalidrawElement[] => {
  if (skeletons.length === 0) {
    return [];
  }

  const convertedElements = convertToExcalidrawElements([...skeletons], {
    regenerateIds: options?.regenerateIds ?? false,
  }) as readonly NonDeletedExcalidrawElement[];

  const normalizedElements = restoreElements(convertedElements, null, {
    repairBindings: true,
  }) as readonly NonDeletedExcalidrawElement[];

  return normalizeElbowArrows(normalizedElements);
};

export const convertAISkeletonsToSceneElements = (
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
  app: AppClassProperties,
  options?: InsertSkeletonsOptions,
): readonly NonDeletedExcalidrawElement[] => {
  if (skeletons.length === 0) {
    return [];
  }

  const elbowNormalizedElements = convertAISkeletonsToElements(skeletons, {
    regenerateIds: options?.regenerateIds ?? false,
  });

  const [minX, minY, maxX, maxY] = getCommonBounds(elbowNormalizedElements);
  const elementsCenterXRaw = (minX + maxX) / 2;
  const elementsCenterYRaw = (minY + maxY) / 2;

  const { sceneX: viewportCenterSceneX, sceneY: viewportCenterSceneY } =
    getViewportCenter(app.state);

  const destination = options?.targetCenter ?? {
    x: viewportCenterSceneX,
    y: viewportCenterSceneY,
  };

  const elementsCenterX = Number.isFinite(elementsCenterXRaw)
    ? elementsCenterXRaw
    : destination.x;
  const elementsCenterY = Number.isFinite(elementsCenterYRaw)
    ? elementsCenterYRaw
    : destination.y;

  const dx = destination.x - elementsCenterX;
  const dy = destination.y - elementsCenterY;

  const generationId = options?.generationId;
  const isIntermediatePreviewElement =
    options?.intermediatePreviewElement === true;

  return elbowNormalizedElements.map((element) => {
    const nextCustomData =
      generationId || isIntermediatePreviewElement
        ? {
            ...(element.customData ?? {}),
            ...(generationId
              ? { [AI_GENERATED_ELEMENTS_KEY]: generationId }
              : {}),
            ...(isIntermediatePreviewElement
              ? { [INTERMEDIATE_PREVIEW_ELEMENT_KEY]: true }
              : {}),
          }
        : element.customData;

    return {
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      customData: nextCustomData,
    };
  }) as readonly NonDeletedExcalidrawElement[];
};

export const insertAISkeletons = (
  app: AppClassProperties,
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
  options?: InsertSkeletonsOptions,
) => {
  const rawAdjustedElements = convertAISkeletonsToSceneElements(
    skeletons,
    app,
    options,
  );
  if (!rawAdjustedElements.length) {
    return [];
  }
  const deleteGenerationTagSet = options?.deleteGenerationTags?.length
    ? new Set(options.deleteGenerationTags)
    : null;
  const existingElementsBase = deleteGenerationTagSet
    ? app.scene.getElementsIncludingDeleted().map((element) => {
        if (element.isDeleted) {
          return element;
        }
        const elementGenerationTag =
          element.customData?.[AI_GENERATED_ELEMENTS_KEY];
        if (
          typeof elementGenerationTag === "string" &&
          deleteGenerationTagSet.has(elementGenerationTag)
        ) {
          return newElementWith(element, { isDeleted: true });
        }
        return element;
      })
    : app.scene.getElementsIncludingDeleted();
  const existingElementsById = new Map(
    existingElementsBase.map((element) => [element.id, element]),
  );
  const adjustedElements = rawAdjustedElements.map((element) => {
    const existingElement = existingElementsById.get(element.id);
    if (existingElement && element.version <= existingElement.version) {
      return newElementWith(
        element,
        { version: existingElement.version + 1 },
        true,
      );
    }
    return element;
  });
  const adjustedElementIds = new Set(
    adjustedElements.map((element) => element.id),
  );
  const existingElements = existingElementsBase.filter(
    (element) => !adjustedElementIds.has(element.id),
  );
  const nextElements = [...existingElements, ...adjustedElements];

  // We don't want to mutate the live scene before updateScene is applied, but we do
  // want any bound-text corrections to be included in the captured update.
  const tempScene = new Scene(nextElements, { skipValidation: true });
  fixBoundTextElements(adjustedElements, tempScene);

  const appState = options?.selectInsertedElements
    ? {
        selectedElementIds: makeNextSelectedElementIds(
          adjustedElements
            .filter((element) => !isBoundToContainer(element))
            .reduce((acc: Record<string, true>, element) => {
              acc[element.id] = true;
              return acc;
            }, {}),
          app.state,
        ),
      }
    : undefined;

  app.syncActionResult({
    elements: nextElements,
    appState,
    captureUpdate: options?.captureUpdate ?? CaptureUpdateAction.NEVER,
  });

  return adjustedElements;
};

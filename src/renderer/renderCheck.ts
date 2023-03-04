import {
  CanvasContentRenderConfig,
  CanvasUIRenderConfig,
} from "../scene/types";

type RenderCheck = {
  runCanvas: boolean;
  runCanvasUi: boolean;
  runCanvasVisibleElement: boolean;
  renderCache: {
    [key: string]: any;
  };
};
let canvasUIRenderConfigCache: CanvasUIRenderConfig | undefined = undefined;
let canvasContentRenderConfigCache: CanvasContentRenderConfig | undefined =
  undefined;
let elementsLengthCache: number | undefined;
let normalizedCanvasWidthCache: number | undefined;
let normalizedCanvasHeightCache: number | undefined;
const renderCache: RenderCheck["renderCache"] = {};

export const renderCheck = (
  elementsLength: number,
  canvasUIRenderConfig: CanvasUIRenderConfig,
  canvasContentRenderConfig: CanvasContentRenderConfig,
  normalizedCanvasWidth: number,
  normalizedCanvasHeight: number,
): RenderCheck => {

  function setCachedValues(){
    elementsLengthCache = elementsLength;
    normalizedCanvasWidthCache = normalizedCanvasWidth;
    normalizedCanvasHeightCache = normalizedCanvasHeight;
    canvasUIRenderConfigCache = structuredClone(canvasUIRenderConfig);
    canvasContentRenderConfigCache = structuredClone(canvasContentRenderConfig);
  }
  
  if (canvasUIRenderConfigCache === undefined) {
    setCachedValues()
    return {
      runCanvas: true,
      runCanvasUi: true,
      renderCache,
      runCanvasVisibleElement: true,
    };
  }

  let runCanvas = false;
  let runCanvasUi = false;
  let runCanvasVisibleElement = false;

  // checking for any change

  // checking in common part
  const { scrollX, scrollY, zoom, isElementsChanged } =
    canvasContentRenderConfig;
  const cache = canvasContentRenderConfigCache;
  if (
    scrollX !== cache?.scrollX ||
    scrollY !== cache?.scrollY ||
    zoom.value !== cache?.zoom.value ||
    normalizedCanvasHeight !== normalizedCanvasHeightCache ||
    normalizedCanvasWidth !== normalizedCanvasWidthCache
  ) {
    runCanvas = runCanvasUi = runCanvasVisibleElement = true;
  } else if (isElementsChanged !== cache?.isElementsChanged) {
    runCanvas = runCanvasUi = true;
  } else {
    const {
      viewBackgroundColor,
      shouldCacheIgnoreZoom,
      theme,
      renderGrid,
      gridSize,
      isExporting,
      imageCache,
    } = canvasContentRenderConfig;
    if (
      elementsLength !== elementsLengthCache ||
      viewBackgroundColor !== cache?.viewBackgroundColor ||
      shouldCacheIgnoreZoom !== cache?.shouldCacheIgnoreZoom ||
      theme !== cache?.theme ||
      renderGrid !== cache?.renderGrid ||
      isExporting !== cache?.isExporting ||
      gridSize !== cache?.gridSize
    ) {
      runCanvas = true;
    }

    // if runCanvas is still false, we need to check 'imageCache'
    if (!runCanvas) {
      for (const [key, value] of imageCache.entries()) {
        const cacheValue = cache.imageCache.get(key);
        if (
          value.image !== cacheValue?.image ||
          value.mimeType !== cacheValue?.mimeType
        ) {
          runCanvas = true;
          break;
        }
      }
    }

    const {
      renderScrollbars,
      renderSelection,
      selectionColor,
      remotePointerUsernames,
      selectedElementIds,
      selectedLinearElement,
      selectionElement,
      editingLinearElement,
    } = canvasUIRenderConfig;

    if (
      renderScrollbars !== canvasUIRenderConfigCache?.renderScrollbars ||
      renderSelection !== canvasUIRenderConfigCache?.renderSelection ||
      selectionColor !== canvasUIRenderConfigCache?.selectionColor ||
      Object.keys(remotePointerUsernames).length ||
      editingLinearElement ||
      selectedLinearElement?.hoverPointIndex !==
        canvasUIRenderConfigCache?.selectedLinearElement?.hoverPointIndex ||
      selectedLinearElement?.segmentMidPointHoveredCoords?.toString() !==
        canvasUIRenderConfigCache?.selectedLinearElement?.segmentMidPointHoveredCoords?.toString() ||
      selectionElement?.versionNonce !==
        canvasUIRenderConfigCache?.selectionElement?.versionNonce
    ) {
      runCanvasUi = true;
    }

    if (!runCanvasUi) {
      const { selectedElementIds: selectedElementIdsCache = {} } =
        canvasUIRenderConfigCache;

      // const selectionId =
      //   selectionElement?.type === "selection" ? selectionElement?.id : null;

      const selectedElementIdsCacheKeys = Object.keys(selectedElementIdsCache);
      const selectedElementIdsKeys = Object.keys(selectedElementIds || {});

      if (
        selectedElementIdsKeys.length !== selectedElementIdsCacheKeys.length ||
        selectedElementIdsKeys.some((id) => !(id in selectedElementIdsCache))
      ) {
        runCanvasUi = true;
      }
    }
  }

  // on collabration we recheck Visible elements all time as of now
  runCanvasVisibleElement =
    runCanvasVisibleElement ||
    elementsLength !== elementsLengthCache ||
    Boolean(Object.keys(canvasUIRenderConfig.remotePointerUsernames).length);

  // setting to the latest values
  setCachedValues()

  return { runCanvas, runCanvasUi, renderCache, runCanvasVisibleElement };
};

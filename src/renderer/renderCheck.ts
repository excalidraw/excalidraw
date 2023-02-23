import { CanvasContentRenderConfig, CanvasUIRenderConfig } from "../scene/types";

type renderCheck = {
  runCanvas: boolean;
  runCanvasUi: boolean;
}
let canvasUIRenderConfigCache: CanvasUIRenderConfig | undefined = undefined
let canvasContentRenderConfigCache: CanvasContentRenderConfig | undefined = undefined

export const renderCheck = (canvasUIRenderConfig: CanvasUIRenderConfig,
  canvasContentRenderConfig: CanvasContentRenderConfig): renderCheck => {

  if (canvasUIRenderConfigCache === undefined) {
    canvasUIRenderConfigCache = structuredClone(canvasUIRenderConfig)
    canvasContentRenderConfigCache = structuredClone(canvasContentRenderConfig)
    return { runCanvas: true, runCanvasUi: true }
  }

  let runCanvas = false, runCanvasUi = false;

  // checking for any change
  
  // checking in common part
  const { scrollX, scrollY, zoom } = canvasContentRenderConfig
  const cache = canvasContentRenderConfigCache
  if (
    scrollX !== cache?.scrollX ||
    scrollY !== cache?.scrollY ||
    zoom.value !== cache?.zoom.value
  ) {
    runCanvas = runCanvasUi = true
  } else {

    const { viewBackgroundColor, shouldCacheIgnoreZoom, theme, renderGrid, isExporting, imageCache } = canvasContentRenderConfig
    if (
      viewBackgroundColor !== cache?.viewBackgroundColor ||
      shouldCacheIgnoreZoom !== cache?.shouldCacheIgnoreZoom ||
      theme !== cache?.theme ||
      renderGrid !== cache?.renderGrid ||
      isExporting !== cache?.isExporting
    ) {
      runCanvas = true
    }
    
    // if runCanvas is still false, we need to check 'imageCache'
    if (!runCanvas) {
      for (let [key, value] of imageCache.entries()) {
        const cacheValue = cache.imageCache.get(key)
        if (value.image !== cacheValue?.image ||
          value.mimeType !== cacheValue?.mimeType) {
          runCanvas = true
          break;
        }
      }
    }

    const { renderScrollbars, renderSelection, selectionColor, remotePointerUsernames } = canvasUIRenderConfig
    if (
      renderScrollbars !== canvasUIRenderConfigCache?.renderScrollbars ||
      renderSelection !== canvasUIRenderConfigCache?.renderSelection ||
      selectionColor !== canvasUIRenderConfigCache?.selectionColor ||
      Object.keys(remotePointerUsernames).length
    ) {
      runCanvasUi = true
    }

  }

  // setting to the latest values
  canvasUIRenderConfigCache = structuredClone(canvasUIRenderConfig)
  canvasContentRenderConfigCache = structuredClone(canvasContentRenderConfig)

  return { runCanvas, runCanvasUi }
}
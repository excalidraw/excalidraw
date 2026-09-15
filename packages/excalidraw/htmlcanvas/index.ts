/**
 * HTML-in-Canvas — barrel export
 */
export {
  isHtmlInCanvasSupported,
  resetHtmlInCanvasDetection,
  asHtmlInCanvasCtx,
  type HtmlInCanvasContext2D,
} from "./htmlInCanvasSupport";

export {
  drawHtmlElement,
  drawTextEditorInCanvas,
  drawHtmlElementWithEffects,
  createHtmlContentNode,
  type DrawElementOptions,
} from "./htmlCanvasRenderer";

export { useHtmlInCanvasEditor } from "./useHtmlInCanvasEditor";

export { pasteHtmlToCanvas } from "./richHtmlPaste";

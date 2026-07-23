/**
 * React hook that manages the HTML-in-Canvas text editor integration.
 *
 * When the API is available the hook:
 *  1. Hides the absolute-positioned overlay textarea (opacity: 0, but
 *     still focusable for native input / a11y).
 *  2. On every animation frame re-draws the textarea into the
 *     interactive canvas via `drawElement`.
 *
 * When the API is **not** available, the hook is a no-op and the
 * existing overlay behavior is preserved unchanged.
 */

import { useEffect, useRef, useCallback } from "react";
import { isHtmlInCanvasSupported, drawTextEditorInCanvas } from "../htmlcanvas";
import type { DrawElementOptions } from "../htmlcanvas";

interface UseHtmlInCanvasEditorOpts {
  /** The textarea created by textWysiwyg. */
  textarea: HTMLTextAreaElement | null;
  /** The interactive canvas element. */
  canvas: HTMLCanvasElement | null;
  /** Whether the editor is currently active/mounted. */
  isActive: boolean;
  /** Current position & transform of the textarea in canvas coords. */
  position: DrawElementOptions | null;
}

/**
 * Drives the HTML-in-Canvas render loop for the active text editor.
 * Returns `true` when HTML-in-Canvas is taking over rendering
 * (so the caller can skip the overlay styling).
 */
export const useHtmlInCanvasEditor = ({
  textarea,
  canvas,
  isActive,
  position,
}: UseHtmlInCanvasEditorOpts): boolean => {
  const rafRef = useRef<number>(0);
  const isSupported = isHtmlInCanvasSupported();

  const draw = useCallback(() => {
    if (!textarea || !canvas || !position) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    drawTextEditorInCanvas(ctx, textarea, position);
  }, [textarea, canvas, position]);

  useEffect(() => {
    if (!isSupported || !isActive || !textarea) {
      return;
    }

    // Make the overlay invisible but still focusable so that native
    // input, IME, screen-readers keep working.
    const prev = textarea.style.cssText;
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "auto"; // keep focus
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";

    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      textarea.style.cssText = prev;
    };
  }, [isSupported, isActive, textarea, draw]);

  return isSupported;
};

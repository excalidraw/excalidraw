import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { isLineSegment, type AppState } from "../../packages/excalidraw/types";
import { t } from "../../packages/excalidraw/i18n";
import { throttleRAF } from "../../packages/excalidraw/utils";
import type { LineSegment } from "../../packages/utils";
import {
  bootstrapCanvas,
  getNormalizedCanvasDimensions,
} from "../../packages/excalidraw/renderer/helpers";
import type { DebugElement } from "../../packages/excalidraw/visualdebug";
import {
  ArrowheadArrowIcon,
  CloseIcon,
} from "../../packages/excalidraw/components/icons";

// The global data holder to collect the debug operations
window.visualDebugData = [] as DebugElement[][];

const renderLine = (
  context: CanvasRenderingContext2D,
  zoom: number,
  segment: LineSegment,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(segment[0][0] * zoom, segment[0][1] * zoom);
  context.lineTo(segment[1][0] * zoom, segment[1][1] * zoom);
  context.stroke();
  context.restore();
};

const renderOrigin = (context: CanvasRenderingContext2D, zoom: number) => {
  context.strokeStyle = "#888";
  context.save();
  context.beginPath();
  context.moveTo(-10 * zoom, -10 * zoom);
  context.lineTo(10 * zoom, 10 * zoom);
  context.moveTo(10 * zoom, -10 * zoom);
  context.lineTo(-10 * zoom, 10 * zoom);
  context.stroke();
  context.save();
};

const _debugRenderer = (
  canvas: HTMLCanvasElement,
  appState: AppState,
  scale: number,
) => {
  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
    viewBackgroundColor: "transparent",
  });

  // Apply zoom
  context.save();
  context.translate(
    appState.scrollX * appState.zoom.value,
    appState.scrollY * appState.zoom.value,
  );

  renderOrigin(context, appState.zoom.value);

  // Render all debug frames
  window.visualDebugData?.forEach((frame) => {
    frame.forEach((el) => {
      switch (true) {
        case isLineSegment(el.data):
          renderLine(context, appState.zoom.value, el.data, el.color);
          break;
      }
    });
  });

  window.visualDebugData = window.visualDebugData?.map((frame) =>
    frame.filter((el) => el.permanent),
  );
};

export const debugRenderer = throttleRAF(
  (canvas: HTMLCanvasElement, appState: AppState, scale: number) => {
    _debugRenderer(canvas, appState, scale);
  },
  { trailing: true },
);

export const isVisualDebuggerEnabled = () =>
  Array.isArray(window.visualDebugData);

export const DebugFooter = () => {
  const moveForward = useCallback(() => {
    const frameCount = window.visualDebugData?.length ?? 0;
    const currentFrame = window.visualDebugCurrentFrame || -1;

    window.visualDebugCurrentFrame = (currentFrame + 1) % frameCount;
    if (isNaN(window.visualDebugCurrentFrame)) {
      window.visualDebugCurrentFrame = 0;
    }
  }, []);
  const moveBackward = useCallback(() => {
    const frameCount = window.visualDebugData?.length ?? 0;
    const currentFrame = window.visualDebugCurrentFrame ?? -1;

    window.visualDebugCurrentFrame = (currentFrame + 1) % frameCount;
    if (isNaN(window.visualDebugCurrentFrame)) {
      window.visualDebugCurrentFrame = 0;
    }
  }, []);
  const reset = useCallback(() => {
    window.visualDebugCurrentFrame = undefined;
  }, []);

  return (
    <>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={moveForward}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          <ArrowheadArrowIcon flip />
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={reset}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          {CloseIcon}
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-backward"
        aria-label="Move backward"
        type="button"
        onClick={moveBackward}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          <ArrowheadArrowIcon />
        </div>
      </button>
    </>
  );
};

interface DebugCanvasProps {
  appState: AppState;
  scale: number;
}

const DebugCanvas = forwardRef<HTMLCanvasElement, DebugCanvasProps>(
  ({ appState, scale }, ref) => {
    const { width, height } = appState;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    useImperativeHandle<HTMLCanvasElement | null, HTMLCanvasElement | null>(
      ref,
      () => canvasRef.current,
      [canvasRef],
    );

    return (
      <canvas
        style={{
          width,
          height,
          position: "absolute",
          zIndex: 2,
          pointerEvents: "none",
        }}
        width={width * scale}
        height={height * scale}
        ref={canvasRef}
      >
        {t("labels.debugCanvas")}
      </canvas>
    );
  },
);

export default DebugCanvas;

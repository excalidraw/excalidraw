import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { type AppState } from "../../packages/excalidraw/types";
import { throttleRAF } from "../../packages/excalidraw/utils";
import {
  bootstrapCanvas,
  getNormalizedCanvasDimensions,
} from "../../packages/excalidraw/renderer/helpers";
import type { DebugElement } from "../../packages/excalidraw/visualdebug";
import {
  ArrowheadArrowIcon,
  CloseIcon,
  TrashIcon,
} from "../../packages/excalidraw/components/icons";
import { STORAGE_KEYS } from "../app_constants";
import {
  isLineSegment,
  type GlobalPoint,
  type LineSegment,
} from "../../packages/math";

const renderLine = (
  context: CanvasRenderingContext2D,
  zoom: number,
  segment: LineSegment<GlobalPoint>,
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

const render = (
  frame: DebugElement[],
  context: CanvasRenderingContext2D,
  appState: AppState,
) => {
  frame.forEach((el: DebugElement) => {
    switch (true) {
      case isLineSegment(el.data):
        renderLine(
          context,
          appState.zoom.value,
          el.data as LineSegment<GlobalPoint>,
          el.color,
        );
        break;
    }
  });
};

const _debugRenderer = (
  canvas: HTMLCanvasElement,
  appState: AppState,
  scale: number,
  refresh: () => void,
) => {
  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  if (appState.height !== canvas.height || appState.width !== canvas.width) {
    refresh();
  }

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

  if (
    window.visualDebug?.currentFrame &&
    window.visualDebug?.data &&
    window.visualDebug.data.length > 0
  ) {
    // Render only one frame
    const [idx] = debugFrameData();

    render(window.visualDebug.data[idx], context, appState);
  } else {
    // Render all debug frames
    window.visualDebug?.data.forEach((frame) => {
      render(frame, context, appState);
    });
  }

  if (window.visualDebug) {
    window.visualDebug!.data =
      window.visualDebug?.data.map((frame) =>
        frame.filter((el) => el.permanent),
      ) ?? [];
  }
};

const debugFrameData = (): [number, number] => {
  const currentFrame = window.visualDebug?.currentFrame ?? 0;
  const frameCount = window.visualDebug?.data.length ?? 0;

  if (frameCount > 0) {
    return [currentFrame % frameCount, window.visualDebug?.currentFrame ?? 0];
  }

  return [0, 0];
};

export const saveDebugState = (debug: { enabled: boolean }) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
      JSON.stringify(debug),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const debugRenderer = throttleRAF(
  (
    canvas: HTMLCanvasElement,
    appState: AppState,
    scale: number,
    refresh: () => void,
  ) => {
    _debugRenderer(canvas, appState, scale, refresh);
  },
  { trailing: true },
);

export const loadSavedDebugState = () => {
  let debug;
  try {
    const savedDebugState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
    );
    if (savedDebugState) {
      debug = JSON.parse(savedDebugState) as { enabled: boolean };
    }
  } catch (error: any) {
    console.error(error);
  }

  return debug ?? { enabled: false };
};

export const isVisualDebuggerEnabled = () =>
  Array.isArray(window.visualDebug?.data);

export const DebugFooter = ({ onChange }: { onChange: () => void }) => {
  const moveForward = useCallback(() => {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1)
    ) {
      window.visualDebug!.currentFrame = 0;
    }
    window.visualDebug!.currentFrame += 1;
    onChange();
  }, [onChange]);
  const moveBackward = useCallback(() => {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1) ||
      window.visualDebug?.currentFrame < 1
    ) {
      window.visualDebug!.currentFrame = 1;
    }
    window.visualDebug!.currentFrame -= 1;
    onChange();
  }, [onChange]);
  const reset = useCallback(() => {
    window.visualDebug!.currentFrame = undefined;
    onChange();
  }, [onChange]);
  const trashFrames = useCallback(() => {
    if (window.visualDebug) {
      window.visualDebug.currentFrame = undefined;
      window.visualDebug.data = [];
    }
    onChange();
  }, [onChange]);

  return (
    <>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={trashFrames}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          {TrashIcon}
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={moveBackward}
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
        onClick={moveForward}
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
        Debug Canvas
      </canvas>
    );
  },
);

export default DebugCanvas;

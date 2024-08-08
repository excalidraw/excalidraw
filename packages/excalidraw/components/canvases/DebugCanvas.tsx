import { useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import type { AppState } from "../../types";
import { t } from "../../i18n";
import { debugRenderer } from "../../renderer/debugScene";

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

    useEffect(() => {
      if (!canvasRef.current) {
        return;
      }

      debugRenderer(canvasRef.current, appState, window.devicePixelRatio);
    }, [appState]);

    return (
      <canvas
        style={{ width, height }}
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

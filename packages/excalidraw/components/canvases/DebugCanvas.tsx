import React from "react";
import type { AppState } from "../../types";
import { t } from "../../i18n";

interface DebugCanvasProps {
  appState: AppState;
  scale: number;
}

const DebugCanvas = React.forwardRef<HTMLCanvasElement, DebugCanvasProps>(
  ({ appState, scale }, ref) => {
    const { width, height } = appState;
    return (
      <canvas
        style={{ width, height }}
        width={width * scale}
        height={height * scale}
        ref={ref}
      >
        {t("labels.debugCanvas")}
      </canvas>
    );
  },
);

export default DebugCanvas;

import React, { useEffect, useRef } from "react";

import { THEME } from "@excalidraw/common";

import { useDevice } from "./App";

import "./Rulers.scss";

import type { AppState } from "../types";

const RULER_SIZE = 20;
const RULER_TICK_SIZE = 8;
const RULER_MAJOR_TICK_SIZE = 12;
const RULER_FONT_SIZE = 10;

interface RulersProps {
  appState: AppState;
  width: number;
  height: number;
}

const Rulers: React.FC<RulersProps> = ({ appState, width, height }) => {
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement>(null);
  const device = useDevice();

  useEffect(() => {
    if (!horizontalRulerRef.current || !verticalRulerRef.current) {
      return;
    }

    const horizontalCanvas = horizontalRulerRef.current;
    const verticalCanvas = verticalRulerRef.current;

    const horizontalCtx = horizontalCanvas.getContext("2d");
    const verticalCtx = verticalCanvas.getContext("2d");

    if (!horizontalCtx || !verticalCtx) {
      return;
    }

    // Set canvas dimensions
    const scale = window.devicePixelRatio;

    // Horizontal ruler
    horizontalCanvas.width = width * scale;
    horizontalCanvas.height = RULER_SIZE * scale;
    horizontalCanvas.style.width = `${width}px`;
    horizontalCanvas.style.height = `${RULER_SIZE}px`;

    // Vertical ruler
    verticalCanvas.width = RULER_SIZE * scale;
    verticalCanvas.height = height * scale;
    verticalCanvas.style.width = `${RULER_SIZE}px`;
    verticalCanvas.style.height = `${height}px`;

    // Scale context for high DPI
    horizontalCtx.scale(scale, scale);
    verticalCtx.scale(scale, scale);

    // Clear canvases
    horizontalCtx.clearRect(0, 0, width, RULER_SIZE);
    verticalCtx.clearRect(0, 0, RULER_SIZE, height);

    // Set colors based on theme
    const isDark = appState.theme === THEME.DARK;
    const rulerBgColor = isDark ? "#2b2b2b" : "#f8f9fa";
    const rulerLineColor = isDark ? "#555" : "#ddd";
    const rulerTextColor = isDark ? "#ccc" : "#666";
    const rulerBorderColor = isDark ? "#444" : "#ccc";

    // Draw ruler backgrounds
    horizontalCtx.fillStyle = rulerBgColor;
    horizontalCtx.fillRect(0, 0, width, RULER_SIZE);

    verticalCtx.fillStyle = rulerBgColor;
    verticalCtx.fillRect(0, 0, RULER_SIZE, height);

    // Draw ruler borders
    horizontalCtx.strokeStyle = rulerBorderColor;
    horizontalCtx.lineWidth = 1;
    horizontalCtx.beginPath();
    horizontalCtx.moveTo(0, RULER_SIZE - 0.5);
    horizontalCtx.lineTo(width, RULER_SIZE - 0.5);
    horizontalCtx.stroke();

    verticalCtx.strokeStyle = rulerBorderColor;
    verticalCtx.lineWidth = 1;
    verticalCtx.beginPath();
    verticalCtx.moveTo(RULER_SIZE - 0.5, 0);
    verticalCtx.lineTo(RULER_SIZE - 0.5, height);
    verticalCtx.stroke();

    // Calculate grid step based on zoom
    const zoom = appState.zoom.value;
    const baseGridSize = 10; // Base grid size in pixels
    const gridSize = baseGridSize * zoom;

    // Dynamic step calculation for better readability
    let step = 10;
    if (gridSize < 5) {
      step = 100;
    } else if (gridSize < 10) {
      step = 50;
    } else if (gridSize < 20) {
      step = 20;
    } else if (gridSize < 50) {
      step = 10;
    } else {
      step = 5;
    }

    // Set text style
    horizontalCtx.font = `${RULER_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
    horizontalCtx.fillStyle = rulerTextColor;
    horizontalCtx.textAlign = "center";
    horizontalCtx.textBaseline = "middle";

    verticalCtx.font = `${RULER_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
    verticalCtx.fillStyle = rulerTextColor;
    verticalCtx.textAlign = "center";
    verticalCtx.textBaseline = "middle";

    // Draw horizontal ruler
    const startX = Math.floor((-appState.scrollX - width / 2) / step) * step;
    const endX = startX + width / zoom + step * 2;

    horizontalCtx.strokeStyle = rulerLineColor;
    horizontalCtx.lineWidth = 1;

    for (let x = startX; x <= endX; x += step) {
      const screenX = (x + appState.scrollX) * zoom + width / 2;

      if (screenX >= 0 && screenX <= width) {
        const isMajorTick = x % (step * 5) === 0;
        const tickSize = isMajorTick ? RULER_MAJOR_TICK_SIZE : RULER_TICK_SIZE;

        horizontalCtx.beginPath();
        horizontalCtx.moveTo(screenX, RULER_SIZE - tickSize);
        horizontalCtx.lineTo(screenX, RULER_SIZE);
        horizontalCtx.stroke();

        // Draw number labels for major ticks
        if (isMajorTick && x !== 0) {
          horizontalCtx.fillText(
            x.toString(),
            screenX,
            RULER_SIZE - tickSize - 6,
          );
        }
      }
    }

    // Draw vertical ruler
    const startY = Math.floor((-appState.scrollY - height / 2) / step) * step;
    const endY = startY + height / zoom + step * 2;

    verticalCtx.strokeStyle = rulerLineColor;
    verticalCtx.lineWidth = 1;

    for (let y = startY; y <= endY; y += step) {
      const screenY = (y + appState.scrollY) * zoom + height / 2;

      if (screenY >= 0 && screenY <= height) {
        const isMajorTick = y % (step * 5) === 0;
        const tickSize = isMajorTick ? RULER_MAJOR_TICK_SIZE : RULER_TICK_SIZE;

        verticalCtx.beginPath();
        verticalCtx.moveTo(RULER_SIZE - tickSize, screenY);
        verticalCtx.lineTo(RULER_SIZE, screenY);
        verticalCtx.stroke();

        // Draw number labels for major ticks
        if (isMajorTick && y !== 0) {
          verticalCtx.save();
          verticalCtx.translate(RULER_SIZE - tickSize - 6, screenY);
          verticalCtx.rotate(-Math.PI / 2);
          verticalCtx.fillText(y.toString(), 0, 0);
          verticalCtx.restore();
        }
      }
    }

    // Draw origin markers
    const originX = appState.scrollX * zoom + width / 2;
    const originY = appState.scrollY * zoom + height / 2;

    if (originX >= 0 && originX <= width) {
      horizontalCtx.strokeStyle = isDark ? "#ff6b6b" : "#e03131";
      horizontalCtx.lineWidth = 2;
      horizontalCtx.beginPath();
      horizontalCtx.moveTo(originX, 0);
      horizontalCtx.lineTo(originX, RULER_SIZE);
      horizontalCtx.stroke();

      horizontalCtx.fillStyle = isDark ? "#ff6b6b" : "#e03131";
      horizontalCtx.fillText("0", originX, 6);
    }

    if (originY >= 0 && originY <= height) {
      verticalCtx.strokeStyle = isDark ? "#ff6b6b" : "#e03131";
      verticalCtx.lineWidth = 2;
      verticalCtx.beginPath();
      verticalCtx.moveTo(0, originY);
      verticalCtx.lineTo(RULER_SIZE, originY);
      verticalCtx.stroke();

      verticalCtx.fillStyle = isDark ? "#ff6b6b" : "#e03131";
      verticalCtx.save();
      verticalCtx.translate(6, originY);
      verticalCtx.rotate(-Math.PI / 2);
      verticalCtx.fillText("0", 0, 0);
      verticalCtx.restore();
    }
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.zoom,
    appState.theme,
    width,
    height,
  ]);

  // Don't render rulers on mobile devices
  if (device.editor.isMobile) {
    return null;
  }

  return (
    <div className="excalidraw-rulers">
      <canvas
        ref={horizontalRulerRef}
        className="excalidraw-rulers__horizontal"
        style={{
          position: "absolute",
          top: 0,
          left: RULER_SIZE,
          zIndex: 10,
        }}
      />
      <canvas
        ref={verticalRulerRef}
        className="excalidraw-rulers__vertical"
        style={{
          position: "absolute",
          top: RULER_SIZE,
          left: 0,
          zIndex: 10,
        }}
      />
      <div
        className="excalidraw-rulers__corner"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: RULER_SIZE,
          height: RULER_SIZE,
          backgroundColor:
            appState.theme === THEME.DARK ? "#2b2b2b" : "#f8f9fa",
          borderRight: `1px solid ${
            appState.theme === THEME.DARK ? "#444" : "#ccc"
          }`,
          borderBottom: `1px solid ${
            appState.theme === THEME.DARK ? "#444" : "#ccc"
          }`,
          zIndex: 11,
        }}
      />
    </div>
  );
};

export default Rulers;

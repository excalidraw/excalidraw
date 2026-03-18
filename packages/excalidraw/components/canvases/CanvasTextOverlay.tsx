import React, { useMemo } from "react";

import {
  THEME,
  applyDarkModeFilter,
  getFontFamilyString,
  isRTL,
} from "@excalidraw/common";

import { getLineHeightInPx, isTextElement } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "../../types";

type CanvasTextOverlayProps = {
  visibleElements: readonly NonDeletedExcalidrawElement[];
  appState: Pick<
    AppState,
    "zoom" | "scrollX" | "scrollY" | "theme" | "editingTextElement"
  >;
  enabled: boolean;
};

const CanvasTextOverlay = ({
  visibleElements,
  appState,
  enabled,
}: CanvasTextOverlayProps) => {
  const items = useMemo(() => {
    if (!enabled) {
      return [];
    }
    const zoom = appState.zoom.value;
    const scrollX = appState.scrollX;
    const scrollY = appState.scrollY;

    return visibleElements
      .filter((element) => isTextElement(element))
      .map((element) => {
        const fontSize = element.fontSize * zoom;
        const lineHeight =
          getLineHeightInPx(element.fontSize, element.lineHeight) * zoom;

        const width = element.width * zoom;
        const height = element.height * zoom;
        const cx = (element.x + element.width / 2 + scrollX) * zoom;
        const cy = (element.y + element.height / 2 + scrollY) * zoom;

        const color =
          appState.theme === THEME.DARK
            ? applyDarkModeFilter(element.strokeColor)
            : element.strokeColor;

        const direction = isRTL(element.text) ? "rtl" : "ltr";

        const alignItems =
          element.verticalAlign === "top"
            ? "flex-start"
            : element.verticalAlign === "bottom"
            ? "flex-end"
            : "center";

        return {
          id: element.id,
          text: element.text,
          x: cx,
          y: cy,
          width,
          height,
          angle: element.angle,
          opacity: element.opacity / 100,
          fontFamily: getFontFamilyString({ fontFamily: element.fontFamily }),
          fontSize,
          lineHeight,
          color,
          textAlign: element.textAlign as React.CSSProperties["textAlign"],
          direction: direction as React.CSSProperties["direction"],
          alignItems,
        };
      });
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.theme,
    appState.zoom.value,
    enabled,
    visibleElements,
  ]);

  if (!enabled || items.length === 0) {
    return null;
  }

  return (
    <div className="excalidraw__text-overlay">
      {items.map((item) => (
        <div
          key={item.id}
          className="excalidraw__text-overlay-item"
          style={{
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            transform: `translate(-50%, -50%) rotate(${item.angle}rad)`,
            opacity: item.opacity,
          }}
        >
          <div
            className="excalidraw__text-overlay-item__inner"
            style={{
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              lineHeight: `${item.lineHeight}px`,
              color: item.color,
              textAlign: item.textAlign,
              direction: item.direction,
              alignItems: item.alignItems,
            }}
          >
            {item.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(CanvasTextOverlay);

import React, { useEffect, useRef, useState } from "react";

import { CLASSES, capitalizeString } from "@excalidraw/common";
import { trackEvent } from "../analytics";
import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { DiamondIcon, EllipseIcon, RectangleIcon } from "./icons";

import type { AppClassProperties } from "../types";

import "./ConvertElementTypePopup.scss";

const GAP_HORIZONTAL = 44;
const GAP_VERTICAL = -94;

const GENERIC_SHAPES = [
  { type: "rectangle", icon: RectangleIcon },
  { type: "diamond", icon: DiamondIcon },
  { type: "ellipse", icon: EllipseIcon },
] as const;

type ShapeTypePopupProps = {
  app: AppClassProperties;
  triggerElement: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  currentType: string;
  onChange?: (type: "rectangle" | "diamond" | "ellipse") => void;
};

export const ShapeTypePopup = ({
  app,
  triggerElement,
  isOpen,
  onClose,
  onChange,
  currentType,
}: ShapeTypePopupProps) => {
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !triggerElement) {
      return;
    }

    const updatePosition = () => {
      const triggerRect = triggerElement.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelWidth = panelRect?.width ?? 0;
      const panelHeight = panelRect?.height ?? 0;
      setPanelPosition({
        x: triggerRect.x + triggerRect.width / 2 - panelWidth / 2,
        y: triggerRect.top - panelHeight - 16,
      });
    };

    updatePosition();

    // Outside click handling (capture pointer events for reliability on mobile)
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const panelEl = panelRef.current;
      const triggerEl = triggerElement;
      if (!target) {
        onClose();
        return;
      }
      const insidePanel = !!panelEl && panelEl.contains(target);
      const onTrigger = !!triggerEl && triggerEl.contains(target);
      if (!insidePanel && !onTrigger) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("pointerup", handlePointer, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("pointerup", handlePointer, true);
    };
  }, [isOpen, triggerElement, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      style={{
        position: "fixed",
        top: `${panelPosition.y}px`,
        left: `${panelPosition.x}px`,
        zIndex: 2,
      }}
      className={CLASSES.CONVERT_ELEMENT_TYPE_POPUP}
    >
      {GENERIC_SHAPES.map(({ type, icon }) => (
        <ToolButton
          className="Shape"
          key={type}
          type="radio"
          icon={icon}
          checked={currentType === type}
          name="shapeType-option"
          title={capitalizeString(t(`toolBar.${type}`))}
          keyBindingLabel=""
          aria-label={capitalizeString(t(`toolBar.${type}`))}
          data-testid={`toolbar-${type}`}
          onChange={() => {
            if (app.state.activeTool.type !== type) {
              trackEvent("toolbar", type, "ui");
            }
            app.setActiveTool({ type: type as any });
            onChange?.(type);
            // Do NOT close here; keep popup open until user clicks outside (parity with SelectionTypePopup)
          }}
        />
      ))}
    </div>
  );
};

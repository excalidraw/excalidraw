import React, { useEffect, useRef, useState } from "react";

import { CLASSES, capitalizeString } from "@excalidraw/common";
import { trackEvent } from "../analytics";
import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { SelectionIcon, LassoIcon } from "./icons";

import type { AppClassProperties } from "../types";

import "./ConvertElementTypePopup.scss";

const SELECTION_TYPES = [
  { type: "selection", icon: SelectionIcon },
  { type: "lasso", icon: LassoIcon },
] as const;

type SelectionType = "selection" | "lasso";

type SelectionTypePopupProps = {
  app: AppClassProperties;
  triggerElement: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  currentType: SelectionType;
  onChange?: (type: SelectionType) => void;
};

export const SelectionTypePopup = ({
  app,
  triggerElement,
  isOpen,
  onClose,
  onChange,
  currentType,
}: SelectionTypePopupProps) => {
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

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const panelEl = panelRef.current;
      const triggerEl = triggerElement;
      if (!target) {
        onClose();
        return;
      }
      const clickedInsidePanel = !!panelEl && panelEl.contains(target);
      const clickedTrigger = !!triggerEl && triggerEl.contains(target);
      if (!clickedInsidePanel && !clickedTrigger) {
        onClose();
      }
    };

    // use capture to ensure we run before potential re-renders hide elements
    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("pointerup", handleClick, true);

    return () => {
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("pointerup", handleClick, true);
    };
  }, [isOpen, triggerElement, onClose]);

  if (!isOpen) return null;

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
      {SELECTION_TYPES.map(({ type, icon }) => (
        <ToolButton
          className="Selection"
          key={type}
          type="radio"
          icon={icon}
          checked={currentType === type}
          name="selectionType-option"
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
            // Intentionally NOT calling onClose here; popup should stay open
            // until user clicks outside trigger or popup per requirements.
          }}
        />
      ))}
    </div>
  );
};

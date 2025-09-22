import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { capitalizeString, CLASSES } from "@excalidraw/common";

import { trackEvent } from "../analytics";

import { ToolButton } from "./ToolButton";

import type { AppClassProperties } from "../types";

type ToolOption = {
  type: string;
  icon: React.ReactNode;
  title?: string;
};

type ToolTypePopupProps = {
  app: AppClassProperties;
  triggerElement: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  currentType: string;
  onChange?: (type: string) => void;
  options: readonly ToolOption[];
  className?: string;
  namePrefix: string;
};

export const ToolTypePopup = ({
  app,
  triggerElement,
  isOpen,
  onClose,
  onChange,
  currentType,
  options,
  className = "Shape",
  namePrefix,
}: ToolTypePopupProps) => {
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
        x: triggerRect.left - panelWidth / 2,
        y: panelHeight + 8,
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
        top: `${-10}px`,
        left: `${panelPosition.x}px`,
        zIndex: 9999,
      }}
      className={CLASSES.CONVERT_ELEMENT_TYPE_POPUP}
    >
      {options.map(({ type, icon, title }) => (
        <ToolButton
          className={className}
          key={type}
          type="radio"
          icon={icon}
          checked={currentType === type}
          name={`${namePrefix}-option`}
          title={title || capitalizeString(type)}
          keyBindingLabel=""
          aria-label={title || capitalizeString(type)}
          data-testid={`toolbar-${type}`}
          onChange={() => {
            if (app.state.activeTool.type !== type) {
              trackEvent("toolbar", type, "ui");
            }
            app.setActiveTool({ type: type as any });
            onChange?.(type);
          }}
        />
      ))}
    </div>
  );
};

type ToolWithPopupProps = {
  app: AppClassProperties;
  options: readonly ToolOption[];
  activeTool: { type: string };
  defaultOption: string;
  className?: string;
  namePrefix: string;
  title: string;
  "data-testid": string;
  onToolChange: (type: string) => void;
  getDisplayedOption: () => ToolOption;
  isActive: boolean;
  fillable?: boolean;
};

export const ToolWithPopup = ({
  app,
  options,
  activeTool,
  defaultOption,
  className = "Shape",
  namePrefix,
  title,
  "data-testid": dataTestId,
  onToolChange,
  getDisplayedOption,
  isActive,
  fillable = false,
}: ToolWithPopupProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [triggerRef, setTriggerRef] = useState<HTMLElement | null>(null);

  const displayedOption = getDisplayedOption();

  return (
    <div style={{ position: "relative" }}>
      <div ref={setTriggerRef}>
        <ToolButton
          className={clsx(className, {
            fillable,
            active:
              isActive ||
              isPopupOpen ||
              options.some((o) => o.type === activeTool.type),
          })}
          type="radio"
          icon={displayedOption.icon}
          checked={isActive}
          name="editor-current-shape"
          title={title}
          aria-label={title}
          data-testid={dataTestId}
          onPointerDown={() => {
            setIsPopupOpen((val) => !val);
            onToolChange(defaultOption);
          }}
        />
      </div>

      <ToolTypePopup
        app={app}
        triggerElement={triggerRef}
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        options={options}
        className={className}
        namePrefix={namePrefix}
        currentType={activeTool.type}
        onChange={(type: string) => {
          onToolChange(type);
        }}
      />
    </div>
  );
};

import React, { useEffect, useState } from "react";
import clsx from "clsx";

import { capitalizeString } from "@excalidraw/common";

import * as Popover from "@radix-ui/react-popover";

import { trackEvent } from "../analytics";

import { ToolButton } from "./ToolButton";

import "./ToolPopover.scss";

import { useExcalidrawContainer } from "./App";

import type { AppClassProperties } from "../types";

type ToolOption = {
  type: string;
  icon: React.ReactNode;
  title?: string;
  defaultArrowheads?: { start: "arrow" | null; end: "arrow" | null };
};

type ToolPopoverProps = {
  app: AppClassProperties;
  options: readonly ToolOption[];
  activeTool: { type: string };
  defaultOption: string;
  className?: string;
  namePrefix: string;
  title: string;
  "data-testid": string;
  onToolChange: (type: string) => void;
  displayedOption: ToolOption;
  fillable?: boolean;
};

export const ToolPopover = ({
  app,
  options,
  activeTool,
  defaultOption,
  className = "Shape",
  namePrefix,
  title,
  "data-testid": dataTestId,
  onToolChange,
  displayedOption,
  fillable = false,
}: ToolPopoverProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const currentType = activeTool.type;
  const isActive = displayedOption.type === currentType;
  const SIDE_OFFSET = 32 / 2 + 10;
  const { container } = useExcalidrawContainer();

  // Close popup if currentType is not in options (moved to useEffect to avoid render-time state updates)
  useEffect(() => {
    const matchesAnyOption = options.some((option) => {
      if (option.type !== currentType) return false;
      // For arrow type, also check defaultArrowheads
      if (option.type === "arrow" && option.defaultArrowheads) {
        const activeHasDouble = app.state.activeTool.defaultArrowheads?.start === "arrow" && 
                               app.state.activeTool.defaultArrowheads?.end === "arrow";
        const optionHasDouble = option.defaultArrowheads.start === "arrow" && 
                               option.defaultArrowheads.end === "arrow";
        return activeHasDouble === optionHasDouble;
      }
      return true;
    });
    
    if (!matchesAnyOption && isPopupOpen) {
      setIsPopupOpen(false);
    }
  }, [currentType, isPopupOpen, options, app.state.activeTool.defaultArrowheads]);

  // Close popover when user starts interacting with the canvas (pointer down)
  useEffect(() => {
    // app.onPointerDownEmitter emits when pointer down happens on canvas area
    const unsubscribe = app.onPointerDownEmitter.on(() => {
      setIsPopupOpen(false);
    });
    return () => unsubscribe?.();
  }, [app]);

  return (
    <Popover.Root open={isPopupOpen}>
      <Popover.Trigger asChild>
        <ToolButton
          className={clsx(className, {
            fillable,
            active: options.some((o) => o.type === activeTool.type),
          })}
          type="radio"
          icon={displayedOption.icon}
          checked={isActive}
          name="editor-current-shape"
          title={title}
          aria-label={title}
          data-testid={dataTestId}
          onPointerDown={() => {
            setIsPopupOpen((v) => !v);
            
            // When opening popup, activate the displayed option so popup stays open
            if (!isPopupOpen) {
              app.setActiveTool({
                type: displayedOption.type as any,
                ...(displayedOption.defaultArrowheads
                  ? { defaultArrowheads: displayedOption.defaultArrowheads }
                  : { defaultArrowheads: undefined }),
              });
            }
            
            onToolChange(defaultOption);
          }}
        />
      </Popover.Trigger>

      <Popover.Content
        className="tool-popover-content"
        sideOffset={SIDE_OFFSET}
        collisionBoundary={container ?? undefined}
      >
        {options.map(({ type, icon, title, defaultArrowheads }) => {
          // Check if this option matches the active tool (type + defaultArrowheads)
          const isChecked = (() => {
            if (currentType !== type) return false;
            // For arrow type, also check defaultArrowheads
            if (type === "arrow") {
              const activeHasDouble = app.state.activeTool.defaultArrowheads?.start === "arrow" && 
                                     app.state.activeTool.defaultArrowheads?.end === "arrow";
              const optionHasDouble = defaultArrowheads?.start === "arrow" && 
                                     defaultArrowheads?.end === "arrow";
              return activeHasDouble === optionHasDouble;
            }
            return true;
          })();
          
          return (
          <ToolButton
            className={clsx(className, {
              active: isChecked,
            })}
            key={`${type}${defaultArrowheads ? '-double' : ''}`}
            type="radio"
            icon={icon}
            checked={isChecked}
            name={`${namePrefix}-option`}
            title={title || capitalizeString(type)}
            keyBindingLabel=""
            aria-label={title || capitalizeString(type)}
            data-testid={`toolbar-${type}${defaultArrowheads ? '-double' : ''}`}
            onChange={() => {
              if (app.state.activeTool.type !== type) {
                trackEvent("toolbar", type, "ui");
              }
              app.setActiveTool({ 
                type: type as any,
                // Explicitly set or clear defaultArrowheads
                ...(defaultArrowheads 
                  ? { defaultArrowheads } 
                  : { defaultArrowheads: undefined })
              });
              onToolChange?.(type);
            }}
          />
        );})}
      </Popover.Content>
    </Popover.Root>
  );
};

import React, { useEffect, useState } from "react";
import clsx from "clsx";

import { capitalizeString } from "@excalidraw/common";

import { Popover } from "radix-ui";

import { trackEvent } from "../analytics";

import { ToolButton } from "./ToolButton";

import "./ToolPopover.scss";

import { useExcalidrawContainer } from "./App";

import type { AppClassProperties } from "../types";

type ToolOption = {
  type: string;
  icon: React.ReactNode;
  title: string;
  fillable?: boolean;
};

type ToolPopoverProps = {
  app: AppClassProperties;
  options: readonly ToolOption[];
  activeTool: { type: string };
  defaultOption: string;
  "data-testid": string;
  onToolChange: (type: string) => void;
  displayedOption: ToolOption;
};

export const ToolPopover = ({
  app,
  options,
  activeTool,
  defaultOption,
  "data-testid": dataTestId,
  onToolChange,
  displayedOption,
}: ToolPopoverProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const currentType = activeTool.type;
  const isActive = displayedOption.type === currentType;
  const SIDE_OFFSET = 32 / 2 + 10;
  const { container } = useExcalidrawContainer();

  // if currentType is not in options, close popup
  if (!options.some((o) => o.type === currentType) && isPopupOpen) {
    setIsPopupOpen(false);
  }

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
          className={clsx({ fillable: displayedOption.fillable })}
          type="toggle"
          icon={displayedOption.icon}
          checked={isActive}
          title={capitalizeString(displayedOption.title)}
          aria-label={capitalizeString(displayedOption.title)}
          data-testid={dataTestId}
          onSelect={() => {
            setIsPopupOpen((v) => !v);
            onToolChange(defaultOption);
          }}
        />
      </Popover.Trigger>

      <Popover.Content
        className="tool-popover-content"
        sideOffset={SIDE_OFFSET}
        collisionBoundary={container ?? undefined}
      >
        {options.map(({ type, icon, title, fillable }) => (
          <ToolButton
            className={clsx({ fillable })}
            key={type}
            type="toggle"
            icon={icon}
            checked={currentType === type}
            title={capitalizeString(type)}
            aria-label={capitalizeString(type)}
            data-testid={`toolbar-${type}`}
            onSelect={() => {
              if (app.state.activeTool.type !== type) {
                trackEvent("toolbar", type, "ui");
                app.setActiveTool({ type: type as any });
                onToolChange?.(type);
              }
            }}
          />
        ))}
      </Popover.Content>
    </Popover.Root>
  );
};

import clsx from "clsx";
import { useRef, useState } from "react";

import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import {
  getWorkspaceZoneConfig,
  getDefaultWorkspaceZoneConfig,
} from "../../workspaceLayout";
import { useExcalidrawSetAppState } from "../App";
import {
  DotsHorizontalIcon,
  LockedIcon,
  UnlockedIcon,
  UndoIcon,
  eyeClosedIcon,
  eyeIcon,
} from "../icons";

import "./WorkspaceZone.scss";

import type {
  WorkspaceZoneConfig,
  WorkspaceZoneId,
} from "../../workspaceLayout";

const MIN_ZONE_HEIGHT = 120;

interface WorkspaceZoneProps {
  zoneId: WorkspaceZoneId;
  children: React.ReactNode;
  resizableHeight?: boolean;
  /** zones that are the only entry point to preferences (main menu) must not
      be hideable, otherwise there'd be no pointer-only way to bring them back */
  hideable?: boolean;
  controlsPlacement?: "above" | "below" | "right";
  controlsAlign?: "start" | "end";
}

export const WorkspaceZone = ({
  zoneId,
  children,
  resizableHeight = false,
  hideable = true,
  controlsPlacement = "above",
  controlsAlign = "start",
}: WorkspaceZoneProps) => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [resizeHeight, setResizeHeight] = useState<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

  const { workspaceLayout } = appState;
  const config = getWorkspaceZoneConfig(workspaceLayout, zoneId);
  const isEditing = workspaceLayout.editing;

  const updateZone = (patch: Partial<WorkspaceZoneConfig>) => {
    setAppState((state) => ({
      workspaceLayout: {
        ...state.workspaceLayout,
        zones: {
          ...state.workspaceLayout.zones,
          [zoneId]: {
            ...getWorkspaceZoneConfig(state.workspaceLayout, zoneId),
            ...patch,
          },
        },
      },
    }));
  };

  const resetZone = () => {
    setAppState((state) => {
      const zones = { ...state.workspaceLayout.zones };
      delete zones[zoneId];
      return {
        workspaceLayout: {
          ...state.workspaceLayout,
          zones,
        },
      };
    });
  };

  if (!config.visible && !isEditing) {
    return null;
  }

  const offsetX = config.offsetX + (dragDelta?.x ?? 0);
  const offsetY = config.offsetY + (dragDelta?.y ?? 0);
  const height = resizeHeight ?? config.height;

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setDragDelta({ x: 0, y: 0 });
  };

  const onDragPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (config.locked || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    startDrag(event);
  };

  // outside edit mode the zone itself is the drag surface: grabbing any
  // non-interactive area moves it, while clicks on its actual controls
  // (buttons, inputs, menu content, ...) behave as usual
  const onZonePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (config.locked || event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], .dropdown-menu, .workspace-zone__resize-handle',
      )
    ) {
      return;
    }
    event.preventDefault();
    startDrag(event);
  };

  const onDragPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragStartRef.current) {
      return;
    }
    setDragDelta({
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    });
  };

  const onDragPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragStartRef.current) {
      return;
    }
    const delta = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    };
    dragStartRef.current = null;
    setDragDelta(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (delta.x !== 0 || delta.y !== 0) {
      updateZone({
        offsetX: config.offsetX + delta.x,
        offsetY: config.offsetY + delta.y,
      });
    }
  };

  const onResizePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (config.locked || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const currentHeight =
      config.height ??
      (wrapperRef.current?.getBoundingClientRect().height || MIN_ZONE_HEIGHT);
    resizeStartRef.current = { y: event.clientY, height: currentHeight };
    setResizeHeight(currentHeight);
  };

  const onResizePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!resizeStartRef.current) {
      return;
    }
    setResizeHeight(
      Math.max(
        MIN_ZONE_HEIGHT,
        resizeStartRef.current.height +
          (event.clientY - resizeStartRef.current.y),
      ),
    );
  };

  const onResizePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!resizeStartRef.current) {
      return;
    }
    const nextHeight = Math.max(
      MIN_ZONE_HEIGHT,
      resizeStartRef.current.height +
        (event.clientY - resizeStartRef.current.y),
    );
    resizeStartRef.current = null;
    setResizeHeight(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateZone({ height: nextHeight });
  };

  const defaults = getDefaultWorkspaceZoneConfig();
  const isModified =
    config.offsetX !== defaults.offsetX ||
    config.offsetY !== defaults.offsetY ||
    config.visible !== defaults.visible ||
    config.locked !== defaults.locked ||
    config.height !== undefined;

  // outside edit mode, unlocked zones are draggable by grabbing any
  // non-interactive area (grab cursor) and, where supported, keep their
  // resize handle; locked zones stay fixed
  const isQuickDraggable = !isEditing && config.visible && !config.locked;
  const showResizeHandle = resizableHeight && (isEditing || isQuickDraggable);

  return (
    <div
      ref={wrapperRef}
      className={clsx("workspace-zone", `workspace-zone--zone-${zoneId}`, {
        "workspace-zone--editing": isEditing,
        "workspace-zone--ghost": isEditing && !config.visible,
        "workspace-zone--locked": config.locked,
        "workspace-zone--has-height": height !== undefined,
        "workspace-zone--quick-draggable": isQuickDraggable,
        "workspace-zone--dragging": dragDelta !== null,
      })}
      style={
        {
          transform:
            offsetX !== 0 || offsetY !== 0
              ? `translate(${offsetX}px, ${offsetY}px)`
              : undefined,
          "--workspace-zone-height":
            height !== undefined ? `${height}px` : undefined,
        } as React.CSSProperties
      }
      data-testid={`workspace-zone-${zoneId}`}
      onPointerDown={isQuickDraggable ? onZonePointerDown : undefined}
      onPointerMove={isQuickDraggable ? onDragPointerMove : undefined}
      onPointerUp={isQuickDraggable ? onDragPointerUp : undefined}
      onPointerCancel={isQuickDraggable ? onDragPointerUp : undefined}
    >
      {children}
      {isEditing && (
        <div
          className={clsx(
            "workspace-zone__controls",
            `workspace-zone__controls--${controlsPlacement}`,
            `workspace-zone__controls--align-${controlsAlign}`,
          )}
        >
          <button
            type="button"
            className="workspace-zone__control workspace-zone__control--drag"
            title={t("workspaceLayout.drag")}
            aria-label={t("workspaceLayout.drag")}
            disabled={config.locked}
            data-testid={`workspace-zone-drag-${zoneId}`}
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
          >
            {DotsHorizontalIcon}
          </button>
          <button
            type="button"
            className="workspace-zone__control"
            title={
              config.locked
                ? t("workspaceLayout.unlock")
                : t("workspaceLayout.lock")
            }
            aria-label={
              config.locked
                ? t("workspaceLayout.unlock")
                : t("workspaceLayout.lock")
            }
            data-testid={`workspace-zone-lock-${zoneId}`}
            onClick={() => updateZone({ locked: !config.locked })}
          >
            {config.locked ? LockedIcon : UnlockedIcon}
          </button>
          {hideable && (
            <button
              type="button"
              className="workspace-zone__control"
              title={
                config.visible
                  ? t("workspaceLayout.hide")
                  : t("workspaceLayout.show")
              }
              aria-label={
                config.visible
                  ? t("workspaceLayout.hide")
                  : t("workspaceLayout.show")
              }
              data-testid={`workspace-zone-visibility-${zoneId}`}
              onClick={() => updateZone({ visible: !config.visible })}
            >
              {config.visible ? eyeIcon : eyeClosedIcon}
            </button>
          )}
          <button
            type="button"
            className="workspace-zone__control"
            title={t("workspaceLayout.reset")}
            aria-label={t("workspaceLayout.reset")}
            disabled={!isModified}
            data-testid={`workspace-zone-reset-${zoneId}`}
            onClick={resetZone}
          >
            {UndoIcon}
          </button>
        </div>
      )}
      {showResizeHandle && (
        <div
          className={clsx("workspace-zone__resize-handle", {
            "workspace-zone__resize-handle--quick": !isEditing,
          })}
          title={t("workspaceLayout.resize")}
          data-testid={`workspace-zone-resize-${zoneId}`}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      )}
    </div>
  );
};

WorkspaceZone.displayName = "WorkspaceZone";

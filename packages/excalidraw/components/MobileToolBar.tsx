import React, { useState, useEffect } from "react";
import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import { HandButton } from "./HandButton";
import { ToolButton } from "./ToolButton";
import { ShapesSwitcher } from "./Actions";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ShapeTypePopup } from "./ShapeTypePopup";
import { SelectionTypePopup } from "./SelectionTypePopup";
import { LinearElementTypePopup } from "./LinearElementTypePopup";

import {
  SelectionIcon,
  FreedrawIcon,
  EraserIcon,
  RectangleIcon,
  ArrowIcon,
  extraToolsIcon,
  DiamondIcon,
  EllipseIcon,
  LineIcon,
  TextIcon,
  ImageIcon,
  frameToolIcon,
  EmbedIcon,
  laserPointerToolIcon,
  LassoIcon,
  mermaidLogoIcon,
  MagicIcon,
} from "./icons";

import { trackEvent } from "../analytics";
import { t } from "../i18n";
import { isHandToolActive } from "../appState";
import { useTunnels } from "../context/tunnels";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, AppProps, UIAppState } from "../types";

import "./ToolIcon.scss";
import "./MobileToolBar.scss";

type MobileToolBarProps = {
  appState: UIAppState;
  app: AppClassProperties;
  actionManager: ActionManager;
  onHandToolToggle: () => void;
  UIOptions: AppProps["UIOptions"];
};

export const MobileToolBar = ({
  appState,
  app,
  actionManager,
  onHandToolToggle,
  UIOptions,
}: MobileToolBarProps) => {
  const activeTool = appState.activeTool;
  const [isOtherShapesMenuOpen, setIsOtherShapesMenuOpen] = useState(false);
  const [lastActiveGenericShape, setLastActiveGenericShape] = useState<
    "rectangle" | "diamond" | "ellipse"
  >("rectangle");
  const [lastActiveLinearElement, setLastActiveLinearElement] = useState<
    "arrow" | "line"
  >("arrow");
  const [isShapeTypePopupOpen, setIsShapeTypePopupOpen] = useState(false);
  const [rectangleTriggerRef, setRectangleTriggerRef] =
    useState<HTMLElement | null>(null);
  const [isLinearElementTypePopupOpen, setIsLinearElementTypePopupOpen] =
    useState(false);
  const [linearElementTriggerRef, setLinearElementTriggerRef] =
    useState<HTMLElement | null>(null);
  const [isSelectionTypePopupOpen, setIsSelectionTypePopupOpen] =
    useState(false);
  const [selectionTriggerRef, setSelectionTriggerRef] =
    useState<HTMLElement | null>(null);

  // keep lastActiveGenericShape in sync with active tool if user switches via other UI
  useEffect(() => {
    if (
      activeTool.type === "rectangle" ||
      activeTool.type === "diamond" ||
      activeTool.type === "ellipse"
    ) {
      setLastActiveGenericShape(activeTool.type);
    }
  }, [activeTool.type]);

  // keep lastActiveLinearElement in sync with active tool if user switches via other UI
  useEffect(() => {
    if (activeTool.type === "arrow" || activeTool.type === "line") {
      setLastActiveLinearElement(activeTool.type);
    }
  }, [activeTool.type]);

  const frameToolSelected = activeTool.type === "frame";
  const laserToolSelected = activeTool.type === "laser";
  const lassoToolSelected =
    activeTool.type === "lasso" && app.defaultSelectionTool !== "lasso";
  const embeddableToolSelected = activeTool.type === "embeddable";

  const { TTDDialogTriggerTunnel } = useTunnels();

  const handleToolChange = (toolType: string, pointerType?: string) => {
    if (appState.activeTool.type !== toolType) {
      trackEvent("toolbar", toolType, "ui");
    }

    if (toolType === "selection") {
      if (appState.activeTool.type === "selection") {
        // Toggle selection tool behavior if needed
      } else {
        app.setActiveTool({ type: "selection" });
      }
    } else {
      app.setActiveTool({ type: toolType as any });
    }
  };

  return (
    <div className="mobile-toolbar">
      {/* Hand Tool */}
      <HandButton
        checked={isHandToolActive(appState)}
        onChange={onHandToolToggle}
        title={t("toolBar.hand")}
        isMobile
      />

      {/* Selection Tool */}
      <div style={{ position: "relative" }}>
        <div ref={setSelectionTriggerRef}>
          <ToolButton
            className={clsx("Shape", { fillable: false })}
            type="radio"
            icon={
              app.defaultSelectionTool === "selection"
                ? SelectionIcon
                : LassoIcon
            }
            checked={
              activeTool.type === "lasso" || activeTool.type === "selection"
            }
            name="editor-current-shape"
            title={`${capitalizeString(t("toolBar.selection"))}`}
            aria-label={capitalizeString(t("toolBar.selection"))}
            data-testid="toolbar-selection"
            onPointerDown={() => {
              setIsSelectionTypePopupOpen((val) => !val);
              app.setActiveTool({ type: app.defaultSelectionTool });
            }}
          />
        </div>
        <SelectionTypePopup
          app={app}
          triggerElement={selectionTriggerRef}
          isOpen={isSelectionTypePopupOpen}
          onClose={() => setIsSelectionTypePopupOpen(false)}
          onChange={(type) => {
            app.setActiveTool({ type });
            app.defaultSelectionTool = type;
          }}
          currentType={activeTool.type === "lasso" ? "lasso" : "selection"}
        />
      </div>

      {/* Free Draw */}
      <ToolButton
        className={clsx("Shape", { fillable: false })}
        type="radio"
        icon={FreedrawIcon}
        checked={activeTool.type === "freedraw"}
        name="editor-current-shape"
        title={`${capitalizeString(t("toolBar.freedraw"))}`}
        aria-label={capitalizeString(t("toolBar.freedraw"))}
        data-testid="toolbar-freedraw"
        onChange={() => handleToolChange("freedraw")}
      />

      {/* Eraser */}
      <ToolButton
        className={clsx("Shape", { fillable: true })}
        type="radio"
        icon={EraserIcon}
        checked={activeTool.type === "eraser"}
        name="editor-current-shape"
        title={`${capitalizeString(t("toolBar.eraser"))}`}
        aria-label={capitalizeString(t("toolBar.eraser"))}
        data-testid="toolbar-eraser"
        onChange={() => handleToolChange("eraser")}
      />

      {/* Rectangle */}
      <div
        style={{ position: "relative" }}
        ref={(el) => setRectangleTriggerRef(el as HTMLElement | null)}
      >
        <ToolButton
          className={clsx("Shape", { fillable: false })}
          type="radio"
          icon={
            lastActiveGenericShape === "rectangle"
              ? RectangleIcon
              : lastActiveGenericShape === "diamond"
              ? DiamondIcon
              : lastActiveGenericShape === "ellipse"
              ? EllipseIcon
              : RectangleIcon
          }
          checked={["rectangle", "diamond", "ellipse"].includes(
            activeTool.type,
          )}
          name="editor-current-shape"
          title={`${capitalizeString(
            t(
              lastActiveGenericShape === "rectangle"
                ? "toolBar.rectangle"
                : lastActiveGenericShape === "diamond"
                ? "toolBar.diamond"
                : lastActiveGenericShape === "ellipse"
                ? "toolBar.ellipse"
                : "toolBar.rectangle",
            ),
          )}`}
          aria-label={capitalizeString(
            t(
              lastActiveGenericShape === "rectangle"
                ? "toolBar.rectangle"
                : lastActiveGenericShape === "diamond"
                ? "toolBar.diamond"
                : lastActiveGenericShape === "ellipse"
                ? "toolBar.ellipse"
                : "toolBar.rectangle",
            ),
          )}
          data-testid="toolbar-rectangle"
          onPointerDown={() => {
            setIsShapeTypePopupOpen((val) => !val);
            app.setActiveTool({ type: lastActiveGenericShape });
          }}
        />

        <ShapeTypePopup
          app={app}
          triggerElement={rectangleTriggerRef}
          isOpen={isShapeTypePopupOpen}
          onClose={() => {
            setIsShapeTypePopupOpen(false);
          }}
          onChange={(type) => {
            setLastActiveGenericShape(type);
            app.setActiveTool({ type });
          }}
          currentType={activeTool.type}
        />
      </div>

      {/* Arrow/Line */}
      <div
        style={{ position: "relative" }}
        ref={(el) => setLinearElementTriggerRef(el as HTMLElement | null)}
      >
        <ToolButton
          className={clsx("Shape", { fillable: true })}
          type="radio"
          icon={lastActiveLinearElement === "arrow" ? ArrowIcon : LineIcon}
          checked={["arrow", "line"].includes(activeTool.type)}
          name="editor-current-shape"
          title={`${capitalizeString(
            t(
              lastActiveLinearElement === "arrow"
                ? "toolBar.arrow"
                : "toolBar.line",
            ),
          )}`}
          aria-label={capitalizeString(
            t(
              lastActiveLinearElement === "arrow"
                ? "toolBar.arrow"
                : "toolBar.line",
            ),
          )}
          data-testid="toolbar-arrow"
          onPointerDown={() => {
            setIsLinearElementTypePopupOpen((val) => !val);
            app.setActiveTool({ type: lastActiveLinearElement });
          }}
        />

        <LinearElementTypePopup
          app={app}
          triggerElement={linearElementTriggerRef}
          isOpen={isLinearElementTypePopupOpen}
          onClose={() => {
            setIsLinearElementTypePopupOpen(false);
          }}
          onChange={(type) => {
            setLastActiveLinearElement(type);
            app.setActiveTool({ type });
          }}
          currentType={activeTool.type === "line" ? "line" : "arrow"}
        />
      </div>

      {/* Other Shapes */}
      <DropdownMenu open={isOtherShapesMenuOpen} placement="top">
        <DropdownMenu.Trigger
          className={clsx("App-toolbar__extra-tools-trigger", {
            "App-toolbar__extra-tools-trigger--selected":
              frameToolSelected ||
              embeddableToolSelected ||
              lassoToolSelected ||
              activeTool.type === "text" ||
              activeTool.type === "image" ||
              (laserToolSelected && !app.props.isCollaborating),
          })}
          onToggle={() => setIsOtherShapesMenuOpen(!isOtherShapesMenuOpen)}
          title={t("toolBar.extraTools")}
        >
          {frameToolSelected
            ? frameToolIcon
            : embeddableToolSelected
            ? EmbedIcon
            : activeTool.type === "text"
            ? TextIcon
            : activeTool.type === "image"
            ? ImageIcon
            : laserToolSelected && !app.props.isCollaborating
            ? laserPointerToolIcon
            : lassoToolSelected
            ? LassoIcon
            : extraToolsIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsOtherShapesMenuOpen(false)}
          onSelect={() => setIsOtherShapesMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
        >
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "text" })}
            icon={TextIcon}
            shortcut={KEYS.T.toLocaleUpperCase()}
            data-testid="toolbar-text"
            selected={activeTool.type === "text"}
          >
            {t("toolBar.text")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "image" })}
            icon={ImageIcon}
            data-testid="toolbar-image"
            selected={activeTool.type === "image"}
          >
            {t("toolBar.image")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "frame" })}
            icon={frameToolIcon}
            shortcut={KEYS.F.toLocaleUpperCase()}
            data-testid="toolbar-frame"
            selected={frameToolSelected}
          >
            {t("toolBar.frame")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "embeddable" })}
            icon={EmbedIcon}
            data-testid="toolbar-embeddable"
            selected={embeddableToolSelected}
          >
            {t("toolBar.embeddable")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "laser" })}
            icon={laserPointerToolIcon}
            data-testid="toolbar-laser"
            selected={laserToolSelected}
            shortcut={KEYS.K.toLocaleUpperCase()}
          >
            {t("toolBar.laser")}
          </DropdownMenu.Item>
          {app.defaultSelectionTool !== "lasso" && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "lasso" })}
              icon={LassoIcon}
              data-testid="toolbar-lasso"
              selected={lassoToolSelected}
            >
              {t("toolBar.lasso")}
            </DropdownMenu.Item>
          )}
          <div style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}>
            Generate
          </div>
          {app.props.aiEnabled !== false && <TTDDialogTriggerTunnel.Out />}
          <DropdownMenu.Item
            onSelect={() => app.setOpenDialog({ name: "ttd", tab: "mermaid" })}
            icon={mermaidLogoIcon}
            data-testid="toolbar-embeddable"
          >
            {t("toolBar.mermaidToExcalidraw")}
          </DropdownMenu.Item>
          {app.props.aiEnabled !== false && app.plugins.diagramToCode && (
            <>
              <DropdownMenu.Item
                onSelect={() => app.onMagicframeToolSelect()}
                icon={MagicIcon}
                data-testid="toolbar-magicframe"
              >
                {t("toolBar.magicframe")}
                <DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {/* Separator */}
      <div className="mobile-toolbar-separator" />

      {/* Undo Button */}
      <div className="mobile-toolbar-undo">
        {actionManager.renderAction("undo")}
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import { trackEvent } from "../analytics";

import { t } from "../i18n";

import { isHandToolActive } from "../appState";

import { useTunnels } from "../context/tunnels";

import { HandButton } from "./HandButton";
import { ToolButton } from "./ToolButton";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ToolWithPopup } from "./ToolWithPopup";

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

import "./ToolIcon.scss";
import "./MobileToolBar.scss";

import type { AppClassProperties, UIAppState } from "../types";

const SHAPE_TOOLS = [
  {
    type: "rectangle",
    icon: RectangleIcon,
    title: capitalizeString(t("toolBar.rectangle")),
  },
  {
    type: "diamond",
    icon: DiamondIcon,
    title: capitalizeString(t("toolBar.diamond")),
  },
  {
    type: "ellipse",
    icon: EllipseIcon,
    title: capitalizeString(t("toolBar.ellipse")),
  },
] as const;

const SELECTION_TOOLS = [
  {
    type: "selection",
    icon: SelectionIcon,
    title: capitalizeString(t("toolBar.selection")),
  },
  {
    type: "lasso",
    icon: LassoIcon,
    title: capitalizeString(t("toolBar.lasso")),
  },
] as const;

const LINEAR_ELEMENT_TOOLS = [
  {
    type: "arrow",
    icon: ArrowIcon,
    title: capitalizeString(t("toolBar.arrow")),
  },
  { type: "line", icon: LineIcon, title: capitalizeString(t("toolBar.line")) },
] as const;

type MobileToolBarProps = {
  appState: UIAppState;
  app: AppClassProperties;
  onHandToolToggle: () => void;
};

export const MobileToolBar = ({
  appState,
  app,
  onHandToolToggle,
}: MobileToolBarProps) => {
  const activeTool = appState.activeTool;
  const [isOtherShapesMenuOpen, setIsOtherShapesMenuOpen] = useState(false);
  const [lastActiveGenericShape, setLastActiveGenericShape] = useState<
    "rectangle" | "diamond" | "ellipse"
  >("rectangle");
  const [lastActiveLinearElement, setLastActiveLinearElement] = useState<
    "arrow" | "line"
  >("arrow");

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

  const showTextToolOutside = appState.width >= 400;
  const showFrameToolOutside = appState.width >= 440;

  const extraTools = [
    "text",
    "frame",
    "embeddable",
    "laser",
    "magicframe",
  ].filter((tool) => {
    if (showTextToolOutside && tool === "text") {
      return false;
    }
    if (showFrameToolOutside && tool === "frame") {
      return false;
    }
    return true;
  });
  const extraToolSelected = extraTools.includes(appState.activeTool.type);
  const extraIcon = extraToolSelected
    ? appState.activeTool.type === "frame"
      ? frameToolIcon
      : appState.activeTool.type === "embeddable"
      ? EmbedIcon
      : appState.activeTool.type === "laser"
      ? laserPointerToolIcon
      : appState.activeTool.type === "text"
      ? TextIcon
      : appState.activeTool.type === "magicframe"
      ? MagicIcon
      : extraToolsIcon
    : extraToolsIcon;

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
      <ToolWithPopup
        app={app}
        options={SELECTION_TOOLS}
        activeTool={activeTool}
        defaultOption={app.defaultSelectionTool}
        className="Selection"
        namePrefix="selectionType"
        title={capitalizeString(t("toolBar.selection"))}
        data-testid="toolbar-selection"
        onToolChange={(type: string) => {
          app.setActiveTool({ type: type as any });
          app.defaultSelectionTool = type as any;
        }}
        getDisplayedOption={() =>
          SELECTION_TOOLS.find(
            (tool) => tool.type === app.defaultSelectionTool,
          ) || SELECTION_TOOLS[0]
        }
        isActive={
          activeTool.type === "selection" || activeTool.type === "lasso"
        }
      />

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
      <ToolWithPopup
        app={app}
        options={SHAPE_TOOLS}
        activeTool={activeTool}
        defaultOption={lastActiveGenericShape}
        className="Shape"
        namePrefix="shapeType"
        title={capitalizeString(
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
        onToolChange={(type: string) => {
          setLastActiveGenericShape(type as any);
          app.setActiveTool({ type: type as any });
        }}
        getDisplayedOption={() =>
          SHAPE_TOOLS.find((tool) => tool.type === lastActiveGenericShape) ||
          SHAPE_TOOLS[0]
        }
        isActive={["rectangle", "diamond", "ellipse"].includes(activeTool.type)}
      />

      {/* Arrow/Line */}
      <ToolWithPopup
        app={app}
        options={LINEAR_ELEMENT_TOOLS}
        activeTool={activeTool}
        defaultOption={lastActiveLinearElement}
        className="LinearElement"
        namePrefix="linearElementType"
        title={capitalizeString(
          t(
            lastActiveLinearElement === "arrow"
              ? "toolBar.arrow"
              : "toolBar.line",
          ),
        )}
        data-testid="toolbar-arrow"
        fillable={true}
        onToolChange={(type: string) => {
          setLastActiveLinearElement(type as any);
          app.setActiveTool({ type: type as any });
        }}
        getDisplayedOption={() =>
          LINEAR_ELEMENT_TOOLS.find(
            (tool) => tool.type === lastActiveLinearElement,
          ) || LINEAR_ELEMENT_TOOLS[0]
        }
        isActive={["arrow", "line"].includes(activeTool.type)}
      />

      {/* Image */}
      <ToolButton
        className={clsx("Shape", { fillable: false })}
        type="radio"
        icon={ImageIcon}
        checked={activeTool.type === "image"}
        name="editor-current-shape"
        title={`${capitalizeString(t("toolBar.image"))}`}
        aria-label={capitalizeString(t("toolBar.image"))}
        data-testid="toolbar-image"
        onChange={() => handleToolChange("image")}
      />

      {/* Text Tool */}
      {showTextToolOutside && (
        <ToolButton
          className={clsx("Shape", { fillable: false })}
          type="radio"
          icon={TextIcon}
          checked={activeTool.type === "text"}
          name="editor-current-shape"
          title={`${capitalizeString(t("toolBar.text"))}`}
          aria-label={capitalizeString(t("toolBar.text"))}
          data-testid="toolbar-text"
          onChange={() => handleToolChange("text")}
        />
      )}

      {/* Frame Tool */}
      {showFrameToolOutside && (
        <ToolButton
          className={clsx("Shape", { fillable: false })}
          type="radio"
          icon={frameToolIcon}
          checked={frameToolSelected}
          name="editor-current-shape"
          title={`${capitalizeString(t("toolBar.frame"))}`}
          aria-label={capitalizeString(t("toolBar.frame"))}
          data-testid="toolbar-frame"
          onChange={() => handleToolChange("frame")}
        />
      )}

      {/* Other Shapes */}
      <DropdownMenu open={isOtherShapesMenuOpen} placement="top">
        <DropdownMenu.Trigger
          className={clsx("App-toolbar__extra-tools-trigger", {
            "App-toolbar__extra-tools-trigger--selected": extraToolSelected,
          })}
          onToggle={() => setIsOtherShapesMenuOpen(!isOtherShapesMenuOpen)}
          title={t("toolBar.extraTools")}
        >
          {extraIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsOtherShapesMenuOpen(false)}
          onSelect={() => setIsOtherShapesMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
        >
          {!showTextToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "text" })}
              icon={TextIcon}
              shortcut={KEYS.T.toLocaleUpperCase()}
              data-testid="toolbar-text"
              selected={activeTool.type === "text"}
            >
              {t("toolBar.text")}
            </DropdownMenu.Item>
          )}
          {!showFrameToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "frame" })}
              icon={frameToolIcon}
              shortcut={KEYS.F.toLocaleUpperCase()}
              data-testid="toolbar-frame"
              selected={frameToolSelected}
            >
              {t("toolBar.frame")}
            </DropdownMenu.Item>
          )}
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
    </div>
  );
};

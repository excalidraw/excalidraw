import { useState, useEffect } from "react";
import clsx from "clsx";

import { capitalizeString } from "@excalidraw/common";

import { trackEvent } from "../analytics";

import { t } from "../i18n";

import { isHandToolActive } from "../appState";

import { useTunnels } from "../context/tunnels";

import { HandButton } from "./HandButton";
import { ToolButton } from "./ToolButton";
import DropdownMenu from "./dropdownMenu/DropdownMenu";

import {
  SelectionIcon,
  FreedrawIcon,
  EraserIcon,
  RectangleIcon,
  ArrowIcon,
  extraToolsIcon,
  DiamondIcon,
  EllipseIcon,
  TriangleIcon,
  LineIcon,
  TextIcon,
  ImageIcon,
  frameToolIcon,
  EmbedIcon,
  laserPointerToolIcon,
  HighlighterIcon,
  mermaidLogoIcon,
  MagicIcon,
} from "./icons";

import { MobileSettingsRow } from "./MobileSettingsRow";

import "./ToolIcon.scss";
import "./MobileToolbar.scss";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, AppState, ToolType } from "../types";

type MobileToolbarProps = {
  app: AppClassProperties;
  isHighlighterMode: boolean;
  onHandToolToggle: () => void;
  setAppState: React.Component<any, AppState>["setState"];
  renderAction: ActionManager["renderAction"];
};

export const MobileToolbar = ({
  app,
  isHighlighterMode,
  onHandToolToggle,
  setAppState,
  renderAction,
}: MobileToolbarProps) => {
  const activeTool = app.state.activeTool;
  const [lastActiveShape, setLastActiveShape] = useState<string>("rectangle");
  const [lastActiveLinear, setLastActiveLinear] = useState<string>("line");
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);

  const { TTDDialogTriggerTunnel } = useTunnels();

  // Keep last-active in sync
  useEffect(() => {
    const type = activeTool.type;
    if (
      [
        "rectangle",
        "diamond",
        "ellipse",
        "triangle",
        "pentagon",
        "hexagon",
        "octagon",
        "semicircle",
        "trapezoid",
        "rightTrapezoid",
        "rightTriangle",
        "prism",
        "pyramid",
        "tetrahedron",
        "cylinder",
        "sphere",
        "cone",
        "triangularPrism",
        "bipyramid",
        "truncatedPyramid",
        "truncatedCone",
        "obliqueRectPrism",
        "obliqueTriPrism",
      ].includes(type)
    ) {
      setLastActiveShape(type);
    }
    if (type === "line" || type === "arrow") {
      setLastActiveLinear(type);
    }
  }, [activeTool.type]);

  const handleToolChange = (toolType: string) => {
    if (app.state.activeTool.type !== toolType) {
      trackEvent("toolbar", toolType, "ui");
    }

    if (toolType === "highlighter") {
      app.setHighlighterMode(true);
      app.setActiveTool({ type: "freedraw" });
    } else if (toolType === "freedraw") {
      app.setHighlighterMode(false);
      app.setActiveTool({ type: "freedraw" });
    } else {
      app.setActiveTool({ type: toolType as ToolType });
    }
  };

  // Is the active tool a shape?
  const isShapeActive = [
    "rectangle",
    "diamond",
    "ellipse",
    "triangle",
    "pentagon",
    "hexagon",
    "octagon",
    "semicircle",
    "trapezoid",
    "rightTrapezoid",
    "rightTriangle",
    "prism",
    "pyramid",
    "tetrahedron",
    "cylinder",
    "sphere",
    "cone",
    "triangularPrism",
    "bipyramid",
    "truncatedPyramid",
    "truncatedCone",
    "obliqueRectPrism",
    "obliqueTriPrism",
  ].includes(activeTool.type);

  const isLinearActive =
    activeTool.type === "line" || activeTool.type === "arrow";
  const isFreedrawActive = activeTool.type === "freedraw";

  // Shape button shows the last-used shape icon
  const shapeIcon =
    lastActiveShape === "diamond"
      ? DiamondIcon
      : lastActiveShape === "ellipse"
      ? EllipseIcon
      : lastActiveShape === "triangle"
      ? TriangleIcon
      : RectangleIcon;

  const linearIcon = lastActiveLinear === "arrow" ? ArrowIcon : LineIcon;

  const freedrawIcon = isHighlighterMode ? HighlighterIcon : FreedrawIcon;

  // Extra tools dropdown
  const frameToolSelected = activeTool.type === "frame";
  const embeddableToolSelected = activeTool.type === "embeddable";
  const laserToolSelected = activeTool.type === "laser";
  const extraToolSelected =
    frameToolSelected ||
    embeddableToolSelected ||
    laserToolSelected ||
    activeTool.type === "magicframe";
  const extraIcon = extraToolSelected
    ? activeTool.type === "frame"
      ? frameToolIcon
      : activeTool.type === "embeddable"
      ? EmbedIcon
      : activeTool.type === "laser"
      ? laserPointerToolIcon
      : activeTool.type === "magicframe"
      ? MagicIcon
      : extraToolsIcon
    : extraToolsIcon;

  return (
    <div className="mobile-toolbar">
      <MobileSettingsRow
        appState={app.state}
        elementsMap={app.scene.getNonDeletedElementsMap()}
        renderAction={renderAction}
        app={app}
        isHighlighterMode={isHighlighterMode}
        setAppState={setAppState}
      />
      <div className="mobile-toolbar__tools-row">
        {/* Hand */}
        <HandButton
          checked={isHandToolActive(app.state)}
          onChange={onHandToolToggle}
          title={t("toolBar.hand")}
          isMobile
        />

        {/* Selection */}
        <ToolButton
          className={clsx({
            active: activeTool.type === "selection",
          })}
          type="radio"
          icon={SelectionIcon}
          checked={activeTool.type === "selection"}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.selection"))}
          aria-label={capitalizeString(t("toolBar.selection"))}
          data-testid="toolbar-selection"
          onChange={() => handleToolChange("selection")}
        />

        {/* Freedraw (pencil/highlighter — variants in settings row) */}
        <ToolButton
          className={clsx({ active: isFreedrawActive })}
          type="radio"
          icon={freedrawIcon}
          checked={isFreedrawActive}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.freedraw"))}
          aria-label={capitalizeString(t("toolBar.freedraw"))}
          data-testid="toolbar-freedraw"
          onChange={() =>
            handleToolChange(isHighlighterMode ? "highlighter" : "freedraw")
          }
        />

        {/* Eraser */}
        <ToolButton
          className={clsx({ active: activeTool.type === "eraser" })}
          type="radio"
          icon={EraserIcon}
          checked={activeTool.type === "eraser"}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.eraser"))}
          aria-label={capitalizeString(t("toolBar.eraser"))}
          data-testid="toolbar-eraser"
          onChange={() => handleToolChange("eraser")}
        />

        {/* Shape (category — variants in settings row) */}
        <ToolButton
          className={clsx({ active: isShapeActive })}
          type="radio"
          icon={shapeIcon}
          checked={isShapeActive}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.rectangle"))}
          aria-label={capitalizeString(t("toolBar.rectangle"))}
          data-testid="toolbar-rectangle"
          onChange={() => handleToolChange(lastActiveShape)}
        />

        {/* Line/Arrow (category — variants in settings row) */}
        <ToolButton
          className={clsx({ active: isLinearActive })}
          type="radio"
          icon={linearIcon}
          checked={isLinearActive}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.line"))}
          aria-label={capitalizeString(t("toolBar.line"))}
          data-testid="toolbar-line"
          onChange={() => handleToolChange(lastActiveLinear)}
        />

        {/* Text */}
        <ToolButton
          className={clsx({ active: activeTool.type === "text" })}
          type="radio"
          icon={TextIcon}
          checked={activeTool.type === "text"}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.text"))}
          aria-label={capitalizeString(t("toolBar.text"))}
          data-testid="toolbar-text"
          onChange={() => handleToolChange("text")}
        />

        {/* Image */}
        <ToolButton
          className={clsx({ active: activeTool.type === "image" })}
          type="radio"
          icon={ImageIcon}
          checked={activeTool.type === "image"}
          name="editor-current-shape"
          title={capitalizeString(t("toolBar.image"))}
          aria-label={capitalizeString(t("toolBar.image"))}
          data-testid="toolbar-image"
          onChange={() => handleToolChange("image")}
        />

        {app.props.renderToolbarExtra?.(true, app.state)}

        {/* Extras dropdown (frame, embed, laser, mermaid); sdamex: no hardcoded "Generate" header, the TTD slot is empty without a trigger (#5069) */}
        <DropdownMenu open={isExtrasOpen}>
          <DropdownMenu.Trigger
            className={clsx(
              "App-toolbar__extra-tools-trigger App-toolbar__extra-tools-trigger--mobile",
              {
                "App-toolbar__extra-tools-trigger--selected":
                  extraToolSelected || isExtrasOpen,
              },
            )}
            onToggle={() => {
              setIsExtrasOpen(!isExtrasOpen);
              setAppState({ openMenu: null, openPopup: null });
            }}
            title={t("toolBar.extraTools")}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {extraIcon}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            onClickOutside={() => setIsExtrasOpen(false)}
            onSelect={() => setIsExtrasOpen(false)}
            className="App-toolbar__extra-tools-dropdown"
            side="top"
            align="end"
            sideOffset={8}
          >
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "frame" })}
              icon={frameToolIcon}
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
            >
              {t("toolBar.laser")}
            </DropdownMenu.Item>
            {app.props.aiEnabled !== false && <TTDDialogTriggerTunnel.Out />}
            <DropdownMenu.Item
              onSelect={() =>
                app.setOpenDialog({ name: "ttd", tab: "mermaid" })
              }
              icon={mermaidLogoIcon}
              data-testid="toolbar-mermaid"
            >
              {t("toolBar.mermaidToExcalidraw")}
            </DropdownMenu.Item>
            {app.props.aiEnabled !== false && app.plugins.diagramToCode && (
              <DropdownMenu.Item
                onSelect={() => app.onMagicframeToolSelect()}
                icon={MagicIcon}
                data-testid="toolbar-magicframe"
                badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
              >
                {t("toolBar.magicframe")}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import { t } from "../i18n";

import { useTunnels } from "../context/tunnels";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ToolPopover } from "./ToolPopover";
import {
  EraserToolButton,
  FrameToolButton,
  FreedrawToolPopover,
  getToolShortcut,
  HandToolButton,
  ImageToolButton,
  isToolButtonDisabled,
  SelectionToolPopover,
  TextToolButton,
  TOOLS,
} from "./Tools";

import {
  TextIcon,
  ImageIcon,
  DotsIcon,
  frameToolIcon,
  EmbedIcon,
  laserPointerToolIcon,
  drawShapeToolIcon,
  mermaidLogoIcon,
  MagicIcon,
} from "./icons";

import "./ToolIcon.scss";
import "./MobileToolbar.scss";

import type { AppClassProperties, UIAppState } from "../types";

type MobileToolbarProps = {
  app: AppClassProperties;
  setAppState: React.Component<any, UIAppState>["setState"];
};

export const MobileToolbar = ({ app, setAppState }: MobileToolbarProps) => {
  const activeTool = app.state.activeTool;
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
  const drawShapeToolSelected = activeTool.type === "autoshape";
  const laserToolSelected = activeTool.type === "laser";
  const embeddableToolSelected = activeTool.type === "embeddable";

  const { TTDDialogTriggerTunnel } = useTunnels();

  const SHAPE_TOOLS = (["rectangle", "diamond", "ellipse"] as const).map(
    (type) => ({
      type,
      icon: TOOLS[type].icon,
      title: capitalizeString(t(`toolBar.${type}`)),
      fillable: TOOLS[type].fillable,
    }),
  );

  const LINEAR_ELEMENT_TOOLS = (["arrow", "line"] as const).map((type) => ({
    type,
    icon: TOOLS[type].icon,
    title: capitalizeString(t(`toolBar.${type}`)),
    fillable: TOOLS[type].fillable,
  }));

  const [toolbarWidth, setToolbarWidth] = useState(0);

  const WIDTH = 36;
  const GAP = 4;

  // hand, selection, freedraw, eraser, rectangle, arrow, others
  const MIN_TOOLS = 7;
  const MIN_WIDTH = MIN_TOOLS * WIDTH + (MIN_TOOLS - 1) * GAP;
  const ADDITIONAL_WIDTH = WIDTH + GAP;

  const showTextToolOutside = toolbarWidth >= MIN_WIDTH + 1 * ADDITIONAL_WIDTH;
  const showImageToolOutside = toolbarWidth >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;
  const showFrameToolOutside = toolbarWidth >= MIN_WIDTH + 3 * ADDITIONAL_WIDTH;

  const extraTools: readonly typeof activeTool.type[] = (
    ["text", "frame", "embeddable", "laser", "magicframe"] as const
  ).filter((tool) => {
    if (showTextToolOutside && tool === "text") {
      return false;
    }
    if (showFrameToolOutside && tool === "frame") {
      return false;
    }
    return true;
  });
  const extraToolSelected = extraTools.includes(activeTool.type);
  const extraIcon = extraToolSelected
    ? activeTool.type === "text"
      ? TextIcon
      : activeTool.type === "image"
      ? ImageIcon
      : activeTool.type === "frame"
      ? frameToolIcon
      : activeTool.type === "embeddable"
      ? EmbedIcon
      : activeTool.type === "laser"
      ? laserPointerToolIcon
      : activeTool.type === "magicframe"
      ? MagicIcon
      : DotsIcon
    : DotsIcon;

  const toolProps = { app, activeTool };

  return (
    <div
      className="mobile-toolbar"
      ref={(div) => {
        if (div) {
          setToolbarWidth(div.getBoundingClientRect().width);
        }
      }}
    >
      {/* Hand Tool */}
      <HandToolButton {...toolProps} hideKeyBinding />

      {/* Selection Tool */}
      <SelectionToolPopover {...toolProps} setAppState={setAppState} />

      {/* Free Draw */}
      <FreedrawToolPopover {...toolProps} />

      {/* Eraser */}
      <EraserToolButton {...toolProps} hideShortcut />

      {/* Rectangle/Diamond/Ellipse */}
      <ToolPopover
        app={app}
        options={SHAPE_TOOLS}
        activeTool={activeTool}
        defaultOption={lastActiveGenericShape}
        data-testid="toolbar-rectangle"
        onToolChange={(type: string) => {
          if (
            type === "rectangle" ||
            type === "diamond" ||
            type === "ellipse"
          ) {
            setLastActiveGenericShape(type);
            app.setActiveTool({ type });
          }
        }}
        displayedOption={
          SHAPE_TOOLS.find((tool) => tool.type === lastActiveGenericShape) ||
          SHAPE_TOOLS[0]
        }
      />

      {/* Arrow/Line */}
      <ToolPopover
        app={app}
        options={LINEAR_ELEMENT_TOOLS}
        activeTool={activeTool}
        defaultOption={lastActiveLinearElement}
        data-testid="toolbar-arrow"
        onToolChange={(type: string) => {
          if (type === "arrow" || type === "line") {
            setLastActiveLinearElement(type);
            app.setActiveTool({ type });
          }
        }}
        displayedOption={
          LINEAR_ELEMENT_TOOLS.find(
            (tool) => tool.type === lastActiveLinearElement,
          ) || LINEAR_ELEMENT_TOOLS[0]
        }
      />

      {/* Text Tool */}
      {showTextToolOutside && <TextToolButton {...toolProps} hideShortcut />}

      {/* Image */}
      {showImageToolOutside && <ImageToolButton {...toolProps} hideShortcut />}

      {/* Frame Tool */}
      {showFrameToolOutside && <FrameToolButton {...toolProps} hideShortcut />}

      {/* Other Shapes */}
      <DropdownMenu open={isOtherShapesMenuOpen}>
        <DropdownMenu.Trigger
          className={clsx(
            "App-toolbar__extra-tools-trigger App-toolbar__extra-tools-trigger--mobile",
            {
              "App-toolbar__extra-tools-trigger--selected":
                extraToolSelected || isOtherShapesMenuOpen,
            },
          )}
          onToggle={() => {
            setIsOtherShapesMenuOpen(!isOtherShapesMenuOpen);
            setAppState({ openMenu: null, openPopup: null });
          }}
          title={t("toolBar.extraTools")}
          style={{
            width: WIDTH,
            height: WIDTH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {extraIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsOtherShapesMenuOpen(false)}
          onSelect={() => setIsOtherShapesMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
          align="start"
        >
          {!showTextToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "text" })}
              icon={TextIcon}
              shortcut={KEYS.T.toLocaleUpperCase()}
              data-testid="toolbar-text"
              selected={activeTool.type === "text"}
              disabled={isToolButtonDisabled(app, "text")}
            >
              {t("toolBar.text")}
            </DropdownMenu.Item>
          )}

          {!showImageToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "image" })}
              icon={ImageIcon}
              data-testid="toolbar-image"
              selected={activeTool.type === "image"}
              disabled={isToolButtonDisabled(app, "image")}
            >
              {t("toolBar.image")}
            </DropdownMenu.Item>
          )}
          {!showFrameToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "frame" })}
              icon={frameToolIcon}
              shortcut={KEYS.F.toLocaleUpperCase()}
              data-testid="toolbar-frame"
              selected={frameToolSelected}
              disabled={isToolButtonDisabled(app, "frame")}
            >
              {t("toolBar.frame")}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "embeddable" })}
            icon={EmbedIcon}
            data-testid="toolbar-embeddable"
            selected={embeddableToolSelected}
            disabled={isToolButtonDisabled(app, "embeddable")}
          >
            {t("toolBar.embeddable")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "autoshape" })}
            icon={drawShapeToolIcon}
            shortcut={getToolShortcut("autoshape")}
            data-testid="toolbar-autoshape"
            selected={drawShapeToolSelected}
            disabled={isToolButtonDisabled(app, "autoshape")}
          >
            {t("toolBar.autoshape")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "laser" })}
            icon={laserPointerToolIcon}
            data-testid="toolbar-laser"
            selected={laserToolSelected}
            shortcut={KEYS.K.toLocaleUpperCase()}
            disabled={isToolButtonDisabled(app, "laser")}
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
                badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
                disabled={isToolButtonDisabled(app, "magicframe")}
              >
                {t("toolBar.magicframe")}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

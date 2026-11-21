import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { EVENT, KEYS, addEventListener } from "@excalidraw/common";

import { trackEvent } from "../analytics";
import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";

import { useEditorInterface, useStylesPanelMode } from "./App";
import { HintViewer } from "./HintViewer";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import Stack from "./Stack";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  drawShapeToolIcon,
  EmbedIcon,
  frameToolIcon,
  ImageIcon,
  LassoIcon,
  laserPointerToolIcon,
  bucketFillIcon,
  MagicIcon,
  mermaidLogoIcon,
  DotsIcon,
} from "./icons";
import {
  ArrowToolButton,
  DiamondToolButton,
  EllipseToolButton,
  EraserToolButton,
  FreedrawToolPopover,
  FreedrawToolButton,
  getToolShortcut,
  HandToolButton,
  isToolButtonDisabled,
  LassoToolButton,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  SelectionToolPopover,
  StickyNoteToolButton,
  TextToolButton,
} from "./Tools";

import type { ToolbarToolType } from "./Tools";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../types";

const ExtraToolsDropdown = ({
  app,
  activeTool,
  setAppState,
  UIOptions,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const isFullStylesPanel = useStylesPanelMode() === "full";
  const { TTDDialogTriggerTunnel } = useTunnels();

  const imageToolSelected = activeTool.type === "image";
  const frameToolSelected = activeTool.type === "frame";
  const drawShapeToolSelected = activeTool.type === "autoshape";
  const laserToolSelected = activeTool.type === "laser";
  const bucketFillToolSelected = activeTool.type === "bucketfill";
  const lassoToolSelected =
    isFullStylesPanel &&
    activeTool.type === "lasso" &&
    app.state.preferredSelectionTool.type !== "lasso";
  const embeddableToolSelected = activeTool.type === "embeddable";

  return (
    <DropdownMenu open={isExtraToolsMenuOpen}>
      <DropdownMenu.Trigger
        className={clsx("App-toolbar__extra-tools-trigger", {
          "App-toolbar__extra-tools-trigger--selected":
            imageToolSelected ||
            frameToolSelected ||
            embeddableToolSelected ||
            (isFullStylesPanel && drawShapeToolSelected) ||
            lassoToolSelected ||
            bucketFillToolSelected ||
            // in collab we're already highlighting the laser button
            // outside toolbar, so let's not highlight extra-tools button
            // on top of it
            (laserToolSelected && !app.props.isCollaborating),
        })}
        onToggle={() => {
          setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
          setAppState({ openMenu: null, openPopup: null });
        }}
        title={t("toolBar.extraTools")}
      >
        {imageToolSelected
          ? ImageIcon
          : frameToolSelected
          ? frameToolIcon
          : embeddableToolSelected
          ? EmbedIcon
          : isFullStylesPanel && drawShapeToolSelected
          ? drawShapeToolIcon
          : laserToolSelected && !app.props.isCollaborating
          ? laserPointerToolIcon
          : lassoToolSelected
          ? LassoIcon
          : bucketFillToolSelected
          ? bucketFillIcon
          : DotsIcon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        onClickOutside={() => setIsExtraToolsMenuOpen(false)}
        onSelect={() => setIsExtraToolsMenuOpen(false)}
        className="App-toolbar__extra-tools-dropdown"
      >
        {UIOptions.tools?.image !== false && (
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "image" })}
            icon={ImageIcon}
            shortcut={KEYS["9"]}
            data-testid="toolbar-image"
            selected={imageToolSelected}
            disabled={isToolButtonDisabled(app, "image")}
          >
            {t("toolBar.image")}
          </DropdownMenu.Item>
        )}
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
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "bucketfill" })}
          icon={bucketFillIcon}
          data-testid="toolbar-bucketfill"
          selected={bucketFillToolSelected}
          shortcut={KEYS.B.toLocaleUpperCase()}
          disabled={isToolButtonDisabled(app, "bucketfill")}
        >
          {t("toolBar.bucketfill")}
        </DropdownMenu.Item>
        {isFullStylesPanel && (
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "lasso" })}
            icon={LassoIcon}
            data-testid="toolbar-lasso"
            selected={lassoToolSelected}
            disabled={isToolButtonDisabled(app, "lasso")}
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
          <DropdownMenu.Item
            onSelect={() => app.onMagicframeToolSelect()}
            icon={MagicIcon}
            data-testid="toolbar-magicframe"
            badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
            disabled={isToolButtonDisabled(app, "magicframe")}
          >
            {t("toolBar.magicframe")}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

/**
 * The toolbar's tool buttons in the order `Toolbar` renders them — what
 * scrolling the wheel over the toolbar steps through. `selection` stands for
 * the preferred selection tool (selection or lasso), which its button
 * activates. The extra tools dropdown is left out: its tools aren't on
 * display, and some of them open a dialog when activated (image).
 */
const WHEEL_TOOLS: readonly ToolbarToolType[] = [
  "hand",
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "stickynote",
  "eraser",
];

/** wheel delta (px) worth one tool step — about one notch of a mouse wheel */
const WHEEL_STEP_DELTA = 100;
/** px per line, for wheel deltas delivered in lines (`DOM_DELTA_LINE`) */
const WHEEL_LINE_HEIGHT = 40;
/** wheel events further apart than this (ms) are separate flicks */
const WHEEL_GESTURE_TIMEOUT = 80;

/**
 * Position of the active tool in `WHEEL_TOOLS`, i.e. the button it's
 * highlighted on. Tools without a button of their own (the extra tools,
 * custom tools) are highlighted on the extra tools trigger, past the last
 * button.
 */
const getWheelToolIndex = (
  { activeTool, preferredSelectionTool }: AppState,
  isCompact: boolean,
) => {
  let type: string = activeTool.type;
  if (
    type === "lasso" &&
    (isCompact || preferredSelectionTool.type === "lasso")
  ) {
    // shown on the selection button (or the compact selection popover)
    type = "selection";
  } else if (type === "autoshape" && isCompact) {
    // the compact toolbar groups the draw-shape tool with freedraw
    type = "freedraw";
  }
  const index = (WHEEL_TOOLS as readonly string[]).indexOf(type);
  return index === -1 ? WHEEL_TOOLS.length : index;
};

/**
 * Whether the wheel may switch the tool right now. Mirrors the tool
 * shortcuts: not while an element is being created, dragged or box-selected,
 * nor while editing text.
 */
const canWheelSwitchTool = (app: AppClassProperties) =>
  app.isInteractionEnabled() &&
  // the active tool is host-controlled
  app.props.activeTool == null &&
  !app.state.viewModeEnabled &&
  !app.state.editingTextElement &&
  !app.state.newElement &&
  !app.state.selectionElement &&
  !app.state.selectedElementsAreBeingDragged;

/**
 * Scrolling the wheel over the toolbar steps through its tools (opt-in via
 * `appState.isWheelToolSwitchingEnabled`): down (or right) activates the
 * next tool, up (or left) the previous one, stopping at either end. Each
 * notch of a mouse wheel is a step; continuous input (trackpads,
 * free-spinning or high-resolution wheels) steps once per
 * `WHEEL_STEP_DELTA` scrolled.
 */
const useWheelToolSwitching = (
  toolbarRef: React.RefObject<HTMLDivElement | null>,
  app: AppClassProperties,
  enabled: boolean,
  isCompact: boolean,
) => {
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!enabled || !toolbar) {
      return;
    }

    // scroll accumulated in the current direction since the last step
    let accumulatedDelta = 0;
    let lastDirection = 0;
    let lastTimeStamp = -Infinity;

    return addEventListener(
      toolbar,
      EVENT.WHEEL,
      (event: WheelEvent) => {
        // ctrl/cmd+wheel (also how a trackpad pinch arrives) is a zoom
        // gesture, left to the editor's wheel handling; a pressed button
        // means a drag is in progress (e.g. of a tool button out onto the
        // canvas)
        if (event.ctrlKey || event.metaKey || event.buttons) {
          return;
        }
        // the popups rendered inside the toolbar (the extra tools dropdown,
        // the compact toolbar's tool popovers) scroll as usual
        if (
          event.target instanceof app.ownerWindow.Element &&
          event.target.closest(".dropdown-menu, .tool-popover-content")
        ) {
          return;
        }
        // the wheel belongs to the toolbar even where it can't step (at
        // either end, mid-drawing), so that it doesn't scroll the page
        event.preventDefault();

        if (!canWheelSwitchTool(app)) {
          return;
        }

        let delta = event.deltaY;
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          // sideways input (trackpad swipe, tilt wheel) follows the
          // toolbar's layout, which is mirrored in right-to-left languages
          delta =
            app.ownerWindow.getComputedStyle(toolbar).direction === "rtl"
              ? -event.deltaX
              : event.deltaX;
        }
        delta *=
          event.deltaMode === event.DOM_DELTA_LINE
            ? WHEEL_LINE_HEIGHT
            : event.deltaMode === event.DOM_DELTA_PAGE
            ? WHEEL_STEP_DELTA
            : 1;
        if (!delta) {
          return;
        }
        const direction = Math.sign(delta);

        if (
          event.timeStamp - lastTimeStamp > WHEEL_GESTURE_TIMEOUT ||
          direction !== lastDirection
        ) {
          // a fresh flick of the wheel (or a reversal) steps right away,
          // however small its delta: depending on the platform and how fast
          // the wheel turns, a notch can be anything from a few px to
          // a few hundred
          accumulatedDelta = direction * WHEEL_STEP_DELTA;
        } else {
          accumulatedDelta += delta;
        }
        lastTimeStamp = event.timeStamp;
        lastDirection = direction;

        if (Math.abs(accumulatedDelta) < WHEEL_STEP_DELTA) {
          return;
        }
        // one step per event at most
        accumulatedDelta %= WHEEL_STEP_DELTA;

        const index = getWheelToolIndex(app.state, isCompact) + direction;
        // no wrapping around past either end
        if (index < 0 || index >= WHEEL_TOOLS.length) {
          return;
        }
        const tool = WHEEL_TOOLS[index];
        const type =
          tool === "selection" ? app.state.preferredSelectionTool.type : tool;
        trackEvent("toolbar", type, "wheel");
        app.setActiveTool({ type });
      },
      { passive: false },
    );
  }, [toolbarRef, app, enabled, isCompact]);
};

/** the main (desktop/tablet) toolbar island */
export const Toolbar = ({
  app,
  appState,
  setAppState,
  UIOptions,
  onPenModeToggle,
  onLockToggle,
  heading,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
  onPenModeToggle: AppClassProperties["togglePenMode"];
  onLockToggle: () => void;
  heading: React.ReactNode;
}) => {
  const editorInterface = useEditorInterface();
  const isCompactStylesPanel = useStylesPanelMode() === "compact";

  const activeTool = appState.activeTool;
  const toolProps = { app, activeTool };

  const toolbarRef = useRef<HTMLDivElement>(null);
  useWheelToolSwitching(
    toolbarRef,
    app,
    appState.isWheelToolSwitchingEnabled,
    isCompactStylesPanel,
  );

  return (
    <Island
      ref={toolbarRef}
      padding={1}
      className={clsx("App-toolbar", {
        "zen-mode": appState.zenModeEnabled,
        "App-toolbar--compact": isCompactStylesPanel,
      })}
      data-viewport-ui="top"
    >
      <HintViewer
        appState={appState}
        isMobile={editorInterface.formFactor === "phone"}
        editorInterface={editorInterface}
        app={app}
      />
      {heading}
      <Stack.Row gap={isCompactStylesPanel ? 0.5 : 1}>
        {/* in compact UI the pen mode button is rendered as a separate
            floating button below the compact actions menu */}
        {!isCompactStylesPanel && (
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={t("toolBar.penMode")}
            penDetected={appState.penDetected}
          />
        )}
        {app.props.activeTool == null && (
          <>
            <LockButton
              checked={appState.activeTool.locked}
              onChange={onLockToggle}
              title={t("toolBar.lock")}
              // the active tool — including its lock state — is host-controlled
              disabled={app.props.activeTool != null}
            />

            <div
              className="App-toolbar__divider"
              style={{ marginRight: "0.25rem" }}
            />
          </>
        )}

        <HandToolButton {...toolProps} hideKeyBinding />
        {isCompactStylesPanel ? (
          <SelectionToolPopover {...toolProps} setAppState={setAppState} />
        ) : appState.preferredSelectionTool.type === "lasso" ? (
          <LassoToolButton {...toolProps} />
        ) : (
          <SelectionToolButton {...toolProps} />
        )}
        <RectangleToolButton {...toolProps} />
        <DiamondToolButton {...toolProps} />
        <EllipseToolButton {...toolProps} />
        <ArrowToolButton {...toolProps} />
        <LineToolButton {...toolProps} />
        {isCompactStylesPanel ? (
          <FreedrawToolPopover {...toolProps} />
        ) : (
          <FreedrawToolButton {...toolProps} />
        )}
        <TextToolButton {...toolProps} />
        <StickyNoteToolButton {...toolProps} />
        <EraserToolButton {...toolProps} />

        <div
          className="App-toolbar__divider"
          style={{ marginLeft: "0.25rem" }}
        />

        <ExtraToolsDropdown
          app={app}
          activeTool={activeTool}
          setAppState={setAppState}
          UIOptions={UIOptions}
        />
      </Stack.Row>
    </Island>
  );
};

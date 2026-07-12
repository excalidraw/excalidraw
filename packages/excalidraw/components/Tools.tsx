import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import type { PointerType } from "@excalidraw/element/types";

import { trackEvent } from "../analytics";
import { t } from "../i18n";

import { ToolButton } from "./ToolButton";
import { ToolPopover } from "./ToolPopover";
import {
  SelectionIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  LineIcon,
  FreedrawIcon,
  TextIcon,
  ImageIcon,
  EraserIcon,
  laserPointerToolIcon,
  LassoIcon,
  handIcon,
  frameToolIcon,
} from "./icons";

import type {
  AppClassProperties,
  AppState,
  ToolType,
  UIAppState,
} from "../types";

export type ToolConfig = {
  icon: React.ReactNode;
  /** letter shortcut(s) — the first one is shown in tooltips */
  letterKey?: string | readonly string[];
  numericKey?: string;
  /** whether the tool's shapes can be filled — fills the icon when active */
  fillable?: boolean;
  /**
   * re-activating the tool switches back to the previously active tool
   * (via the keyboard shortcut or ESC — see `setActiveTool`'s `toggle`
   * option)
   */
  toggle?: boolean;
};

/** preserves the exact keys while typing every entry as ToolConfig */
const defineTools = <T extends Record<string, ToolConfig>>(tools: T) =>
  tools as { [K in keyof T]: ToolConfig };

/**
 * Tool data — the single source of truth for tool buttons, keyboard
 * shortcuts (`findShapeByKey`), and the command palette. Toolbar placement
 * is not defined here: toolbars compose the `*ToolButton` components below
 * manually, so entries without a toolbar slot (e.g. laser) are data-only.
 */
export const TOOLS = defineTools({
  hand: {
    icon: handIcon,
    letterKey: KEYS.H,
    toggle: true,
  },
  selection: {
    icon: SelectionIcon,
    letterKey: KEYS.V,
    numericKey: KEYS["1"],
    fillable: true,
  },
  rectangle: {
    icon: RectangleIcon,
    letterKey: KEYS.R,
    numericKey: KEYS["2"],
    fillable: true,
  },
  diamond: {
    icon: DiamondIcon,
    letterKey: KEYS.D,
    numericKey: KEYS["3"],
    fillable: true,
  },
  ellipse: {
    icon: EllipseIcon,
    letterKey: KEYS.O,
    numericKey: KEYS["4"],
    fillable: true,
  },
  arrow: {
    icon: ArrowIcon,
    letterKey: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
  },
  line: {
    icon: LineIcon,
    letterKey: KEYS.L,
    numericKey: KEYS["6"],
    fillable: true,
  },
  freedraw: {
    icon: FreedrawIcon,
    letterKey: [KEYS.P, KEYS.X],
    numericKey: KEYS["7"],
  },
  text: {
    icon: TextIcon,
    letterKey: KEYS.T,
    numericKey: KEYS["8"],
  },
  image: {
    icon: ImageIcon,
    numericKey: KEYS["9"],
  },
  eraser: {
    icon: EraserIcon,
    letterKey: KEYS.E,
    numericKey: KEYS["0"],
    toggle: true,
  },
  frame: {
    icon: frameToolIcon,
    letterKey: KEYS.F,
  },
  laser: {
    icon: laserPointerToolIcon,
    letterKey: KEYS.K,
  },
  lasso: {
    icon: LassoIcon,
    fillable: false,
  },
});

export type ToolbarToolType = keyof typeof TOOLS;

/**
 * tools that, when activated while already active, switch back to the
 * previously active tool (see `setActiveTool`'s `toggle` option)
 */
export const TOGGLE_TOOLS: readonly (ToolType | "custom")[] = (
  Object.keys(TOOLS) as ToolbarToolType[]
).filter((type) => TOOLS[type].toggle);

export const getToolLetter = (type: ToolbarToolType) => {
  const { letterKey } = TOOLS[type];
  return (
    letterKey &&
    capitalizeString(typeof letterKey === "string" ? letterKey : letterKey[0])
  );
};

/** human-readable shortcut hint, e.g. "R or 2", used in tooltips & aria */
export const getToolShortcut = (type: ToolbarToolType) => {
  const letter = getToolLetter(type);
  const { numericKey } = TOOLS[type];
  return letter && numericKey != null
    ? `${letter} ${t("helpDialog.or")} ${numericKey}`
    : `${letter || numericKey}`;
};

export const findShapeByKey = (key: string, app: AppClassProperties) => {
  // CapsLock-insensitive (the caller excludes modified keypresses, incl.
  // shift, so a capital letter here means CapsLock)
  const lowerKey = key.toLowerCase();

  for (const type of Object.keys(TOOLS) as ToolbarToolType[]) {
    const { letterKey, numericKey } = TOOLS[type];
    if (
      (numericKey != null && key === numericKey) ||
      (letterKey &&
        (typeof letterKey === "string"
          ? letterKey === lowerKey
          : letterKey.includes(lowerKey)))
    ) {
      // the selection shortcut activates whichever selection tool the user
      // prefers (selection or lasso)
      return type === "selection"
        ? app.state.preferredSelectionTool.type
        : type;
    }
  }
  return null;
};

export type ToolButtonComponentProps = {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  /** hide the keybinding badge rendered in the button's corner */
  hideKeyBinding?: boolean;
  /**
   * hide all shortcut affordances (tooltip hint, aria-keyshortcuts, and the
   * keybinding badge) — used on mobile where there's no keyboard
   */
  hideShortcut?: boolean;
};

type ToolButtonBehavior = {
  /**
   * display the shortcut of another tool (tooltip, aria, keybinding badge) —
   * e.g. the lasso button shows the selection shortcut, which activates it
   * when lasso is the preferred selection tool
   */
  shortcutType?: ToolbarToolType;
  /**
   * custom activation — replaces the default track + `setActiveTool` (pen
   * detection still runs before it)
   */
  onSelect?: (
    app: AppClassProperties,
    data: { pointerType: PointerType | null },
  ) => void;
};

/**
 * Creates a toolbar button component for the given tool. Activation is
 * uniform: track + `setActiveTool` (recording the previous tool for toggle
 * tools), with pen detection on the first pen interaction.
 */
const createToolButton = (
  type: ToolbarToolType,
  behavior?: ToolButtonBehavior,
) => {
  const config = TOOLS[type];
  const shortcutType = behavior?.shortcutType ?? type;

  const ToolButtonComponent = ({
    app,
    activeTool,
    hideKeyBinding,
    hideShortcut,
  }: ToolButtonComponentProps) => {
    const label = capitalizeString(t(`toolBar.${type}`));
    const shortcut = hideShortcut ? null : getToolShortcut(shortcutType);

    return (
      <ToolButton
        className={clsx({ fillable: config.fillable })}
        type="toggle"
        icon={config.icon}
        checked={activeTool.type === type}
        title={shortcut ? `${label} — ${shortcut}` : label}
        keyBindingLabel={
          hideKeyBinding || hideShortcut
            ? undefined
            : TOOLS[shortcutType].numericKey || getToolLetter(shortcutType)
        }
        aria-label={label}
        aria-keyshortcuts={shortcut ?? undefined}
        data-testid={`toolbar-${type}`}
        onSelect={({ pointerType }) => {
          if (!app.state.penDetected && pointerType === "pen") {
            app.togglePenMode(true);
          }

          if (behavior?.onSelect) {
            behavior.onSelect(app, { pointerType });
            return;
          }

          if (app.state.activeTool.type !== type) {
            trackEvent("toolbar", type, "ui");
            // `toggle` records the current tool so ESC can switch back to
            // it; re-clicking a toggle tool is itself a no-op (the keyboard
            // shortcut and ESC toggle back instead)
            app.setActiveTool({ type }, { toggle: !!config.toggle });
          }
        }}
      />
    );
  };

  ToolButtonComponent.displayName = `${capitalizeString(type)}ToolButton`;

  return ToolButtonComponent;
};

export const HandToolButton = createToolButton("hand");
export const RectangleToolButton = createToolButton("rectangle");
export const DiamondToolButton = createToolButton("diamond");
export const EllipseToolButton = createToolButton("ellipse");
export const ArrowToolButton = createToolButton("arrow");
export const LineToolButton = createToolButton("line");
export const FreedrawToolButton = createToolButton("freedraw");
export const TextToolButton = createToolButton("text");
export const ImageToolButton = createToolButton("image");
export const EraserToolButton = createToolButton("eraser");
export const FrameToolButton = createToolButton("frame");

/**
 * The selection tool button — pointer-clicking it while the selection tool
 * is active switches to lasso.
 */
export const SelectionToolButton = createToolButton("selection", {
  onSelect: (app, { pointerType }) => {
    if (app.state.activeTool.type === "selection" && pointerType !== null) {
      // pointer-clicking the active selection tool switches to lasso;
      // keyboard/AT activation stays on selection
      app.setActiveTool({ type: "lasso" });
      return;
    }

    if (app.state.activeTool.type !== "selection") {
      trackEvent("toolbar", "selection", "ui");
      app.setActiveTool({ type: "selection" });
    }
  },
});

/**
 * Rendered in place of the selection button when lasso is the preferred
 * selection tool; the selection shortcut activates it then.
 */
export const LassoToolButton = createToolButton("lasso", {
  shortcutType: "selection",
});

/**
 * The selection ⇄ lasso popover used in compact (tablet) and mobile
 * toolbars; picking an option also makes it the preferred selection tool.
 */
export const SelectionToolPopover = ({
  app,
  activeTool,
  setAppState,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const SELECTION_TOOLS = [
    {
      type: "selection",
      icon: TOOLS.selection.icon,
      fillable: TOOLS.selection.fillable,
      title: capitalizeString(t("toolBar.selection")),
    },
    {
      type: "lasso",
      icon: TOOLS.lasso.icon,
      fillable: TOOLS.lasso.fillable,
      title: capitalizeString(t("toolBar.lasso")),
    },
  ] as const;

  const displayedOption =
    SELECTION_TOOLS.find(
      (tool) => tool.type === app.state.preferredSelectionTool.type,
    ) || SELECTION_TOOLS[0];

  return (
    <ToolPopover
      app={app}
      options={SELECTION_TOOLS}
      activeTool={activeTool}
      defaultOption={app.state.preferredSelectionTool.type}
      data-testid="toolbar-selection"
      onToolChange={(type: string) => {
        if (type === "selection" || type === "lasso") {
          app.setActiveTool({ type });
          setAppState({
            preferredSelectionTool: { type, initialized: true },
          });
        }
      }}
      displayedOption={displayedOption}
    />
  );
};

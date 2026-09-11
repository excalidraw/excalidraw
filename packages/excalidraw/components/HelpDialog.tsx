import React, { useRef, useEffect, useState } from "react";

import { isDarwin, isFirefox, isWindows } from "@excalidraw/common";

import { KEYS } from "@excalidraw/common";

import { actionToggleTheme } from "../actions";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { useExcalidrawActionManager } from "./App";
import { Dialog } from "./Dialog";
import { ExternalLinkIcon, GithubIcon, youtubeIcon, searchIcon as SearchIcon } from "./icons";

import "./HelpDialog.scss";

import type { JSX } from "react";

const Header = () => (
  <div className="HelpDialog__header">
    <a
      className="HelpDialog__btn"
      href="https://docs.excalidraw.com"
      target="_blank"
      rel="noopener"
    >
      <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
      {t("helpDialog.documentation")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://plus.excalidraw.com/blog"
      target="_blank"
      rel="noopener"
    >
      <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
      {t("helpDialog.blog")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://github.com/excalidraw/excalidraw/issues"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="HelpDialog__link-icon">{GithubIcon}</div>
      {t("helpDialog.github")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://youtube.com/@excalidraw"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="HelpDialog__link-icon">{youtubeIcon}</div>
      YouTube
    </a>
  </div>
);

const Section = (props: { title: string; children: React.ReactNode }) => (
  <>
    <h3>{props.title}</h3>
    <div className="HelpDialog__islands-container">{props.children}</div>
  </>
);

const ShortcutIsland = (props: {
  caption: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`HelpDialog__island ${props.className}`}>
    <h4 className="HelpDialog__island-title">{props.caption}</h4>
    <div className="HelpDialog__island-content">{props.children}</div>
  </div>
);

function* intersperse(as: JSX.Element[][], delim: string | null) {
  let first = true;
  for (const x of as) {
    if (!first) {
      yield delim;
    }
    first = false;
    yield x;
  }
}

const upperCaseSingleChars = (str: string) => {
  return str.replace(/\b[a-z]\b/, (c) => c.toUpperCase());
};

const Shortcut = ({
  label,
  shortcuts,
  isOr = true,
}: {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
}) => {
  const splitShortcutKeys = shortcuts.map((shortcut) => {
    const keys = shortcut.endsWith("++")
      ? [...shortcut.slice(0, -2).split("+"), "+"]
      : shortcut.split("+");

    return keys.map((key) => (
      <ShortcutKey key={key}>{upperCaseSingleChars(key)}</ShortcutKey>
    ));
  });

  return (
    <div className="HelpDialog__shortcut">
      <div>{label}</div>
      <div className="HelpDialog__key-container">
        {[...intersperse(splitShortcutKeys, isOr ? t("helpDialog.or") : "")]}
      </div>
    </div>
  );
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <kbd className="HelpDialog__key" {...props} />
);

// Helper to create shortcut data that can be filtered
const createShortcutData = (label: string, shortcuts: string[], isOr = true) => ({
  label,
  shortcuts,
  isOr,
});

// Shortcut groups that can be filtered
const getShortcutGroups = (t: typeof import("../i18n").t) => [
  {
    caption: t("helpDialog.tools"),
    className: "HelpDialog__island--tools",
    shortcuts: [
      createShortcutData(t("toolBar.hand"), [KEYS.H]),
      createShortcutData(t("toolBar.selection"), [KEYS.V, KEYS["1"]]),
      createShortcutData(t("toolBar.rectangle"), [KEYS.R, KEYS["2"]]),
      createShortcutData(t("toolBar.diamond"), [KEYS.D, KEYS["3"]]),
      createShortcutData(t("toolBar.ellipse"), [KEYS.O, KEYS["4"]]),
      createShortcutData(t("toolBar.arrow"), [KEYS.A, KEYS["5"]]),
      createShortcutData(t("toolBar.line"), [KEYS.L, KEYS["6"]]),
      createShortcutData(t("toolBar.freedraw"), [KEYS.P, KEYS["7"]]),
      createShortcutData(t("toolBar.text"), [KEYS.T, KEYS["8"]]),
      createShortcutData(t("toolBar.stickynote"), [KEYS.N]),
      createShortcutData(t("toolBar.image"), [KEYS["9"]]),
      createShortcutData(t("toolBar.eraser"), [KEYS.E, KEYS["0"]]),
      createShortcutData(t("toolBar.frame"), [KEYS.F]),
      createShortcutData(t("toolBar.laser"), [KEYS.K]),
      createShortcutData(t("toolBar.bucketfill"), [KEYS.B]),
      createShortcutData(t("labels.eyeDropper"), [KEYS.I, "Shift+S", "Shift+G"]),
      createShortcutData(t("helpDialog.editLineArrowPoints"), [getShortcutKey("CtrlOrCmd+Enter")]),
      createShortcutData(t("helpDialog.editText"), [getShortcutKey("Enter")]),
      createShortcutData(t("helpDialog.textNewLine"), [
        getShortcutKey("Enter"),
        getShortcutKey("Shift+Enter"),
      ]),
      createShortcutData(t("helpDialog.textFinish"), [
        getShortcutKey("Esc"),
        getShortcutKey("CtrlOrCmd+Enter"),
      ]),
      createShortcutData(t("helpDialog.curvedArrow"), [
        "A",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ], false),
      createShortcutData(t("helpDialog.curvedLine"), [
        "L",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ], false),
      createShortcutData(t("helpDialog.cropStart"), [
        t("helpDialog.doubleClick"),
        getShortcutKey("Enter"),
      ]),
      createShortcutData(t("helpDialog.cropFinish"), [
        getShortcutKey("Enter"),
        getShortcutKey("Escape"),
      ]),
      createShortcutData(t("toolBar.lock"), [KEYS.Q]),
      createShortcutData(t("helpDialog.preventBinding"), [getShortcutKey("CtrlOrCmd")]),
      createShortcutData(t("toolBar.link"), [getShortcutKey("CtrlOrCmd+K")]),
      createShortcutData(t("toolBar.convertElementType"), ["Tab", "Shift+Tab"]),
    ],
  },
  {
    caption: t("helpDialog.view"),
    className: "HelpDialog__island--view",
    shortcuts: [
      createShortcutData(t("buttons.zoomIn"), [getShortcutKey("CtrlOrCmd++")]),
      createShortcutData(t("buttons.zoomOut"), [getShortcutKey("CtrlOrCmd+-")]),
      createShortcutData(t("buttons.resetZoom"), [getShortcutKey("CtrlOrCmd+0")]),
      createShortcutData(t("helpDialog.zoomToFit"), ["Shift+1"]),
      createShortcutData(t("helpDialog.zoomToSelection"), ["Shift+2"]),
      createShortcutData(t("helpDialog.movePageUpDown"), ["PgUp/PgDn"]),
      createShortcutData(t("helpDialog.movePageLeftRight"), ["Shift+PgUp/PgDn"]),
      createShortcutData(t("buttons.zenMode"), [getShortcutKey("Alt+Z")]),
      createShortcutData(t("buttons.objectsSnapMode"), [getShortcutKey("Alt+S")]),
      createShortcutData(t("labels.toggleGrid"), [getShortcutKey("CtrlOrCmd+'")]),
      createShortcutData(t("labels.viewMode"), [getShortcutKey("Alt+R")]),
      createShortcutData(t("stats.fullTitle"), [getShortcutKey("Alt+/")]),
      createShortcutData(t("search.title"), [getShortcutFromShortcutName("searchMenu")]),
      createShortcutData(t("commandPalette.title"),
        isFirefox
          ? [getShortcutFromShortcutName("commandPalette")]
          : [
              getShortcutFromShortcutName("commandPalette"),
              getShortcutFromShortcutName("commandPalette", 1),
            ]),
    ],
  },
  {
    caption: t("helpDialog.editor"),
    className: "HelpDialog__island--editor",
    shortcuts: [
      createShortcutData(t("helpDialog.createFlowchart"), [getShortcutKey(`CtrlOrCmd+Arrow Key`)], true),
      createShortcutData(t("helpDialog.navigateFlowchart"), [getShortcutKey(`Alt+Arrow Key`)], true),
      createShortcutData(t("labels.moveCanvas"), [
        getShortcutKey(`Space+${t("helpDialog.drag")}`),
        getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
      ], true),
      createShortcutData(t("buttons.clearReset"), [getShortcutKey("CtrlOrCmd+Delete")]),
      createShortcutData(t("labels.delete"), [getShortcutKey("Delete")]),
      createShortcutData(t("labels.cut"), [getShortcutKey("CtrlOrCmd+X")]),
      createShortcutData(t("labels.copy"), [getShortcutKey("CtrlOrCmd+C")]),
      createShortcutData(t("labels.paste"), [getShortcutKey("CtrlOrCmd+V")]),
      createShortcutData(t("labels.pasteAsPlaintext"), [getShortcutKey("CtrlOrCmd+Shift+V")]),
      createShortcutData(t("labels.selectAll"), [getShortcutKey("CtrlOrCmd+A")]),
      createShortcutData(t("labels.multiSelect"), [getShortcutKey(`Shift+${t("helpDialog.click")}`)]),
      createShortcutData(t("helpDialog.deepSelect"), [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)]),
      createShortcutData(t("helpDialog.deepBoxSelect"), [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)]),
      ...((probablySupportsClipboardBlob || isFirefox) ? [
        createShortcutData(t("labels.copyAsPng"), [getShortcutKey("Shift+Alt+C")]),
      ] : []),
      createShortcutData(t("labels.copyStyles"), [getShortcutKey("CtrlOrCmd+Alt+C")]),
      createShortcutData(t("labels.pasteStyles"), [getShortcutKey("CtrlOrCmd+Alt+V")]),
      createShortcutData(t("labels.sendToBack"), [
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+[")
          : getShortcutKey("CtrlOrCmd+Shift+["),
      ]),
      createShortcutData(t("labels.bringToFront"), [
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]"),
      ]),
      createShortcutData(t("labels.sendBackward"), [getShortcutKey("CtrlOrCmd+[")]),
      createShortcutData(t("labels.bringForward"), [getShortcutKey("CtrlOrCmd+]")]),
      createShortcutData(t("labels.alignTop"), [getShortcutKey("CtrlOrCmd+Shift+Up")]),
      createShortcutData(t("labels.alignBottom"), [getShortcutKey("CtrlOrCmd+Shift+Down")]),
      createShortcutData(t("labels.alignLeft"), [getShortcutKey("CtrlOrCmd+Shift+Left")]),
      createShortcutData(t("labels.alignRight"), [getShortcutKey("CtrlOrCmd+Shift+Right")]),
      createShortcutData(t("labels.duplicateSelection"), [
        getShortcutKey("CtrlOrCmd+D"),
        getShortcutKey(`Alt+${t("helpDialog.drag")}`),
      ]),
      createShortcutData(t("helpDialog.toggleElementLock"), [getShortcutKey("CtrlOrCmd+Shift+L")]),
      createShortcutData(t("buttons.undo"), [getShortcutKey("CtrlOrCmd+Z")]),
      createShortcutData(t("buttons.redo"),
        isWindows
          ? [
              getShortcutKey("CtrlOrCmd+Y"),
              getShortcutKey("CtrlOrCmd+Shift+Z"),
            ]
          : [getShortcutKey("CtrlOrCmd+Shift+Z")]),
      createShortcutData(t("labels.group"), [getShortcutKey("CtrlOrCmd+G")]),
      createShortcutData(t("labels.ungroup"), [getShortcutKey("CtrlOrCmd+Shift+G")]),
      createShortcutData(t("labels.flipHorizontal"), [getShortcutKey("Shift+H")]),
      createShortcutData(t("labels.flipVertical"), [getShortcutKey("Shift+V")]),
      createShortcutData(t("labels.showStroke"), [getShortcutKey("S")]),
      createShortcutData(t("labels.showBackground"), [getShortcutKey("G")]),
      createShortcutData(t("labels.showFonts"), [getShortcutKey("Shift+F")]),
      createShortcutData(t("labels.decreaseFontSize"), [getShortcutKey("CtrlOrCmd+Shift+<")]),
      createShortcutData(t("labels.increaseFontSize"), [getShortcutKey("CtrlOrCmd+Shift+>")]),
    ],
  },
];

// Render a shortcut from data
const renderShortcut = (data: ReturnType<typeof createShortcutData>) => (
  <Shortcut
    label={data.label}
    shortcuts={data.shortcuts}
    isOr={data.isOr ?? true}
  />
);

// Filter shortcut data based on search query
const filterShortcutData = (data: ReturnType<typeof createShortcutData>, query: string) => {
  if (!query.trim()) return true;

  const lowerQuery = query.toLowerCase();
  if (data.label.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  return data.shortcuts.some((shortcut) =>
    shortcut.toLowerCase().includes(lowerQuery)
  );
};

export const HelpDialog = ({ onClose }: { onClose?: () => void }) => {
  const actionManager = useExcalidrawActionManager();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input when Ctrl/Cmd+F is pressed while help dialog is open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        event.stopPropagation();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Focus search input on mount - after Dialog's autofocus logic
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const shortcutGroups = getShortcutGroups(t);

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
        autofocus={false}
      >
        <Header />
        {/* Search input for filtering shortcuts */}
        <div className="HelpDialog__search">
          <div className="HelpDialog__search-icon">{SearchIcon}</div>
          <input
            type="text"
            className="HelpDialog__search-input"
            placeholder={t("helpDialog.searchShortcuts")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={searchInputRef}
            aria-label={t("helpDialog.searchShortcuts")}
          />
        </div>
        <Section title={t("helpDialog.shortcuts")}>
          {shortcutGroups.map((group) => (
            <ShortcutIsland
              key={group.caption}
              className={group.className}
              caption={group.caption}
            >
              {group.shortcuts
                .filter((data) => filterShortcutData(data, searchQuery))
                .map((data) => renderShortcut(data))}
            </ShortcutIsland>
          ))}
        </Section>
      </Dialog>
    </>
  );
};

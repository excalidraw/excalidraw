import React from "react";

import {
  EVENT,
  KEYS,
  addEventListener,
  isDarwin,
  isFirefox,
  isWindows,
} from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import {
  buildSearchHaystack,
  normalizeSearchQuery,
} from "./CommandPalette/search";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { ExternalLinkIcon, GithubIcon, searchIcon, youtubeIcon } from "./icons";

import "./HelpDialog.scss";

import type { JSX } from "react";

type ShortcutData = {
  id: string;
  label: string;
  shortcuts: string[];
  isOr?: boolean;
  keywords?: string[];
  haystack: string;
};

type ShortcutIslandData = {
  id: string;
  caption: string;
  className?: string;
  shortcuts: ShortcutData[];
};

const shortcut = ({
  id,
  label,
  shortcuts,
  isOr,
  keywords,
}: Omit<ShortcutData, "haystack">): ShortcutData => ({
  id,
  label,
  shortcuts,
  isOr,
  keywords,
  haystack: buildSearchHaystack(label, shortcuts, keywords),
});

const shortcutMatchesSearch = (shortcut: ShortcutData, query: string) => {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return true;
  }

  const normalizedHaystack = normalizeSearchQuery(shortcut.haystack);

  return (
    normalizedHaystack.includes(normalizedQuery) ||
    normalizedHaystack
      .replace(/\+/g, "")
      .includes(normalizedQuery.replace(/\+/g, ""))
  );
};

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
  <div
    className={["HelpDialog__island", props.className]
      .filter(Boolean)
      .join(" ")}
  >
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

    return keys.map((key, index) => (
      <ShortcutKey key={`${key}-${index}`}>
        {upperCaseSingleChars(key)}
      </ShortcutKey>
    ));
  });

  return (
    <div className="HelpDialog__shortcut">
      <div>{label}</div>
      <div className="HelpDialog__key-container">
        {[...intersperse(splitShortcutKeys, isOr ? t("helpDialog.or") : null)]}
      </div>
    </div>
  );
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <kbd className="HelpDialog__key" {...props} />
);

const getShortcutIslands = (): ShortcutIslandData[] => [
  {
    id: "tools",
    caption: t("helpDialog.tools"),
    className: "HelpDialog__island--tools",
    shortcuts: [
      shortcut({ id: "hand", label: t("toolBar.hand"), shortcuts: [KEYS.H] }),
      shortcut({
        id: "selection",
        label: t("toolBar.selection"),
        shortcuts: [KEYS.V, KEYS["1"]],
      }),
      shortcut({
        id: "rectangle",
        label: t("toolBar.rectangle"),
        shortcuts: [KEYS.R, KEYS["2"]],
      }),
      shortcut({
        id: "diamond",
        label: t("toolBar.diamond"),
        shortcuts: [KEYS.D, KEYS["3"]],
      }),
      shortcut({
        id: "ellipse",
        label: t("toolBar.ellipse"),
        shortcuts: [KEYS.O, KEYS["4"]],
      }),
      shortcut({
        id: "arrow",
        label: t("toolBar.arrow"),
        shortcuts: [KEYS.A, KEYS["5"]],
      }),
      shortcut({
        id: "line",
        label: t("toolBar.line"),
        shortcuts: [KEYS.L, KEYS["6"]],
      }),
      shortcut({
        id: "freedraw",
        label: t("toolBar.freedraw"),
        shortcuts: [KEYS.P, KEYS["7"]],
      }),
      shortcut({
        id: "text",
        label: t("toolBar.text"),
        shortcuts: [KEYS.T, KEYS["8"]],
      }),
      shortcut({
        id: "image",
        label: t("toolBar.image"),
        shortcuts: [KEYS["9"]],
      }),
      shortcut({
        id: "eraser",
        label: t("toolBar.eraser"),
        shortcuts: [KEYS.E, KEYS["0"]],
      }),
      shortcut({ id: "frame", label: t("toolBar.frame"), shortcuts: [KEYS.F] }),
      shortcut({ id: "laser", label: t("toolBar.laser"), shortcuts: [KEYS.K] }),
      shortcut({
        id: "eyeDropper",
        label: t("labels.eyeDropper"),
        shortcuts: [KEYS.I, "Shift+S", "Shift+G"],
        keywords: ["color", "picker"],
      }),
      shortcut({
        id: "editLineArrowPoints",
        label: t("helpDialog.editLineArrowPoints"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Enter")],
        keywords: ["line", "arrow", "points"],
      }),
      shortcut({
        id: "editText",
        label: t("helpDialog.editText"),
        shortcuts: [getShortcutKey("Enter")],
        keywords: ["label"],
      }),
      shortcut({
        id: "textNewLine",
        label: t("helpDialog.textNewLine"),
        shortcuts: [getShortcutKey("Enter"), getShortcutKey("Shift+Enter")],
      }),
      shortcut({
        id: "textFinish",
        label: t("helpDialog.textFinish"),
        shortcuts: [getShortcutKey("Esc"), getShortcutKey("CtrlOrCmd+Enter")],
      }),
      shortcut({
        id: "curvedArrow",
        label: t("helpDialog.curvedArrow"),
        shortcuts: [
          "A",
          t("helpDialog.click"),
          t("helpDialog.click"),
          t("helpDialog.click"),
        ],
        isOr: false,
      }),
      shortcut({
        id: "curvedLine",
        label: t("helpDialog.curvedLine"),
        shortcuts: [
          "L",
          t("helpDialog.click"),
          t("helpDialog.click"),
          t("helpDialog.click"),
        ],
        isOr: false,
      }),
      shortcut({
        id: "cropStart",
        label: t("helpDialog.cropStart"),
        shortcuts: [t("helpDialog.doubleClick"), getShortcutKey("Enter")],
      }),
      shortcut({
        id: "cropFinish",
        label: t("helpDialog.cropFinish"),
        shortcuts: [getShortcutKey("Enter"), getShortcutKey("Escape")],
      }),
      shortcut({ id: "lock", label: t("toolBar.lock"), shortcuts: [KEYS.Q] }),
      shortcut({
        id: "preventBinding",
        label: t("helpDialog.preventBinding"),
        shortcuts: [getShortcutKey("CtrlOrCmd")],
        keywords: ["arrow"],
      }),
      shortcut({
        id: "link",
        label: t("toolBar.link"),
        shortcuts: [getShortcutKey("CtrlOrCmd+K")],
      }),
      shortcut({
        id: "convertElementType",
        label: t("toolBar.convertElementType"),
        shortcuts: ["Tab", "Shift+Tab"],
      }),
    ],
  },
  {
    id: "view",
    caption: t("helpDialog.view"),
    className: "HelpDialog__island--view",
    shortcuts: [
      shortcut({
        id: "zoomIn",
        label: t("buttons.zoomIn"),
        shortcuts: [getShortcutKey("CtrlOrCmd++")],
      }),
      shortcut({
        id: "zoomOut",
        label: t("buttons.zoomOut"),
        shortcuts: [getShortcutKey("CtrlOrCmd+-")],
      }),
      shortcut({
        id: "resetZoom",
        label: t("buttons.resetZoom"),
        shortcuts: [getShortcutKey("CtrlOrCmd+0")],
      }),
      shortcut({
        id: "zoomToFit",
        label: t("helpDialog.zoomToFit"),
        shortcuts: ["Shift+1"],
      }),
      shortcut({
        id: "zoomToSelection",
        label: t("helpDialog.zoomToSelection"),
        shortcuts: ["Shift+2"],
      }),
      shortcut({
        id: "movePageUpDown",
        label: t("helpDialog.movePageUpDown"),
        shortcuts: ["PgUp/PgDn"],
        keywords: ["page"],
      }),
      shortcut({
        id: "movePageLeftRight",
        label: t("helpDialog.movePageLeftRight"),
        shortcuts: ["Shift+PgUp/PgDn"],
        keywords: ["page"],
      }),
      shortcut({
        id: "zenMode",
        label: t("buttons.zenMode"),
        shortcuts: [getShortcutKey("Alt+Z")],
      }),
      shortcut({
        id: "objectsSnapMode",
        label: t("buttons.objectsSnapMode"),
        shortcuts: [getShortcutKey("Alt+S")],
      }),
      shortcut({
        id: "toggleGrid",
        label: t("labels.toggleGrid"),
        shortcuts: [getShortcutKey("CtrlOrCmd+'")],
      }),
      shortcut({
        id: "viewMode",
        label: t("labels.viewMode"),
        shortcuts: [getShortcutKey("Alt+R")],
      }),
      shortcut({
        id: "toggleTheme",
        label: t("labels.toggleTheme"),
        shortcuts: [getShortcutKey("Alt+Shift+D")],
        keywords: ["dark", "light", "mode"],
      }),
      shortcut({
        id: "stats",
        label: t("stats.fullTitle"),
        shortcuts: [getShortcutKey("Alt+/")],
      }),
      shortcut({
        id: "search",
        label: t("search.title"),
        shortcuts: [getShortcutFromShortcutName("searchMenu")],
        keywords: ["find"],
      }),
      shortcut({
        id: "commandPalette",
        label: t("commandPalette.title"),
        shortcuts: isFirefox
          ? [getShortcutFromShortcutName("commandPalette")]
          : [
              getShortcutFromShortcutName("commandPalette"),
              getShortcutFromShortcutName("commandPalette", 1),
            ],
        keywords: ["commands", "menu"],
      }),
    ],
  },
  {
    id: "editor",
    caption: t("helpDialog.editor"),
    className: "HelpDialog__island--editor",
    shortcuts: [
      shortcut({
        id: "createFlowchart",
        label: t("helpDialog.createFlowchart"),
        shortcuts: [getShortcutKey(`CtrlOrCmd+Arrow Key`)],
        keywords: ["flowchart"],
      }),
      shortcut({
        id: "navigateFlowchart",
        label: t("helpDialog.navigateFlowchart"),
        shortcuts: [getShortcutKey(`Alt+Arrow Key`)],
        keywords: ["flowchart"],
      }),
      shortcut({
        id: "moveCanvas",
        label: t("labels.moveCanvas"),
        shortcuts: [
          getShortcutKey(`Space+${t("helpDialog.drag")}`),
          getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
        ],
        keywords: ["pan"],
      }),
      shortcut({
        id: "clearCanvas",
        label: t("buttons.clearReset"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Delete")],
      }),
      shortcut({
        id: "delete",
        label: t("labels.delete"),
        shortcuts: [getShortcutKey("Delete")],
      }),
      shortcut({
        id: "cut",
        label: t("labels.cut"),
        shortcuts: [getShortcutKey("CtrlOrCmd+X")],
      }),
      shortcut({
        id: "copy",
        label: t("labels.copy"),
        shortcuts: [getShortcutKey("CtrlOrCmd+C")],
      }),
      shortcut({
        id: "paste",
        label: t("labels.paste"),
        shortcuts: [getShortcutKey("CtrlOrCmd+V")],
      }),
      shortcut({
        id: "pasteAsPlaintext",
        label: t("labels.pasteAsPlaintext"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+V")],
      }),
      shortcut({
        id: "selectAll",
        label: t("labels.selectAll"),
        shortcuts: [getShortcutKey("CtrlOrCmd+A")],
      }),
      shortcut({
        id: "multiSelect",
        label: t("labels.multiSelect"),
        shortcuts: [getShortcutKey(`Shift+${t("helpDialog.click")}`)],
      }),
      shortcut({
        id: "deepSelect",
        label: t("helpDialog.deepSelect"),
        shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)],
      }),
      shortcut({
        id: "deepBoxSelect",
        label: t("helpDialog.deepBoxSelect"),
        shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)],
      }),
      ...(probablySupportsClipboardBlob || isFirefox
        ? [
            shortcut({
              id: "copyAsPng",
              label: t("labels.copyAsPng"),
              shortcuts: [getShortcutKey("Shift+Alt+C")],
              keywords: ["clipboard", "image"],
            }),
          ]
        : []),
      shortcut({
        id: "copyStyles",
        label: t("labels.copyStyles"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Alt+C")],
      }),
      shortcut({
        id: "pasteStyles",
        label: t("labels.pasteStyles"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Alt+V")],
      }),
      shortcut({
        id: "sendToBack",
        label: t("labels.sendToBack"),
        shortcuts: [
          isDarwin
            ? getShortcutKey("CtrlOrCmd+Alt+[")
            : getShortcutKey("CtrlOrCmd+Shift+["),
        ],
        keywords: ["zindex", "layer"],
      }),
      shortcut({
        id: "bringToFront",
        label: t("labels.bringToFront"),
        shortcuts: [
          isDarwin
            ? getShortcutKey("CtrlOrCmd+Alt+]")
            : getShortcutKey("CtrlOrCmd+Shift+]"),
        ],
        keywords: ["zindex", "layer"],
      }),
      shortcut({
        id: "sendBackward",
        label: t("labels.sendBackward"),
        shortcuts: [getShortcutKey("CtrlOrCmd+[")],
        keywords: ["zindex", "layer"],
      }),
      shortcut({
        id: "bringForward",
        label: t("labels.bringForward"),
        shortcuts: [getShortcutKey("CtrlOrCmd+]")],
        keywords: ["zindex", "layer"],
      }),
      shortcut({
        id: "alignTop",
        label: t("labels.alignTop"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Up")],
      }),
      shortcut({
        id: "alignBottom",
        label: t("labels.alignBottom"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Down")],
      }),
      shortcut({
        id: "alignLeft",
        label: t("labels.alignLeft"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Left")],
      }),
      shortcut({
        id: "alignRight",
        label: t("labels.alignRight"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Right")],
      }),
      shortcut({
        id: "duplicateSelection",
        label: t("labels.duplicateSelection"),
        shortcuts: [
          getShortcutKey("CtrlOrCmd+D"),
          getShortcutKey(`Alt+${t("helpDialog.drag")}`),
        ],
      }),
      shortcut({
        id: "toggleElementLock",
        label: t("helpDialog.toggleElementLock"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+L")],
      }),
      shortcut({
        id: "undo",
        label: t("buttons.undo"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Z")],
      }),
      shortcut({
        id: "redo",
        label: t("buttons.redo"),
        shortcuts: isWindows
          ? [getShortcutKey("CtrlOrCmd+Y"), getShortcutKey("CtrlOrCmd+Shift+Z")]
          : [getShortcutKey("CtrlOrCmd+Shift+Z")],
      }),
      shortcut({
        id: "group",
        label: t("labels.group"),
        shortcuts: [getShortcutKey("CtrlOrCmd+G")],
      }),
      shortcut({
        id: "ungroup",
        label: t("labels.ungroup"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+G")],
      }),
      shortcut({
        id: "flipHorizontal",
        label: t("labels.flipHorizontal"),
        shortcuts: [getShortcutKey("Shift+H")],
      }),
      shortcut({
        id: "flipVertical",
        label: t("labels.flipVertical"),
        shortcuts: [getShortcutKey("Shift+V")],
      }),
      shortcut({
        id: "showStroke",
        label: t("labels.showStroke"),
        shortcuts: [getShortcutKey("S")],
      }),
      shortcut({
        id: "showBackground",
        label: t("labels.showBackground"),
        shortcuts: [getShortcutKey("G")],
      }),
      shortcut({
        id: "showFonts",
        label: t("labels.showFonts"),
        shortcuts: [getShortcutKey("Shift+F")],
        keywords: ["font", "family", "picker"],
      }),
      shortcut({
        id: "decreaseFontSize",
        label: t("labels.decreaseFontSize"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+<")],
        keywords: ["font"],
      }),
      shortcut({
        id: "increaseFontSize",
        label: t("labels.increaseFontSize"),
        shortcuts: [getShortcutKey("CtrlOrCmd+Shift+>")],
        keywords: ["font"],
      }),
    ],
  },
];

export const HelpDialog = ({ onClose }: { onClose?: () => void }) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  React.useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      if (event[KEYS.CTRL_OR_CMD] && event.key.toLocaleLowerCase() === KEYS.F) {
        event.preventDefault();
        event.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    return addEventListener(window, EVENT.KEYDOWN, eventHandler, {
      capture: true,
      passive: false,
    });
  }, []);

  const shortcutIslands = getShortcutIslands();
  const trimmedSearchQuery = searchQuery.trim();
  const filteredShortcutIslands = trimmedSearchQuery
    ? shortcutIslands
        .map((island) => ({
          ...island,
          shortcuts: island.shortcuts.filter((shortcut) =>
            shortcutMatchesSearch(shortcut, trimmedSearchQuery),
          ),
        }))
        .filter((island) => island.shortcuts.length > 0)
    : shortcutIslands;

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
      >
        <Header />
        <TextField
          className="HelpDialog__search"
          value={searchQuery}
          ref={searchInputRef}
          placeholder={t("commandPalette.search.placeholder")}
          icon={searchIcon}
          type="search"
          fullWidth
          onChange={setSearchQuery}
        />
        <Section title={t("helpDialog.shortcuts")}>
          {filteredShortcutIslands.length > 0 ? (
            filteredShortcutIslands.map((island) => (
              <ShortcutIsland
                key={island.id}
                className={island.className}
                caption={island.caption}
              >
                {island.shortcuts.map((shortcut) => (
                  <Shortcut key={shortcut.id} {...shortcut} />
                ))}
              </ShortcutIsland>
            ))
          ) : (
            <div className="HelpDialog__no-results">{t("search.noMatch")}</div>
          )}
        </Section>
      </Dialog>
    </>
  );
};

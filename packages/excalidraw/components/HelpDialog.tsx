import fuzzy from "fuzzy";
import React from "react";

import { isDarwin, isFirefox, isWindows } from "@excalidraw/common";

import { KEYS } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { deburr } from "../deburr";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { Dialog } from "./Dialog";
import { ExternalLinkIcon, GithubIcon, searchIcon, youtubeIcon } from "./icons";
import { TextField } from "./TextField";

import "./HelpDialog.scss";

import type { JSX } from "react";

type ShortcutConfig = {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
  keywords?: string[];
};

type ShortcutIslandConfig = {
  caption: string;
  className?: string;
  shortcuts: ShortcutConfig[];
};

type ShortcutSectionConfig = {
  title: string;
  islands: ShortcutIslandConfig[];
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
        {[...intersperse(splitShortcutKeys, isOr ? t("helpDialog.or") : null)]}
      </div>
    </div>
  );
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <kbd className="HelpDialog__key" {...props} />
);

export const HelpDialog = ({ onClose }: { onClose?: () => void }) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  React.useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (
        !event[KEYS.CTRL_OR_CMD] ||
        event.altKey ||
        event.key.toLowerCase() !== KEYS.F
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleFindShortcut, {
      capture: true,
    });

    return () =>
      window.removeEventListener("keydown", handleFindShortcut, {
        capture: true,
      });
  }, []);

  const shortcutSections: ShortcutSectionConfig[] = [
    {
      title: t("helpDialog.shortcuts"),
      islands: [
        {
          className: "HelpDialog__island--tools",
          caption: t("helpDialog.tools"),
          shortcuts: [
            { label: t("toolBar.hand"), shortcuts: [KEYS.H] },
            { label: t("toolBar.selection"), shortcuts: [KEYS.V, KEYS["1"]] },
            { label: t("toolBar.rectangle"), shortcuts: [KEYS.R, KEYS["2"]] },
            { label: t("toolBar.diamond"), shortcuts: [KEYS.D, KEYS["3"]] },
            { label: t("toolBar.ellipse"), shortcuts: [KEYS.O, KEYS["4"]] },
            { label: t("toolBar.arrow"), shortcuts: [KEYS.A, KEYS["5"]] },
            { label: t("toolBar.line"), shortcuts: [KEYS.L, KEYS["6"]] },
            {
              label: t("toolBar.freedraw"),
              shortcuts: [KEYS.P, KEYS["7"]],
              keywords: ["draw", "pen"],
            },
            { label: t("toolBar.text"), shortcuts: [KEYS.T, KEYS["8"]] },
            { label: t("toolBar.image"), shortcuts: [KEYS["9"]] },
            { label: t("toolBar.eraser"), shortcuts: [KEYS.E, KEYS["0"]] },
            { label: t("toolBar.frame"), shortcuts: [KEYS.F] },
            { label: t("toolBar.laser"), shortcuts: [KEYS.K] },
            {
              label: t("labels.eyeDropper"),
              shortcuts: [KEYS.I, "Shift+S", "Shift+G"],
              keywords: ["picker", "color"],
            },
            {
              label: t("helpDialog.editLineArrowPoints"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Enter")],
            },
            {
              label: t("helpDialog.editText"),
              shortcuts: [getShortcutKey("Enter")],
            },
            {
              label: t("helpDialog.textNewLine"),
              shortcuts: [
                getShortcutKey("Enter"),
                getShortcutKey("Shift+Enter"),
              ],
            },
            {
              label: t("helpDialog.textFinish"),
              shortcuts: [
                getShortcutKey("Esc"),
                getShortcutKey("CtrlOrCmd+Enter"),
              ],
            },
            {
              label: t("helpDialog.curvedArrow"),
              shortcuts: [
                "A",
                t("helpDialog.click"),
                t("helpDialog.click"),
                t("helpDialog.click"),
              ],
              isOr: false,
            },
            {
              label: t("helpDialog.curvedLine"),
              shortcuts: [
                "L",
                t("helpDialog.click"),
                t("helpDialog.click"),
                t("helpDialog.click"),
              ],
              isOr: false,
            },
            {
              label: t("helpDialog.cropStart"),
              shortcuts: [t("helpDialog.doubleClick"), getShortcutKey("Enter")],
            },
            {
              label: t("helpDialog.cropFinish"),
              shortcuts: [getShortcutKey("Enter"), getShortcutKey("Escape")],
            },
            { label: t("toolBar.lock"), shortcuts: [KEYS.Q] },
            {
              label: t("helpDialog.preventBinding"),
              shortcuts: [getShortcutKey("CtrlOrCmd")],
              keywords: ["bind"],
            },
            {
              label: t("toolBar.link"),
              shortcuts: [getShortcutKey("CtrlOrCmd+K")],
            },
            {
              label: t("toolBar.convertElementType"),
              shortcuts: ["Tab", "Shift+Tab"],
            },
          ],
        },
        {
          className: "HelpDialog__island--view",
          caption: t("helpDialog.view"),
          shortcuts: [
            {
              label: t("buttons.zoomIn"),
              shortcuts: [getShortcutKey("CtrlOrCmd++")],
            },
            {
              label: t("buttons.zoomOut"),
              shortcuts: [getShortcutKey("CtrlOrCmd+-")],
            },
            {
              label: t("buttons.resetZoom"),
              shortcuts: [getShortcutKey("CtrlOrCmd+0")],
            },
            { label: t("helpDialog.zoomToFit"), shortcuts: ["Shift+1"] },
            { label: t("helpDialog.zoomToSelection"), shortcuts: ["Shift+2"] },
            {
              label: t("helpDialog.movePageUpDown"),
              shortcuts: ["PgUp/PgDn"],
            },
            {
              label: t("helpDialog.movePageLeftRight"),
              shortcuts: ["Shift+PgUp/PgDn"],
            },
            {
              label: t("buttons.zenMode"),
              shortcuts: [getShortcutKey("Alt+Z")],
            },
            {
              label: t("buttons.objectsSnapMode"),
              shortcuts: [getShortcutKey("Alt+S")],
              keywords: ["snap"],
            },
            {
              label: t("labels.toggleGrid"),
              shortcuts: [getShortcutKey("CtrlOrCmd+'")],
              keywords: ["grid"],
            },
            {
              label: t("labels.viewMode"),
              shortcuts: [getShortcutKey("Alt+R")],
            },
            {
              label: t("labels.toggleTheme"),
              shortcuts: [getShortcutKey("Alt+Shift+D")],
              keywords: ["dark", "light"],
            },
            {
              label: t("stats.fullTitle"),
              shortcuts: [getShortcutKey("Alt+/")],
              keywords: ["stats"],
            },
            {
              label: t("search.title"),
              shortcuts: [getShortcutFromShortcutName("searchMenu")],
              keywords: ["find", "canvas"],
            },
            {
              label: t("commandPalette.title"),
              shortcuts: isFirefox
                ? [getShortcutFromShortcutName("commandPalette")]
                : [
                    getShortcutFromShortcutName("commandPalette"),
                    getShortcutFromShortcutName("commandPalette", 1),
                  ],
              keywords: ["commands", "actions"],
            },
          ],
        },
        {
          className: "HelpDialog__island--editor",
          caption: t("helpDialog.editor"),
          shortcuts: [
            {
              label: t("helpDialog.createFlowchart"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Arrow Key")],
              keywords: ["flowchart"],
            },
            {
              label: t("helpDialog.navigateFlowchart"),
              shortcuts: [getShortcutKey("Alt+Arrow Key")],
              keywords: ["flowchart"],
            },
            {
              label: t("labels.moveCanvas"),
              shortcuts: [
                getShortcutKey(`Space+${t("helpDialog.drag")}`),
                getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
              ],
              keywords: ["pan"],
            },
            {
              label: t("buttons.clearReset"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Delete")],
              keywords: ["clear", "reset"],
            },
            {
              label: t("labels.delete"),
              shortcuts: [getShortcutKey("Delete")],
            },
            {
              label: t("labels.cut"),
              shortcuts: [getShortcutKey("CtrlOrCmd+X")],
            },
            {
              label: t("labels.copy"),
              shortcuts: [getShortcutKey("CtrlOrCmd+C")],
            },
            {
              label: t("labels.paste"),
              shortcuts: [getShortcutKey("CtrlOrCmd+V")],
            },
            {
              label: t("labels.pasteAsPlaintext"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+V")],
              keywords: ["paste", "text"],
            },
            {
              label: t("labels.selectAll"),
              shortcuts: [getShortcutKey("CtrlOrCmd+A")],
            },
            {
              label: t("labels.multiSelect"),
              shortcuts: [getShortcutKey(`Shift+${t("helpDialog.click")}`)],
            },
            {
              label: t("helpDialog.deepSelect"),
              shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)],
            },
            {
              label: t("helpDialog.deepBoxSelect"),
              shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)],
            },
            ...(probablySupportsClipboardBlob || isFirefox
              ? [
                  {
                    label: t("labels.copyAsPng"),
                    shortcuts: [getShortcutKey("Shift+Alt+C")],
                    keywords: ["png", "clipboard"],
                  },
                ]
              : []),
            {
              label: t("labels.copyStyles"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Alt+C")],
              keywords: ["styles", "copy"],
            },
            {
              label: t("labels.pasteStyles"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Alt+V")],
              keywords: ["styles", "paste"],
            },
            {
              label: t("labels.sendToBack"),
              shortcuts: [
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+[")
                  : getShortcutKey("CtrlOrCmd+Shift+["),
              ],
              keywords: ["back", "layer", "z-index"],
            },
            {
              label: t("labels.bringToFront"),
              shortcuts: [
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+]")
                  : getShortcutKey("CtrlOrCmd+Shift+]"),
              ],
              keywords: ["front", "layer", "z-index"],
            },
            {
              label: t("labels.sendBackward"),
              shortcuts: [getShortcutKey("CtrlOrCmd+[")],
              keywords: ["backward", "layer", "z-index"],
            },
            {
              label: t("labels.bringForward"),
              shortcuts: [getShortcutKey("CtrlOrCmd+]")],
              keywords: ["forward", "layer", "z-index"],
            },
            {
              label: t("labels.alignTop"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Up")],
            },
            {
              label: t("labels.alignBottom"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Down")],
            },
            {
              label: t("labels.alignLeft"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Left")],
            },
            {
              label: t("labels.alignRight"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Right")],
            },
            {
              label: t("labels.duplicateSelection"),
              shortcuts: [
                getShortcutKey("CtrlOrCmd+D"),
                getShortcutKey(`Alt+${t("helpDialog.drag")}`),
              ],
              keywords: ["duplicate"],
            },
            {
              label: t("helpDialog.toggleElementLock"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+L")],
              keywords: ["lock"],
            },
            {
              label: t("buttons.undo"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Z")],
            },
            {
              label: t("buttons.redo"),
              shortcuts: isWindows
                ? [
                    getShortcutKey("CtrlOrCmd+Y"),
                    getShortcutKey("CtrlOrCmd+Shift+Z"),
                  ]
                : [getShortcutKey("CtrlOrCmd+Shift+Z")],
            },
            {
              label: t("labels.group"),
              shortcuts: [getShortcutKey("CtrlOrCmd+G")],
            },
            {
              label: t("labels.ungroup"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+G")],
            },
            {
              label: t("labels.flipHorizontal"),
              shortcuts: [getShortcutKey("Shift+H")],
            },
            {
              label: t("labels.flipVertical"),
              shortcuts: [getShortcutKey("Shift+V")],
            },
            {
              label: t("labels.showStroke"),
              shortcuts: [getShortcutKey("S")],
              keywords: ["stroke"],
            },
            {
              label: t("labels.showBackground"),
              shortcuts: [getShortcutKey("G")],
              keywords: ["background", "fill"],
            },
            {
              label: t("labels.showFonts"),
              shortcuts: [getShortcutKey("Shift+F")],
              keywords: ["font"],
            },
            {
              label: t("labels.decreaseFontSize"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+<")],
              keywords: ["font", "text"],
            },
            {
              label: t("labels.increaseFontSize"),
              shortcuts: [getShortcutKey("CtrlOrCmd+Shift+>")],
              keywords: ["font", "text"],
            },
          ],
        },
      ],
    },
  ];

  const filteredShortcutSections = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return shortcutSections;
    }

    const normalizedSearchQuery = deburr(
      searchQuery.toLocaleLowerCase().replace(/[<>_| -]/g, ""),
    );

    return shortcutSections
      .map((section) => ({
        ...section,
        islands: section.islands
          .map((island) => ({
            ...island,
            shortcuts: island.shortcuts.filter((shortcut) => {
              const haystack = deburr(
                `${shortcut.label.toLocaleLowerCase()} ${shortcut.shortcuts
                  .join(" ")
                  .toLocaleLowerCase()} ${(shortcut.keywords || []).join(
                  " ",
                )}`.replace(/[<>_| -]/g, ""),
              );

              return fuzzy.test(normalizedSearchQuery, haystack);
            }),
          }))
          .filter((island) => island.shortcuts.length > 0),
      }))
      .filter((section) => section.islands.length > 0);
  }, [searchQuery, shortcutSections]);

  return (
    <Dialog
      onCloseRequest={handleClose}
      title={t("helpDialog.title")}
      className={"HelpDialog"}
    >
      <Header />
      <div className="HelpDialog__search">
        <TextField
          ref={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("commandPalette.search.placeholder")}
          type="search"
          fullWidth
          icon={<div className="HelpDialog__search-icon">{searchIcon}</div>}
        />
      </div>
      {filteredShortcutSections.length ? (
        filteredShortcutSections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.islands.map((island) => (
              <ShortcutIsland
                key={island.caption}
                className={island.className}
                caption={island.caption}
              >
                {island.shortcuts.map((shortcut) => (
                  <Shortcut
                    key={`${shortcut.label}-${shortcut.shortcuts.join("-")}`}
                    label={shortcut.label}
                    shortcuts={shortcut.shortcuts}
                    isOr={shortcut.isOr}
                  />
                ))}
              </ShortcutIsland>
            ))}
          </Section>
        ))
      ) : (
        <div className="HelpDialog__empty">
          {t("commandPalette.search.noMatch")}
        </div>
      )}
    </Dialog>
  );
};

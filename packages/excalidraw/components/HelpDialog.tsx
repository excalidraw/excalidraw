import React, { useEffect, useRef, useState } from "react";

import { EVENT, isDarwin, isFirefox, isWindows } from "@excalidraw/common";

import { KEYS, getShortcutKey } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";

import { Dialog } from "./Dialog";
import { ExternalLinkIcon, GithubIcon, youtubeIcon } from "./icons";

import "./HelpDialog.scss";

import type { JSX } from "react";
import { TextField } from "./TextField";
import { useStableCallback } from "../hooks/useStableCallback";

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
  const handleClose = React.useCallback(() => {
    if (onClose) {
      setCommandSearch("");
      onClose();
    }
  }, [onClose]);

  const shortcutsData = [
    {
      category: "tools",
      caption: t("helpDialog.tools"),
      shortcuts: [
        {
          label: t("toolBar.hand"),
          shortcuts: [KEYS.H]
        },
        {
          label: t("toolBar.selection"),
          shortcuts: [KEYS.V, KEYS["1"]]
        },
        {
          label: t("toolBar.rectangle"),
          shortcuts: [KEYS.R, KEYS["2"]]
        },
        {
          label: t("toolBar.diamond"),
          shortcuts: [KEYS.D, KEYS["3"]]
        },
        {
          label: t("toolBar.ellipse"),
          shortcuts: [KEYS.O, KEYS["4"]]
        },
        {
          label: t("toolBar.arrow"),
          shortcuts: [KEYS.A, KEYS["5"]]
        },
        {
          label: t("toolBar.line"),
          shortcuts: [KEYS.L, KEYS["6"]]
        },
        {
          label: t("toolBar.freedraw"),
          shortcuts: [KEYS.P, KEYS["7"]]
        },
        {
          label: t("toolBar.text"),
          shortcuts: [KEYS.T, KEYS["8"]]
        },
        {
          label: t("toolBar.image"),
          shortcuts: [KEYS["9"]]
        },
        {
          label: t("toolBar.eraser"),
          shortcuts: [KEYS.E, KEYS["0"]]
        },
        {
          label: t("toolBar.frame"),
          shortcuts: [KEYS.F]
        },
        {
          label: t("toolBar.laser"),
          shortcuts: [KEYS.K]
        },
        {
          label: t("labels.eyeDropper"),
          shortcuts: [KEYS.I, "Shift+S", "Shift+G"]
        },
        {
          label: t("helpDialog.editLineArrowPoints"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Enter")]
        },
        {
          label: t("helpDialog.editText"),
          shortcuts: [getShortcutKey("Enter")]
        },
        {
          label: t("helpDialog.textNewLine"),
          shortcuts: [
            getShortcutKey("Enter"),
            getShortcutKey("Shift+Enter"),
          ]
        },
        {
          label: t("helpDialog.textFinish"),
          shortcuts: [
            getShortcutKey("Esc"),
            getShortcutKey("CtrlOrCmd+Enter"),
          ]
        },
        {
          label: t("helpDialog.curvedArrow"),
          shortcuts: [
            "A",
            t("helpDialog.click"),
            t("helpDialog.click"),
            t("helpDialog.click"),
          ],
          isOr: false
        },
        {
          label: t("helpDialog.curvedLine"),
          shortcuts: [
            "L",
            t("helpDialog.click"),
            t("helpDialog.click"),
            t("helpDialog.click"),
          ],
          isOr: false
        },
        {
          label: t("helpDialog.cropStart"),
          shortcuts: [t("helpDialog.doubleClick"), getShortcutKey("Enter")],
          isOr: true
        },
        {
          label: t("helpDialog.cropFinish"),
          shortcuts: [getShortcutKey("Enter"), getShortcutKey("Escape")],
          isOr: true
        },
        {
          label: t("toolBar.lock"),
          shortcuts: [KEYS.Q]
        },
        {
          label: t("helpDialog.preventBinding"),
          shortcuts: [getShortcutKey("CtrlOrCmd")]
        },
        {
          label: t("toolBar.link"),
          shortcuts: [getShortcutKey("CtrlOrCmd+K")]
        },
        {
          label: t("toolBar.convertElementType"),
          shortcuts: ["Tab", "Shift+Tab"],
          isOr: true
        }
      ]
    },
    {
      category: "view",
      caption: t("helpDialog.view"),
      shortcuts: [
        {
          label: t("buttons.zoomIn"),
          shortcuts: [getShortcutKey("CtrlOrCmd++")]
        },
        {
          label: t("buttons.zoomOut"),
          shortcuts: [getShortcutKey("CtrlOrCmd+-")]
        },
        {
          label: t("buttons.resetZoom"),
          shortcuts: [getShortcutKey("CtrlOrCmd+0")]
        },
        {
          label: t("helpDialog.zoomToFit"),
          shortcuts: ["Shift+1"]
        },
        {
          label: t("helpDialog.zoomToSelection"),
          shortcuts: ["Shift+2"]
        },
        {
          label: t("helpDialog.movePageUpDown"),
          shortcuts: ["PgUp/PgDn"]
        },
        {
          label: t("helpDialog.movePageLeftRight"),
          shortcuts: ["Shift+PgUp/PgDn"]
        },
        {
          label: t("buttons.zenMode"),
          shortcuts: [getShortcutKey("Alt+Z")]
        },
        {
          label: t("buttons.objectsSnapMode"),
          shortcuts: [getShortcutKey("Alt+S")]
        },
        {
          label: t("labels.toggleGrid"),
          shortcuts: [getShortcutKey("CtrlOrCmd+'")]
        },
        {
          label: t("labels.viewMode"),
          shortcuts: [getShortcutKey("Alt+R")]
        },
        {
          label: t("labels.toggleTheme"),
          shortcuts: [getShortcutKey("Alt+Shift+D")]
        },
        {
          label: t("stats.fullTitle"),
          shortcuts: [getShortcutKey("Alt+/")]
        },
        {
          label: t("search.title"),
          shortcuts: [getShortcutKey("Alt+/")]
        },
        {
          label: t("commandPalette.title"),
          shortcuts:
            isFirefox
              ? [getShortcutFromShortcutName("commandPalette")]
              : [
                getShortcutFromShortcutName("commandPalette"),
                getShortcutFromShortcutName("commandPalette", 1),
              ]
        }
      ]
    },
    {
      category: "editor",
      caption: t("helpDialog.editor"),
      shortcuts: [
        {
          label: t("helpDialog.createFlowchart"),
          shortcuts: [getShortcutKey(`CtrlOrCmd+Arrow Key`)],
          isOr: true
        },
        {
          label: t("helpDialog.navigateFlowchart"),
          shortcuts: [getShortcutKey(`Alt+Arrow Key`)],
          isOr: true
        },
        {
          label: t("labels.moveCanvas"),
          shortcuts: [
            getShortcutKey(`Space+${t("helpDialog.drag")}`),
            getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
          ],
          isOr: true
        },
        {
          label: t("buttons.clearReset"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Delete")]
        },
        {
          label: t("labels.delete"),
          shortcuts: [getShortcutKey("Delete")]
        },
        {
          label: t("labels.cut"),
          shortcuts: [getShortcutKey("CtrlOrCmd+X")]
        },
        {
          label: t("labels.copy"),
          shortcuts: [getShortcutKey("CtrlOrCmd+C")]
        },
        {
          label: t("labels.paste"),
          shortcuts: [getShortcutKey("CtrlOrCmd+V")]
        },
        {
          label: t("labels.pasteAsPlaintext"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+V")]
        },
        {
          label: t("labels.selectAll"),
          shortcuts: [getShortcutKey("CtrlOrCmd+A")]
        },
        {
          label: t("labels.multiSelect"),
          shortcuts: [getShortcutKey(`Shift+${t("helpDialog.click")}`)]
        },
        {
          label: t("helpDialog.deepSelect"),
          shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)]
        },
        {
          label: t("helpDialog.deepBoxSelect"),
          shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)]
        },
        (probablySupportsClipboardBlob || isFirefox) && {
          label: t("labels.copyAsPng"),
          shortcuts: [getShortcutKey("Shift+Alt+C")]
        },
        {
          label: t("labels.copyStyles"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Alt+C")]
        },
        {
          label: t("labels.pasteStyles"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Alt+V")]
        },
        {
          label: t("labels.sendToBack"),
          shortcuts: [
            isDarwin
              ? getShortcutKey("CtrlOrCmd+Alt+[")
              : getShortcutKey("CtrlOrCmd+Shift+["),
          ]
        },
        {
          label: t("labels.bringToFront"),
          shortcuts: [
            isDarwin
              ? getShortcutKey("CtrlOrCmd+Alt+]")
              : getShortcutKey("CtrlOrCmd+Shift+]"),
          ]
        },
        {
          label: t("labels.sendBackward"),
          shortcuts: [getShortcutKey("CtrlOrCmd+[")]
        },
        {
          label: t("labels.bringForward"),
          shortcuts: [getShortcutKey("CtrlOrCmd+]")]
        },
        {
          label: t("labels.alignTop"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Up")]
        },
        {
          label: t("labels.alignBottom"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Down")]
        },
        {
          label: t("labels.alignLeft"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Left")]
        },
        {
          label: t("labels.alignRight"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Right")]
        },
        {
          label: t("labels.duplicateSelection"),
          shortcuts: [
            getShortcutKey("CtrlOrCmd+D"),
            getShortcutKey(`Alt+${t("helpDialog.drag")}`),
          ]
        },
        {
          label: t("helpDialog.toggleElementLock"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+L")]
        },
        {
          label: t("buttons.undo"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Z")]
        },
        {
          label: t("buttons.redo"),
          shortcuts:
            isWindows
              ? [
                getShortcutKey("CtrlOrCmd+Y"),
                getShortcutKey("CtrlOrCmd+Shift+Z"),
              ]
              : [getShortcutKey("CtrlOrCmd+Shift+Z")]
        },
        {
          label: t("labels.group"),
          shortcuts: [getShortcutKey("CtrlOrCmd+G")]
        },
        {
          label: t("labels.ungroup"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+G")]
        },
        {
          label: t("labels.flipHorizontal"),
          shortcuts: [getShortcutKey("Shift+H")]
        },
        {
          label: t("labels.flipVertical"),
          shortcuts: [getShortcutKey("Shift+V")]
        },
        {
          label: t("labels.showStroke"),
          shortcuts: [getShortcutKey("S")]
        },
        {
          label: t("labels.showBackground"),
          shortcuts: [getShortcutKey("G")]
        },
        {
          label: t("labels.showFonts"),
          shortcuts: [getShortcutKey("Shift+F")]
        },
        {
          label: t("labels.decreaseFontSize"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+<")]
        },
        {
          label: t("labels.increaseFontSize"),
          shortcuts: [getShortcutKey("CtrlOrCmd+Shift+>")]
        }
      ]
    }
  ]


  const inputRef = useRef<HTMLInputElement>(null);
  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {


    // if alphanumeric keypress and we're not inside the input, focus it
    if (/^[a-zA-Z0-9]$/.test(event.key)) {
      event.stopPropagation();
      inputRef?.current?.focus();
      return;
    }

  });

  useEffect(() => {
    window.addEventListener(EVENT.KEYDOWN, handleKeyDown, {
      capture: true,
    });
    return () =>
      window.removeEventListener(EVENT.KEYDOWN, handleKeyDown, {
        capture: true,
      });
  }, [handleKeyDown]);

  const [commandSearch, setCommandSearch] = useState("");

  const filteredIslands = shortcutsData.flatMap((island) => {
    const filteredShortcuts = island.shortcuts.filter((shortcut) =>
      shortcut && shortcut.label.toLowerCase().includes(commandSearch.toLowerCase())
    );

    return filteredShortcuts.length > 0
      ? [{ ...island, shortcuts: filteredShortcuts }]
      : [];
  });



  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
      >
        <TextField
          value={commandSearch}
          placeholder={t("commandPalette.search.placeholder")}
          onChange={(value) => {
            setCommandSearch(value);
          }}
          selectOnRender
          ref={inputRef}
        />
        <Header />
        <Section title={t("helpDialog.shortcuts")}>
          {filteredIslands.map((island) => (
            <ShortcutIsland
              key={island.category}
              className={`HelpDialog__island--${island.category}`}
              caption={island.caption}
            >
              {island.shortcuts.map((shortcut, idx) => (shortcut &&
                <Shortcut key={idx} label={shortcut.label} shortcuts={shortcut.shortcuts} isOr={shortcut.isOr ?? true} />
              ))}
            </ShortcutIsland>
          ))}

        </Section>
      </Dialog>
    </>
  );
};

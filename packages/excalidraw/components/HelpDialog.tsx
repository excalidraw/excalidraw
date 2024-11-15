import React from "react";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { Dialog } from "./Dialog";
import { getShortcutKey } from "../utils";
import "./HelpDialog.scss";
import { ExternalLinkIcon, GithubIcon, youtubeIcon } from "./icons";
import { probablySupportsClipboardBlob } from "../clipboard";
import { isDarwin, isFirefox, isWindows } from "../constants";
import { getShortcutFromShortcutName } from "../actions/shortcuts";

const Header = () => (
  <div className="HelpDialog__header">
    <a
      className="HelpDialog__btn"
      href="https://docs.excalidraw.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
      {t("helpDialog.documentation")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://plus.excalidraw.com/blog"
      target="_blank"
      rel="noopener noreferrer"
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
      onClose();
    }
  }, [onClose]);

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
      >
        <Header />
        <Section title={t("helpDialog.shortcuts")}>
          <ShortcutIsland
            className="HelpDialog__island--tools"
            caption={t("helpDialog.tools")}
          >
            <Shortcut label={t("toolBar.hand")} shortcuts={[KEYS.H]} />
            <Shortcut
              label={t("toolBar.selection")}
              shortcuts={[KEYS.V, KEYS["1"]]}
            />
            <Shortcut
              label={t("toolBar.rectangle")}
              shortcuts={[KEYS.R, KEYS["2"]]}
            />
            <Shortcut
              label={t("toolBar.diamond")}
              shortcuts={[KEYS.D, KEYS["3"]]}
            />
            <Shortcut
              label={t("toolBar.ellipse")}
              shortcuts={[KEYS.O, KEYS["4"]]}
            />
            <Shortcut
              label={t("toolBar.arrow")}
              shortcuts={[KEYS.A, KEYS["5"]]}
            />
            <Shortcut
              label={t("toolBar.line")}
              shortcuts={[KEYS.L, KEYS["6"]]}
            />
            <Shortcut
              label={t("toolBar.freedraw")}
              shortcuts={[KEYS.P, KEYS["7"]]}
            />
            <Shortcut
              label={t("toolBar.text")}
              shortcuts={[KEYS.T, KEYS["8"]]}
            />
            <Shortcut label={t("toolBar.image")} shortcuts={[KEYS["9"]]} />
            <Shortcut
              label={t("toolBar.eraser")}
              shortcuts={[KEYS.E, KEYS["0"]]}
            />
            <Shortcut label={t("toolBar.frame")} shortcuts={[KEYS.F]} />
            <Shortcut label={t("toolBar.laser")} shortcuts={[KEYS.K]} />
            <Shortcut
              label={t("labels.eyeDropper")}
              shortcuts={[KEYS.I, "Shift+S", "Shift+G"]}
            />
            <Shortcut
              label={t("helpDialog.editLineArrowPoints")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Enter")]}
            />
            <Shortcut
              label={t("helpDialog.editText")}
              shortcuts={[getShortcutKey("Enter")]}
            />
            <Shortcut
              label={t("helpDialog.textNewLine")}
              shortcuts={[
                getShortcutKey("Enter"),
                getShortcutKey("Shift+Enter"),
              ]}
            />
            <Shortcut
              label={t("helpDialog.textFinish")}
              shortcuts={[
                getShortcutKey("Esc"),
                getShortcutKey("CtrlOrCmd+Enter"),
              ]}
            />
            <Shortcut
              label={t("helpDialog.curvedArrow")}
              shortcuts={[
                "A",
                t("helpDialog.click"),
                t("helpDialog.click"),
                t("helpDialog.click"),
              ]}
              isOr={false}
            />
            <Shortcut
              label={t("helpDialog.curvedLine")}
              shortcuts={[
                "L",
                t("helpDialog.click"),
                t("helpDialog.click"),
                t("helpDialog.click"),
              ]}
              isOr={false}
            />
            <Shortcut
              label={t("helpDialog.cropStart")}
              shortcuts={[t("helpDialog.doubleClick"), getShortcutKey("Enter")]}
              isOr={true}
            />
            <Shortcut
              label={t("helpDialog.cropFinish")}
              shortcuts={[getShortcutKey("Enter"), getShortcutKey("Escape")]}
              isOr={true}
            />
            <Shortcut label={t("toolBar.lock")} shortcuts={[KEYS.Q]} />
            <Shortcut
              label={t("helpDialog.preventBinding")}
              shortcuts={[getShortcutKey("CtrlOrCmd")]}
            />
            <Shortcut
              label={t("toolBar.link")}
              shortcuts={[getShortcutKey("CtrlOrCmd+K")]}
            />
          </ShortcutIsland>
          <ShortcutIsland
            className="HelpDialog__island--view"
            caption={t("helpDialog.view")}
          >
            <Shortcut
              label={t("buttons.zoomIn")}
              shortcuts={[getShortcutKey("CtrlOrCmd++")]}
            />
            <Shortcut
              label={t("buttons.zoomOut")}
              shortcuts={[getShortcutKey("CtrlOrCmd+-")]}
            />
            <Shortcut
              label={t("buttons.resetZoom")}
              shortcuts={[getShortcutKey("CtrlOrCmd+0")]}
            />
            <Shortcut
              label={t("helpDialog.zoomToFit")}
              shortcuts={["Shift+1"]}
            />
            <Shortcut
              label={t("helpDialog.zoomToSelection")}
              shortcuts={["Shift+2"]}
            />
            <Shortcut
              label={t("helpDialog.movePageUpDown")}
              shortcuts={["PgUp/PgDn"]}
            />
            <Shortcut
              label={t("helpDialog.movePageLeftRight")}
              shortcuts={["Shift+PgUp/PgDn"]}
            />
            <Shortcut
              label={t("buttons.zenMode")}
              shortcuts={[getShortcutKey("Alt+Z")]}
            />
            <Shortcut
              label={t("buttons.objectsSnapMode")}
              shortcuts={[getShortcutKey("Alt+S")]}
            />
            <Shortcut
              label={t("labels.toggleGrid")}
              shortcuts={[getShortcutKey("CtrlOrCmd+'")]}
            />
            <Shortcut
              label={t("labels.viewMode")}
              shortcuts={[getShortcutKey("Alt+R")]}
            />
            <Shortcut
              label={t("labels.toggleTheme")}
              shortcuts={[getShortcutKey("Alt+Shift+D")]}
            />
            <Shortcut
              label={t("stats.fullTitle")}
              shortcuts={[getShortcutKey("Alt+/")]}
            />
            <Shortcut
              label={t("search.title")}
              shortcuts={[getShortcutFromShortcutName("searchMenu")]}
            />
            <Shortcut
              label={t("commandPalette.title")}
              shortcuts={
                isFirefox
                  ? [getShortcutFromShortcutName("commandPalette")]
                  : [
                      getShortcutFromShortcutName("commandPalette"),
                      getShortcutFromShortcutName("commandPalette", 1),
                    ]
              }
            />
          </ShortcutIsland>
          <ShortcutIsland
            className="HelpDialog__island--editor"
            caption={t("helpDialog.editor")}
          >
            <Shortcut
              label={t("helpDialog.createFlowchart")}
              shortcuts={[getShortcutKey(`CtrlOrCmd+Arrow Key`)]}
              isOr={true}
            />
            <Shortcut
              label={t("helpDialog.navigateFlowchart")}
              shortcuts={[getShortcutKey(`Alt+Arrow Key`)]}
              isOr={true}
            />
            <Shortcut
              label={t("labels.moveCanvas")}
              shortcuts={[
                getShortcutKey(`Space+${t("helpDialog.drag")}`),
                getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
              ]}
              isOr={true}
            />
            <Shortcut
              label={t("buttons.clearReset")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Delete")]}
            />
            <Shortcut
              label={t("labels.delete")}
              shortcuts={[getShortcutKey("Delete")]}
            />
            <Shortcut
              label={t("labels.cut")}
              shortcuts={[getShortcutKey("CtrlOrCmd+X")]}
            />
            <Shortcut
              label={t("labels.copy")}
              shortcuts={[getShortcutKey("CtrlOrCmd+C")]}
            />
            <Shortcut
              label={t("labels.paste")}
              shortcuts={[getShortcutKey("CtrlOrCmd+V")]}
            />
            <Shortcut
              label={t("labels.pasteAsPlaintext")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+V")]}
            />
            <Shortcut
              label={t("labels.selectAll")}
              shortcuts={[getShortcutKey("CtrlOrCmd+A")]}
            />
            <Shortcut
              label={t("labels.multiSelect")}
              shortcuts={[getShortcutKey(`Shift+${t("helpDialog.click")}`)]}
            />
            <Shortcut
              label={t("helpDialog.deepSelect")}
              shortcuts={[getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)]}
            />
            <Shortcut
              label={t("helpDialog.deepBoxSelect")}
              shortcuts={[getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)]}
            />
            {/* firefox supports clipboard API under a flag, so we'll
                show users what they can do in the error message */}
            {(probablySupportsClipboardBlob || isFirefox) && (
              <Shortcut
                label={t("labels.copyAsPng")}
                shortcuts={[getShortcutKey("Shift+Alt+C")]}
              />
            )}
            <Shortcut
              label={t("labels.copyStyles")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Alt+C")]}
            />
            <Shortcut
              label={t("labels.pasteStyles")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Alt+V")]}
            />
            <Shortcut
              label={t("labels.sendToBack")}
              shortcuts={[
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+[")
                  : getShortcutKey("CtrlOrCmd+Shift+["),
              ]}
            />
            <Shortcut
              label={t("labels.bringToFront")}
              shortcuts={[
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+]")
                  : getShortcutKey("CtrlOrCmd+Shift+]"),
              ]}
            />
            <Shortcut
              label={t("labels.sendBackward")}
              shortcuts={[getShortcutKey("CtrlOrCmd+[")]}
            />
            <Shortcut
              label={t("labels.bringForward")}
              shortcuts={[getShortcutKey("CtrlOrCmd+]")]}
            />
            <Shortcut
              label={t("labels.alignTop")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+Up")]}
            />
            <Shortcut
              label={t("labels.alignBottom")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+Down")]}
            />
            <Shortcut
              label={t("labels.alignLeft")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+Left")]}
            />
            <Shortcut
              label={t("labels.alignRight")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+Right")]}
            />
            <Shortcut
              label={t("labels.duplicateSelection")}
              shortcuts={[
                getShortcutKey("CtrlOrCmd+D"),
                getShortcutKey(`Alt+${t("helpDialog.drag")}`),
              ]}
            />
            <Shortcut
              label={t("helpDialog.toggleElementLock")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+L")]}
            />
            <Shortcut
              label={t("buttons.undo")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Z")]}
            />
            <Shortcut
              label={t("buttons.redo")}
              shortcuts={
                isWindows
                  ? [
                      getShortcutKey("CtrlOrCmd+Y"),
                      getShortcutKey("CtrlOrCmd+Shift+Z"),
                    ]
                  : [getShortcutKey("CtrlOrCmd+Shift+Z")]
              }
            />
            <Shortcut
              label={t("labels.group")}
              shortcuts={[getShortcutKey("CtrlOrCmd+G")]}
            />
            <Shortcut
              label={t("labels.ungroup")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+G")]}
            />
            <Shortcut
              label={t("labels.flipHorizontal")}
              shortcuts={[getShortcutKey("Shift+H")]}
            />
            <Shortcut
              label={t("labels.flipVertical")}
              shortcuts={[getShortcutKey("Shift+V")]}
            />
            <Shortcut
              label={t("labels.showStroke")}
              shortcuts={[getShortcutKey("S")]}
            />
            <Shortcut
              label={t("labels.showBackground")}
              shortcuts={[getShortcutKey("G")]}
            />
            <Shortcut
              label={t("labels.showFonts")}
              shortcuts={[getShortcutKey("Shift+F")]}
            />
            <Shortcut
              label={t("labels.decreaseFontSize")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+<")]}
            />
            <Shortcut
              label={t("labels.increaseFontSize")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+>")]}
            />
          </ShortcutIsland>
        </Section>
      </Dialog>
    </>
  );
};

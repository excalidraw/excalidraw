import React from "react";
import { t } from "../i18n";
import { isDarwin } from "../keys";
import { Dialog } from "./Dialog";
import { getShortcutKey } from "../utils";
import "./ShortcutsDialog.scss";

const Columns = (props: { children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    }}
  >
    {props.children}
  </div>
);

const Column = (props: { children: React.ReactNode }) => (
  <div style={{ width: "49%" }}>{props.children}</div>
);

const ShortcutIsland = (props: {
  caption: string;
  children: React.ReactNode;
}) => (
  <div className="ShortcutsDialog-island">
    <h3 className="ShortcutsDialog-island-title">{props.caption}</h3>
    {props.children}
  </div>
);

const Shortcut = (props: {
  label: string;
  shortcuts: string[];
  isOr: boolean;
}) => {
  return (
    <div className="ShorcutsDialog-shortcut">
      <div
        style={{
          display: "flex",
          margin: "0",
          padding: "4px 8px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            lineHeight: 1.4,
          }}
        >
          {props.label}
        </div>
        <div
          style={{
            display: "flex",
            flex: "0 0 auto",
            justifyContent: "flex-end",
            marginInlineStart: "auto",
            minWidth: "30%",
          }}
        >
          {props.shortcuts.map((shortcut, index) => (
            <React.Fragment key={index}>
              <ShortcutKey>{shortcut}</ShortcutKey>
              {props.isOr &&
                index !== props.shortcuts.length - 1 &&
                t("shortcutsDialog.or")}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

Shortcut.defaultProps = {
  isOr: true,
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <span className="ShorcutsDialog-key" {...props} />
);

const Footer = () => (
  <div className="ShortcutsDialog-footer">
    <a
      href="https://blog.excalidraw.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("shortcutsDialog.blog")}
    </a>
    <a
      href="https://howto.excalidraw.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("shortcutsDialog.howto")}
    </a>
    <a
      href="https://github.com/excalidraw/excalidraw/issues"
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("shortcutsDialog.github")}
    </a>
  </div>
);

export const ShortcutsDialog = ({ onClose }: { onClose?: () => void }) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <>
      <Dialog onCloseRequest={handleClose} title={t("shortcutsDialog.title")}>
        <Columns>
          <Column>
            <ShortcutIsland caption={t("shortcutsDialog.shapes")}>
              <Shortcut label={t("toolBar.selection")} shortcuts={["V", "1"]} />
              <Shortcut label={t("toolBar.rectangle")} shortcuts={["R", "2"]} />
              <Shortcut label={t("toolBar.diamond")} shortcuts={["D", "3"]} />
              <Shortcut label={t("toolBar.ellipse")} shortcuts={["E", "4"]} />
              <Shortcut label={t("toolBar.arrow")} shortcuts={["A", "5"]} />
              <Shortcut label={t("toolBar.line")} shortcuts={["P", "6"]} />
              <Shortcut
                label={t("toolBar.draw")}
                shortcuts={["Shift+P", "7"]}
              />
              <Shortcut label={t("toolBar.text")} shortcuts={["T", "8"]} />
              <Shortcut
                label={t("shortcutsDialog.textNewLine")}
                shortcuts={[
                  getShortcutKey("Enter"),
                  getShortcutKey("Shift+Enter"),
                ]}
              />
              <Shortcut
                label={t("shortcutsDialog.textFinish")}
                shortcuts={[
                  getShortcutKey("Esc"),
                  getShortcutKey("CtrlOrCmd+Enter"),
                ]}
              />
              <Shortcut
                label={t("shortcutsDialog.curvedArrow")}
                shortcuts={[
                  "A",
                  t("shortcutsDialog.click"),
                  t("shortcutsDialog.click"),
                  t("shortcutsDialog.click"),
                ]}
                isOr={false}
              />
              <Shortcut
                label={t("shortcutsDialog.curvedLine")}
                shortcuts={[
                  "L",
                  t("shortcutsDialog.click"),
                  t("shortcutsDialog.click"),
                  t("shortcutsDialog.click"),
                ]}
                isOr={false}
              />
              <Shortcut label={t("toolBar.lock")} shortcuts={["Q"]} />
              <Shortcut
                label={t("shortcutsDialog.preventBinding")}
                shortcuts={[getShortcutKey("CtrlOrCmd")]}
              />
            </ShortcutIsland>
            <ShortcutIsland caption={t("shortcutsDialog.view")}>
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
                label={t("shortcutsDialog.zoomToFit")}
                shortcuts={["Shift+1"]}
              />
              <Shortcut
                label={t("shortcutsDialog.zoomToSelection")}
                shortcuts={["Shift+2"]}
              />
              <Shortcut label={t("buttons.fullScreen")} shortcuts={["F"]} />
              <Shortcut
                label={t("buttons.zenMode")}
                shortcuts={[getShortcutKey("Alt+Z")]}
              />
              <Shortcut
                label={t("labels.gridMode")}
                shortcuts={[getShortcutKey("CtrlOrCmd+'")]}
              />
            </ShortcutIsland>
          </Column>
          <Column>
            <ShortcutIsland caption={t("shortcutsDialog.editor")}>
              <Shortcut
                label={t("labels.selectAll")}
                shortcuts={[getShortcutKey("CtrlOrCmd+A")]}
              />
              <Shortcut
                label={t("labels.multiSelect")}
                shortcuts={[
                  getShortcutKey(`Shift+${t("shortcutsDialog.click")}`),
                ]}
              />
              <Shortcut
                label={t("labels.moveCanvas")}
                shortcuts={[
                  getShortcutKey(`Space+${t("shortcutsDialog.drag")}`),
                  getShortcutKey(`Wheel+${t("shortcutsDialog.drag")}`),
                ]}
                isOr={true}
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
                label={t("labels.copyAsPng")}
                shortcuts={[getShortcutKey("Shift+Alt+C")]}
              />
              <Shortcut
                label={t("labels.copyStyles")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Alt+C")]}
              />
              <Shortcut
                label={t("labels.pasteStyles")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Alt+V")]}
              />
              <Shortcut
                label={t("labels.delete")}
                shortcuts={[getShortcutKey("Del")]}
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
                  getShortcutKey(`Alt+${t("shortcutsDialog.drag")}`),
                ]}
              />
              <Shortcut
                label={t("buttons.undo")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Z")]}
              />
              <Shortcut
                label={t("buttons.redo")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Shift+Z")]}
              />
              <Shortcut
                label={t("labels.group")}
                shortcuts={[getShortcutKey("CtrlOrCmd+G")]}
              />
              <Shortcut
                label={t("labels.ungroup")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Shift+G")]}
              />
            </ShortcutIsland>
          </Column>
        </Columns>
        <Footer />
      </Dialog>
    </>
  );
};

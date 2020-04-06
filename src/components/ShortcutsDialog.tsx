import React from "react";
import { t } from "../i18n";
import { isDarwin } from "../keys";
import { Dialog } from "./Dialog";
import { getShortcutKey } from "../utils";

const ShortcutIsland = (props: {
  title: string;
  children: React.ReactNode;
}) => (
  <div
    style={{
      width: "49%",
      border: "1px solid #ced4da",
      marginBottom: "16px",
    }}
    {...props}
  >
    <h3
      style={{
        margin: "0",
        padding: "4px",
        backgroundColor: "#e9ecef",
        textAlign: "center",
      }}
    >
      {props.title}
    </h3>
    {props.children}
  </div>
);

const Shortcut = (props: { title: string; shortcuts: string[] }) => (
  <div
    style={{
      borderTop: "1px solid #ced4da",
    }}
    {...props}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        margin: "0",
        padding: "4px",
        alignItems: "center",
      }}
    >
      <div
        style={{
          flexBasis: 0,
          flexGrow: 2,
          lineHeight: 1.4,
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          display: "flex",
          flexBasis: 0,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        {props.shortcuts.map((shortcut) => (
          <ShortcutKey>{shortcut}</ShortcutKey>
        ))}
      </div>
    </div>
  </div>
);

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <span
    style={{
      border: "1px solid #ced4da",
      padding: "2px 8px",
      margin: "0 8px",
      backgroundColor: "#e9ecef",
      borderRadius: "2px",
      fontSize: "0.8em",
    }}
    {...props}
  />
);

const Footer = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      borderTop: "1px solid #ced4da",
      marginTop: 8,
      paddingTop: 16,
    }}
  >
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
      <Dialog
        maxWidth={800}
        onCloseRequest={handleClose}
        title={t("shortcutsDialog.title")}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <ShortcutIsland title={t("shortcutsDialog.shapes")}>
            <Shortcut title={t("toolBar.selection")} shortcuts={["S", "1"]} />
            <Shortcut title={t("toolBar.rectangle")} shortcuts={["R", "2"]} />
            <Shortcut title={t("toolBar.diamond")} shortcuts={["D", "3"]} />
            <Shortcut title={t("toolBar.ellipse")} shortcuts={["E", "4"]} />
            <Shortcut title={t("toolBar.arrow")} shortcuts={["A", "5"]} />
            <Shortcut title={t("toolBar.line")} shortcuts={["L", "6"]} />
            <Shortcut title={t("toolBar.text")} shortcuts={["T", "7"]} />
            <Shortcut title={t("toolBar.lock")} shortcuts={["Q"]} />
          </ShortcutIsland>
          <ShortcutIsland title={t("shortcutsDialog.editor")}>
            <Shortcut
              title={t("labels.copy")}
              shortcuts={[getShortcutKey("CtrlOrCmd+C", "")]}
            />
            <Shortcut
              title={t("labels.paste")}
              shortcuts={[getShortcutKey("CtrlOrCmd+V", "")]}
            />
            <Shortcut
              title={t("labels.copyAsPng")}
              shortcuts={[getShortcutKey("Shift+Alt+C", "")]}
            />
            <Shortcut
              title={t("labels.copyStyles")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+C", "")]}
            />
            <Shortcut
              title={t("labels.pasteStyles")}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+V", "")]}
            />
            <Shortcut
              title={t("labels.delete")}
              shortcuts={[getShortcutKey("Del", "")]}
            />
            <Shortcut
              title={t("labels.sendToBack")}
              shortcuts={[
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+[", "")
                  : getShortcutKey("CtrlOrCmd+Shift+[", ""),
              ]}
            />
            <Shortcut
              title={t("labels.bringToFront")}
              shortcuts={[
                isDarwin
                  ? getShortcutKey("CtrlOrCmd+Alt+]", "")
                  : getShortcutKey("CtrlOrCmd+Shift+]", ""),
              ]}
            />
            <Shortcut
              title={t("labels.sendBackward")}
              shortcuts={[getShortcutKey("CtrlOrCmd+[", "")]}
            />
            <Shortcut
              title={t("labels.bringForward")}
              shortcuts={[getShortcutKey("CtrlOrCmd+]", "")]}
            />
            <Shortcut
              title={t("labels.duplicateSelection")}
              shortcuts={[getShortcutKey("CtrlOrCmd+D", "")]}
            />
          </ShortcutIsland>
          <ShortcutIsland title={t("shortcutsDialog.view")}>
            <Shortcut
              title={t("buttons.zoomIn")}
              shortcuts={[getShortcutKey("CtrlOrCmd++", "")]}
            />
            <Shortcut
              title={t("buttons.zoomOut")}
              shortcuts={[getShortcutKey("CtrlOrCmd+-", "")]}
            />
            <Shortcut
              title={t("buttons.resetZoom")}
              shortcuts={[getShortcutKey("CtrlOrCmd+0", "")]}
            />
            <Shortcut title={t("buttons.toggleFullScreen")} shortcuts={["F"]} />
          </ShortcutIsland>
        </div>
        <Footer />
      </Dialog>
    </>
  );
};

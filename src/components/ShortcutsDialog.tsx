import React from "react";
import { t } from "../i18n";

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
        padding: "8px 4px",
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
      fontSize: "0.9em",
    }}
    {...props}
  />
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
          <ShortcutIsland title={"Shapes"}>
            <Shortcut title={t("toolBar.selection")} shortcuts={["S", "1"]} />
            <Shortcut title={t("toolBar.rectangle")} shortcuts={["R", "2"]} />
            <Shortcut title={t("toolBar.diamond")} shortcuts={["D", "3"]} />
            <Shortcut title={t("toolBar.ellipse")} shortcuts={["E", "4"]} />
            <Shortcut title={t("toolBar.arrow")} shortcuts={["A", "5"]} />
            <Shortcut title={t("toolBar.line")} shortcuts={["L", "6"]} />
            <Shortcut title={t("toolBar.text")} shortcuts={["T", "7"]} />
            <Shortcut title={t("toolBar.lock")} shortcuts={["Q"]} />
          </ShortcutIsland>
          <ShortcutIsland title={"Editor"}>
            <Shortcut
              title={"Copy"}
              shortcuts={[getShortcutKey("CtrlOrCmd+C", "")]}
            />
            <Shortcut
              title={"Paste"}
              shortcuts={[getShortcutKey("CtrlOrCmd+V", "")]}
            />
            <Shortcut
              title={"Copy to clipboard as PNG"}
              shortcuts={[getShortcutKey("Shift+Alt+C", "")]}
            />
            <Shortcut
              title={"Copy styles"}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+C", "")]}
            />
            <Shortcut
              title={"Paste styles"}
              shortcuts={[getShortcutKey("CtrlOrCmd+Shift+V", "")]}
            />
            <Shortcut
              title={"Delete"}
              shortcuts={[getShortcutKey("Del", "")]}
            />
            <Shortcut
              title={"Send to back"}
              shortcuts={[getShortcutKey("CtrlOrCmd+Alt+[", "")]}
            />
            <Shortcut
              title={"Bring to front"}
              shortcuts={[getShortcutKey("CtrlOrCmd+Alt+]", "")]}
            />
            <Shortcut
              title={"Send backwards"}
              shortcuts={[getShortcutKey("CtrlOrCmd+[", "")]}
            />
            <Shortcut
              title={"Bring forward"}
              shortcuts={[getShortcutKey("CtrlOrCmd+]", "")]}
            />
            <Shortcut
              title={"Duplicate selected element(s)"}
              shortcuts={[getShortcutKey("CtrlOrCmd+D", "")]}
            />
          </ShortcutIsland>
          <ShortcutIsland title={"View"}>
            <Shortcut
              title={"Zoom in"}
              shortcuts={[getShortcutKey("CtrlOrCmd++", "")]}
            />
            <Shortcut
              title={"Zoom out"}
              shortcuts={[getShortcutKey("CtrlOrCmd+-", "")]}
            />
            <Shortcut
              title={"Zoom reset"}
              shortcuts={[getShortcutKey("CtrlOrCmd+0", "")]}
            />
            <Shortcut
              title={"Toggle full screen"}
              shortcuts={[getShortcutKey("F", "")]}
            />
          </ShortcutIsland>
        </div>
      </Dialog>
    </>
  );
};

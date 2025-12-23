import clsx from "clsx";
import React from "react";
import { SelectionIcon, LibraryIcon } from "./icons";
import { t } from "../i18n";
import type { AppMode } from "../types";

import "./ToolIcon.scss";

type ModeToggleProps = {
    mode: AppMode;
    onChange: (mode: AppMode) => void;
    isMobile?: boolean;
};

export const ModeToggle = ({ mode, onChange, isMobile }: ModeToggleProps) => {
    return (
        <div
            className={clsx("ToolIcon ToolIcon__mode-toggle", {
                "is-mobile": isMobile,
            })}
            style={{ display: "flex", gap: "4px" }}
        >
            <button
                type="button"
                className={clsx("ToolIcon_type_button", {
                    "is-active": mode === "whiteboard",
                })}
                onClick={() => onChange("whiteboard")}
                title={t("labels.whiteboardMode" as any) || "Whiteboard Mode"}
                aria-label={t("labels.whiteboardMode" as any) || "Whiteboard Mode"}
            >
                <div className="ToolIcon__icon">{SelectionIcon}</div>
            </button>
            <button
                type="button"
                className={clsx("ToolIcon_type_button", {
                    "is-active": mode === "notes",
                })}
                onClick={() => onChange("notes")}
                title={t("labels.notesMode" as any) || "Notes Mode"}
                aria-label={t("labels.notesMode" as any) || "Notes Mode"}
            >
                <div className="ToolIcon__icon">{LibraryIcon}</div>
            </button>
        </div>
    );
};

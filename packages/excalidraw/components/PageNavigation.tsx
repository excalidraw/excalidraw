import React from "react";
import { useExcalidrawAppState, useApp } from "./App";
import { Island } from "./Island";
import Stack from "./Stack";
import { t } from "../i18n";
import { PlusIcon } from "./icons";
import "./PageNavigation.scss";

export const PageNavigation = () => {
    const appState = useExcalidrawAppState();
    const app = useApp();

    if (appState.mode !== "notes") {
        return null;
    }

    const { currentPage, numPages } = appState;

    return (
        <Island padding={1} className="PageNavigation">
            <Stack.Row gap={2} align="center">
                <button
                    type="button"
                    className="ToolIcon_type_button"
                    onClick={() => app.goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    title={t("labels.previousPage" as any) || "Previous Page"}
                >
                    <div className="ToolIcon__icon">{"<"}</div>
                </button>

                <div className="PageNavigation__display">
                    {t("labels.page" as any) || "Page"} {currentPage + 1} / {numPages}
                </div>

                <button
                    type="button"
                    className="ToolIcon_type_button"
                    onClick={() => app.goToPage(currentPage + 1)}
                    disabled={currentPage === numPages - 1}
                    title={t("labels.nextPage" as any) || "Next Page"}
                >
                    <div className="ToolIcon__icon">{">"}</div>
                </button>

                <div className="PageNavigation__divider" />

                <button
                    type="button"
                    className="ToolIcon_type_button ToolIcon__add-page"
                    onClick={() => app.addPage()}
                    title={t("labels.addPage" as any) || "Add Page"}
                >
                    <div className="ToolIcon__icon">{PlusIcon}</div>
                </button>

                <button
                    type="button"
                    className="ToolIcon_type_button ToolIcon__delete-page"
                    onClick={() => app.deletePage(currentPage)}
                    disabled={numPages <= 1}
                    title={t("labels.deletePage" as any) || "Delete Page"}
                >
                    <div className="ToolIcon__icon">🗑</div>
                </button>
            </Stack.Row>
        </Island>
    );
};

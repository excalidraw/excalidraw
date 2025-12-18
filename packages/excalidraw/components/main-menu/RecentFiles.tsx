import React, { useEffect, useState } from "react";
import { getRecentFiles, getRecentFileHandle, RecentFileMetadata } from "../../data/recentFiles";
import { useExcalidrawActionManager } from "../App";
import { actionLoadRecentFile } from "../../actions/actionLoadRecentFile";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import { LoadIcon } from "../icons";
import { t } from "../../i18n";

export const RecentFiles = () => {
    const [recentFiles, setRecentFiles] = useState<RecentFileMetadata[]>([]);
    const actionManager = useExcalidrawActionManager();

    useEffect(() => {
        const loadFiles = () => setRecentFiles(getRecentFiles());
        loadFiles();

        window.addEventListener("storage", loadFiles);
        // Also refresh on focus/interval as fallback for cross-component updates within same tab
        const interval = setInterval(loadFiles, 2000);

        return () => {
            window.removeEventListener("storage", loadFiles);
            clearInterval(interval);
        };
    }, []);

    if (recentFiles.length === 0) {
        return null;
    }

    return (
        <>
            <div style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                color: "var(--color-gray-50)",
                fontWeight: "bold",
                textTransform: "uppercase"
            }}>
                {t("labels.recentFiles")}
            </div>
            {recentFiles.map((file) => (
                <DropdownMenuItem
                    key={file.id}
                    icon={LoadIcon}
                    onSelect={async () => {
                        const handle = await getRecentFileHandle(file.id);
                        if (handle) {
                            actionManager.executeAction(actionLoadRecentFile as any, "ui", { handle });
                        } else {
                            // Handle might be lost or missing
                            console.warn("Handle not found for", file.name);
                        }
                    }}
                >
                    {file.name}
                </DropdownMenuItem>
            ))}
        </>
    );
};

RecentFiles.displayName = "RecentFiles";

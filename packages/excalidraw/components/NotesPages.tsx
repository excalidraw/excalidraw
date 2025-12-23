import React from "react";
import clsx from "clsx";
import type { AppState } from "../types";

type NotesPagesProps = {
    appState: AppState;
};

export const NotesPages = ({ appState }: NotesPagesProps) => {
    if (appState.mode !== "notes") {
        return null;
    }

    const { zoom, scrollX, scrollY, offsetLeft, offsetTop, currentPage } = appState;

    // A4 dimensions at 72 DPI (standard for web)
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const PAGE_GAP = 40;

    // Scene coordinates for the current page
    const sceneX = currentPage * (PAGE_WIDTH + PAGE_GAP);
    const sceneY = 0;

    // Convert scene coordinates to viewport coordinates
    const viewportX = (sceneX + scrollX) * zoom.value + offsetLeft;
    const viewportY = (sceneY + scrollY) * zoom.value + offsetTop;

    return (
        <div className="notes-pages-container" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div
                className="notes-page is-current"
                style={{
                    position: "absolute",
                    width: PAGE_WIDTH * zoom.value,
                    height: PAGE_HEIGHT * zoom.value,
                    left: viewportX,
                    top: viewportY,
                    backgroundColor: "white",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
                    backgroundImage: `linear-gradient(#e9e9e9 1px, transparent 1px)`,
                    backgroundSize: `100% ${30 * zoom.value}px`,
                    pointerEvents: "none",
                    zIndex: 0,
                    border: "2px solid #339af0",
                    borderRadius: "4px",
                    transition: "box-shadow 0.3s ease, border 0.3s ease",
                    opacity: 1,
                }}
            >
                {/* Margin line for that classic notebook look */}
                <div style={{
                    position: "absolute",
                    left: 60 * zoom.value,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    borderLeft: `${1 * zoom.value}px solid #ffc1c1`,
                }} />

                {/* Page number indicator */}
                <div style={{
                    position: "absolute",
                    bottom: 20 * zoom.value,
                    right: 20 * zoom.value,
                    fontSize: `${14 * zoom.value}px`,
                    color: "#adb5bd",
                    fontWeight: "bold",
                }}>
                    {currentPage + 1}
                </div>
            </div>
        </div>
    );
};

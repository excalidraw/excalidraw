import React from "react";
import type { AppState } from "../types";

type NotesPagesProps = {
    appState: AppState;
};

export const NotesPages = ({ appState }: NotesPagesProps) => {
    if (appState.mode !== "notes") {
        return null;
    }

    const { zoom, scrollX, scrollY, width, height, offsetLeft, offsetTop } = appState;

    // A4 dimensions at 72 DPI (standard for web)
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const PAGE_GAP = 20;

    // For POC, we'll render a fixed number of pages (e.g., 10)
    // In a real implementation, this would be dynamic based on elements
    const numPages = 10;

    const pages = [];
    for (let i = 0; i < numPages; i++) {
        // Scene coordinates (same as elements)
        const sceneX = -PAGE_WIDTH / 2;
        const sceneY = (PAGE_HEIGHT + PAGE_GAP) * i;

        // Convert scene coordinates to viewport coordinates
        // This calculates exactly where the page should be drawn on the screen
        // Formula matches sceneCoordsToViewportCoords from @excalidraw/common
        const viewportX = (sceneX + scrollX) * zoom.value + offsetLeft;
        const viewportY = (sceneY + scrollY) * zoom.value + offsetTop;

        pages.push(
            <div
                key={i}
                className="notes-page"
                style={{
                    position: "absolute",
                    width: PAGE_WIDTH * zoom.value,
                    height: PAGE_HEIGHT * zoom.value,
                    left: viewportX,
                    top: viewportY,
                    backgroundColor: "white",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                    backgroundImage: `linear-gradient(#e9e9e9 1px, transparent 1px)`,
                    backgroundSize: `100% ${30 * zoom.value}px`,
                    pointerEvents: "none",
                    zIndex: 0,
                    border: "1px solid #dee2e6",
                    borderRadius: "2px",
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
            </div>
        );
    }

    return <div className="notes-pages-container" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{pages}</div>;
};

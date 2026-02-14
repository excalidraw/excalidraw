import React, { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { t } from "../i18n";
import { useUIAppState } from "../context/ui-appState";
import { useExcalidrawSetAppState } from "./App";
import type { AppClassProperties, BinaryFiles } from "../types";
import type { NonDeletedExcalidrawElement, ExcalidrawFrameLikeElement } from "@excalidraw/element/types";
import { isFrameLikeElement, getFrameLikeTitle } from "@excalidraw/element";
import { ToolButton } from "./ToolButton";
import { PlusIcon, PlayIcon, DraggableIcon, TrashIcon, presentationIcon, DotsIcon, ExportIcon } from "./icons";
import { exportToCanvas } from "../scene/export";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import clsx from "clsx";
import "./PresentationMenu.scss";

interface PresentationMenuProps {
    app: AppClassProperties;
    elements: readonly NonDeletedExcalidrawElement[];
}

const PresentationMenuSlide = ({
    frame,
    index,
    elements,
    appState,
    files,
    onClick,
    onDragStart,
    onDragOver,
    onDrop,
}: {
    frame: ExcalidrawFrameLikeElement;
    index: number;
    elements: readonly NonDeletedExcalidrawElement[];
    appState: any;
    files: BinaryFiles;
    onClick: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isUnmounted = useRef(false);

    useEffect(() => {
        isUnmounted.current = false;
        const generatePreview = async () => {
            try {
                const canvas = await exportToCanvas(elements, appState, files, {
                    exportBackground: true,
                    viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
                    exportingFrame: frame,
                });

                if (!isUnmounted.current) {
                    setPreviewUrl(canvas.toDataURL());
                }
            } catch (e) {
                console.error("Failed to generate preview for frame", frame.id, e);
            }
        };

        generatePreview();

        return () => {
            isUnmounted.current = true;
        };
    }, [frame, elements, appState, files]);

    return (
        <div
            className="PresentationMenu__slide-item"
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={onClick}
        >
            <div className="PresentationMenu__slide-preview">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={getFrameLikeTitle(frame)}
                        className="PresentationMenu__slide-preview-img"
                    />
                ) : (
                    <div className="PresentationMenu__slide-preview-placeholder" />
                )}
            </div>
        </div>
    );
};

export const PresentationMenu = ({ app, elements }: PresentationMenuProps) => {
    const appState = useUIAppState();
    const setAppState = useExcalidrawSetAppState();
    // @ts-ignore
    const files = app.files || {};

    // Filter frames
    const frames = useMemo(() => {
        return elements.filter((element): element is ExcalidrawFrameLikeElement =>
            isFrameLikeElement(element)
        );
    }, [elements]);

    // Derived sorted frames based on presentationSlideOrder or default sort
    const sortedFrames = useMemo(() => {
        if (appState.presentationSlideOrder) {
            // Create a map for O(1) lookup
            const frameMap = new Map(frames.map((f) => [f.id, f]));
            // Map order to frames, filtering out missing ones
            const ordered = appState.presentationSlideOrder
                .map((id) => frameMap.get(id))
                .filter((f): f is ExcalidrawFrameLikeElement => !!f);

            // Add any new frames that aren't in the order yet order
            const orderedIds = new Set(ordered.map(f => f.id));
            const remaining = frames.filter(f => !orderedIds.has(f.id));
            // Sort remaining by position
            remaining.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 50) return a.y - b.y;
                return a.x - b.x;
            });

            return [...ordered, ...remaining];
        }

        // Default sort: Top-down, then Left-right
        return [...frames].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 50) return a.y - b.y;
            return a.x - b.x;
        });
    }, [frames, appState.presentationSlideOrder]);

    // Sync order to state if not set or if frames changed significantly
    useEffect(() => {
        const currentOrder = appState.presentationSlideOrder;
        const newOrder = sortedFrames.map((f) => f.id);

        const isSame = currentOrder && currentOrder.length === newOrder.length && currentOrder.every((id, i) => id === newOrder[i]);
        if (!isSame) {
            setAppState({ presentationSlideOrder: newOrder });
        }
    }, [frames.length, appState.presentationSlideOrder, setAppState, sortedFrames]);


    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData("text/plain", index.toString());
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndexStr = e.dataTransfer.getData("text/plain");
        const dragIndex = parseInt(dragIndexStr, 10);

        if (dragIndex === dropIndex) return;

        const newOrder = [...sortedFrames];
        const [removed] = newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, removed);

        setAppState({ presentationSlideOrder: newOrder.map(f => f.id) });
    };

    const createSlide = () => {
        // Select frame tool
        app.setActiveTool({ type: "frame" });
        setAppState({ openSidebar: null }); // Close sidebar to let user draw
    };

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="PresentationMenu">
            <div className="PresentationMenu__header">
                <h2 className="PresentationMenu__title">Presentation</h2>
                <div className="PresentationMenu__header-actions">
                    <ToolButton
                        type="button"
                        icon={PlusIcon}
                        title="Create slide"
                        aria-label="Create slide"
                        onClick={createSlide}
                        className="PresentationMenu__create-btn"
                    />
                    <DropdownMenu open={isMenuOpen}>
                        <DropdownMenu.Trigger
                            onToggle={() => setIsMenuOpen(!isMenuOpen)}
                            title="More"
                        >
                            {DotsIcon}
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                            onClickOutside={() => setIsMenuOpen(false)}
                            onSelect={() => setIsMenuOpen(false)}
                        >
                            <DropdownMenu.Item
                                onSelect={() => setAppState({ openDialog: { name: "frameExport" } })}
                                icon={ExportIcon}
                            >
                                Export slides
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </div>
            </div>
            <div className="PresentationMenu__content">
                <div className="PresentationMenu__slides-list">
                    {sortedFrames.map((frame, index) => (
                        <PresentationMenuSlide
                            key={frame.id}
                            frame={frame}
                            index={index}
                            elements={elements}
                            appState={appState}
                            files={files}
                            onClick={() => {
                                app.scrollToContent(frame, {
                                    animate: true,
                                    fitToViewport: true,
                                    viewportZoomFactor: 1
                                });
                            }}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                        />
                    ))}
                    {sortedFrames.length === 0 && (
                        <div className="PresentationMenu__empty-state">
                            <p>No slides yet.</p>
                            <button onClick={createSlide}>Create your first slide</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="PresentationMenu__footer">
                <button
                    className="PresentationMenu__start-btn"
                    onClick={() => {
                        app.startPresentation();
                    }}
                >
                    {PlayIcon} Start presentation
                </button>
            </div>
        </div>
    );
};

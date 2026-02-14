import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { createPortal } from "react-dom";
import rough from "roughjs/bin/rough";
import {
    arrayToMap,
    toBrandedType,
} from "@excalidraw/common";
import {
    getElementsOverlappingFrame,
    syncInvalidIndices,
} from "@excalidraw/element";
import {
    updateImageCache,
    getInitializedImageElements,
} from "@excalidraw/element";
import { renderStaticScene } from "../renderer/staticScene";
import { getDefaultAppState } from "../appState";
import { Fonts } from "../fonts";
import { t } from "../i18n";
import { SVGLayer } from "./SVGLayer";
import {
    chevronLeftIcon as ChevronLeftIcon,
    chevronRight as ChevronRightIcon,
    PlayIcon,
    stop as StopIcon,
    presentationIcon,
} from "./icons";
import clsx from "clsx";

import type { RenderableElementsMap } from "../scene/types";
import type {
    AppState,
    BinaryFiles,
    EmbedsValidationStatus,
    ElementsPendingErasure,
    AppClassProperties,
} from "../types";
import type {
    ExcalidrawFrameLikeElement,
    NonDeletedExcalidrawElement,
    NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import "./PresentationMode.scss";

interface PresentationModeProps {
    frames: readonly ExcalidrawFrameLikeElement[];
    elements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
    onClose: () => void;
    app: AppClassProperties;
}

const PresentationMode: React.FC<PresentationModeProps> = ({
    frames,
    elements,
    appState,
    files,
    onClose,
    app,
}) => {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRendering, setIsRendering] = useState(true);
    const [dimensions, setDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [laserEnabled, setLaserEnabled] = useState(false);
    const [layout, setLayout] = useState({ fitScale: 1, offsetX: 0, offsetY: 0 });

    // Sort frames by position (left to right, top to bottom)
    const sortedFrames = useMemo(() => {
        return [...frames].sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) > 50) {
                return yDiff;
            }
            return a.x - b.x;
        });
    }, [frames]);

    const currentFrame = sortedFrames[currentSlideIndex];

    const updateDimensions = useCallback(() => {
        setDimensions({
            width: window.innerWidth,
            height: window.innerHeight,
        });
    }, []);

    useEffect(() => {
        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, [updateDimensions]);

    // Request fullscreen on mount
    useEffect(() => {
        const el = containerRef.current;
        if (el && document.fullscreenEnabled) {
            el.requestFullscreen().catch(() => { });
        }

        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        };
    }, []);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                onClose();
            }
            updateDimensions();
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [onClose, updateDimensions]);

    // Render the current frame to canvas
    useEffect(() => {
        if (!currentFrame || !canvasRef.current || dimensions.width === 0) {
            return;
        }

        const renderSlide = async () => {
            setIsRendering(true);

            const canvas = canvasRef.current!;
            const screenWidth = dimensions.width;
            const screenHeight = dimensions.height;

            const frameAspectRatio = currentFrame.width / currentFrame.height;
            const screenAspectRatio = screenWidth / screenHeight;

            const scale = window.devicePixelRatio || 1;
            canvas.width = screenWidth * scale;
            canvas.height = screenHeight * scale;
            canvas.style.width = `${screenWidth}px`;
            canvas.style.height = `${screenHeight}px`;

            const frameElements = getElementsOverlappingFrame(
                elements,
                currentFrame,
            );

            await Fonts.loadElementsFonts(frameElements);

            const { imageCache } = await updateImageCache({
                imageCache: new Map(),
                fileIds: getInitializedImageElements(frameElements).map(
                    (element) => element.fileId,
                ),
                files,
            });

            const defaultAppState = getDefaultAppState();

            const scaleX = screenWidth / currentFrame.width;
            const scaleY = screenHeight / currentFrame.height;
            const fitScale = Math.min(scaleX, scaleY);

            const offsetX =
                (screenWidth - currentFrame.width * fitScale) / 2 / fitScale;
            const offsetY =
                (screenHeight - currentFrame.height * fitScale) / 2 / fitScale;

            const scrollX = -currentFrame.x + offsetX;
            const scrollY = -currentFrame.y + offsetY;

            setLayout({ fitScale, offsetX, offsetY });

            renderStaticScene({
                canvas,
                rc: rough.canvas(canvas),
                elementsMap: toBrandedType<RenderableElementsMap>(
                    arrayToMap(frameElements),
                ),
                allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
                    arrayToMap(syncInvalidIndices(elements)),
                ),
                visibleElements: frameElements,
                scale: fitScale * scale,
                appState: {
                    ...appState,
                    frameRendering: {
                        enabled: true,
                        clip: true,
                        name: false,
                        outline: false,
                    },
                    viewBackgroundColor: appState.viewBackgroundColor,
                    scrollX,
                    scrollY,
                    zoom: defaultAppState.zoom,
                    shouldCacheIgnoreZoom: false,
                    theme: appState.theme,
                },
                renderConfig: {
                    canvasBackgroundColor: appState.viewBackgroundColor,
                    imageCache,
                    renderGrid: false,
                    isExporting: true,
                    embedsValidationStatus: new Map() as EmbedsValidationStatus,
                    elementsPendingErasure: new Set() as ElementsPendingErasure,
                    pendingFlowchartNodes: null,
                    theme: appState.theme,
                },
            });

            setIsRendering(false);
        };

        renderSlide();
    }, [currentFrame, elements, appState, files, dimensions]);

    const nextSlide = useCallback(() => {
        if (currentSlideIndex < sortedFrames.length - 1) {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentSlideIndex((prev) => Math.min(prev + 1, sortedFrames.length - 1));
                setTimeout(() => setIsTransitioning(false), 50);
            }, 200);
        }
    }, [currentSlideIndex, sortedFrames.length]);

    const prevSlide = useCallback(() => {
        if (currentSlideIndex > 0) {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
                setTimeout(() => setIsTransitioning(false), 50);
            }, 200);
        }
    }, [currentSlideIndex]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!laserEnabled) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const sx = cx / layout.fitScale + currentFrame.x - layout.offsetX;
        const sy = cy / layout.fitScale + currentFrame.y - layout.offsetY;

        app.laserTrails.startPath(sx, sy);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const sx = cx / layout.fitScale + currentFrame.x - layout.offsetX;
        const sy = cy / layout.fitScale + currentFrame.y - layout.offsetY;

        app.laserTrails.addPointToPath(sx, sy);
    };

    const handlePointerUp = () => {
        app.laserTrails.endPath();
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "Escape":
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                    break;
                case "ArrowRight":
                case "ArrowDown":
                case " ": // Space
                    e.preventDefault();
                    e.stopPropagation();
                    nextSlide();
                    break;
                case "ArrowLeft":
                case "ArrowUp":
                    e.preventDefault();
                    e.stopPropagation();
                    prevSlide();
                    break;
                case "l":
                case "L":
                    setLaserEnabled(prev => !prev);
                    break;
                case "Home":
                    e.preventDefault();
                    e.stopPropagation();
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentSlideIndex(0);
                        setTimeout(() => setIsTransitioning(false), 50);
                    }, 200);
                    break;
                case "End":
                    e.preventDefault();
                    e.stopPropagation();
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentSlideIndex(sortedFrames.length - 1);
                        setTimeout(() => setIsTransitioning(false), 50);
                    }, 200);
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [currentSlideIndex, sortedFrames.length, onClose, prevSlide, nextSlide]);

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;

            if (clickPosition > 0.66) {
                nextSlide();
            } else if (clickPosition < 0.33) {
                prevSlide();
            }
        },
        [nextSlide, prevSlide],
    );

    if (sortedFrames.length === 0) {
        return createPortal(
            <div className="presentation-mode" ref={containerRef}>
                <div className="presentation-mode__empty">
                    <h2>No Frames Found</h2>
                    <p>Add frames to your canvas to create presentation slides.</p>
                    <button type="button" onClick={onClose}>Close</button>
                </div>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <div
            className={clsx("presentation-mode", {
                "presentation-mode--transitioning": isTransitioning,
                "presentation-mode--laser-enabled": laserEnabled,
            })}
            ref={containerRef}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: "none" }}
        >
            <canvas
                ref={canvasRef}
                className={clsx("presentation-mode__canvas", {
                    "presentation-mode__canvas--loading": isRendering,
                })}
            />

            {laserEnabled && (
                <div
                    className="presentation-mode__laser-container"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                        zIndex: 10,
                    }}
                >
                    <div
                        style={{
                            transform: `translate(${layout.offsetX * layout.fitScale}px, ${layout.offsetY * layout.fitScale}px) scale(${layout.fitScale}) translate(${-currentFrame.x}px, ${-currentFrame.y}px)`,
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        <SVGLayer trails={[app.laserTrails]} />
                    </div>
                </div>
            )}

            <div className="presentation-mode__toolbar" onClick={(e) => e.stopPropagation()}>
                <div className="presentation-mode__toolbar-group">
                    <button
                        type="button"
                        className="presentation-mode__toolbar-btn"
                        onClick={prevSlide}
                        disabled={currentSlideIndex === 0}
                    >
                        {ChevronLeftIcon}
                    </button>
                    <div className="presentation-mode__toolbar-counter">
                        {currentSlideIndex + 1} / {sortedFrames.length}
                    </div>
                    <button
                        type="button"
                        className="presentation-mode__toolbar-btn"
                        onClick={nextSlide}
                        disabled={currentSlideIndex === sortedFrames.length - 1}
                    >
                        {ChevronRightIcon}
                    </button>
                </div>
                <div className="presentation-mode__toolbar-divider" />
                <button
                    type="button"
                    className={clsx("presentation-mode__toolbar-btn", {
                        "presentation-mode__toolbar-btn--active": laserEnabled,
                    })}
                    onClick={() => setLaserEnabled(!laserEnabled)}
                >
                    <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor" }} />
                    </div>
                </button>
                <div className="presentation-mode__toolbar-divider" />
                <button
                    type="button"
                    className="presentation-mode__toolbar-btn presentation-mode__toolbar-btn--exit"
                    onClick={onClose}
                >
                    {StopIcon}
                    <span>ESC</span>
                </button>
            </div>

            {sortedFrames.length <= 20 && (
                <div className="presentation-mode__dots">
                    {sortedFrames.map((_, index) => (
                        <button
                            type="button"
                            key={index}
                            className={clsx("presentation-mode__dot", {
                                "presentation-mode__dot--active": index === currentSlideIndex,
                            })}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsTransitioning(true);
                                setTimeout(() => {
                                    setCurrentSlideIndex(index);
                                    setTimeout(() => setIsTransitioning(false), 50);
                                }, 200);
                            }}
                        />
                    ))}
                </div>
            )}

            {isRendering && (
                <div className="presentation-mode__loading">
                    <div className="presentation-mode__spinner" />
                </div>
            )}
        </div>,
        document.body,
    );
};

export default PresentationMode;

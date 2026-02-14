import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import rough from "roughjs/bin/rough";

import {
    arrayToMap,
    toBrandedType,
    THEME,
} from "@excalidraw/common";

import {
    getElementsOverlappingFrame,
    syncInvalidIndices,
} from "@excalidraw/element";

import {
    getInitializedImageElements,
    updateImageCache,
} from "@excalidraw/element";

import type {
    ExcalidrawFrameLikeElement,
    NonDeletedExcalidrawElement,
    NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { renderStaticScene } from "../renderer/staticScene";
import { Fonts } from "../fonts";

import type { RenderableElementsMap } from "../scene/types";
import type {
    AppState,
    BinaryFiles,
    EmbedsValidationStatus,
    ElementsPendingErasure,
} from "../types";

import "./PresentationMode.scss";

interface PresentationModeProps {
    frames: readonly ExcalidrawFrameLikeElement[];
    elements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
    onClose: () => void;
}

const PresentationMode: React.FC<PresentationModeProps> = ({
    frames,
    elements,
    appState,
    files,
    onClose,
}) => {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRendering, setIsRendering] = useState(true);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Sort frames by position (left to right, top to bottom)
    const sortedFrames = React.useMemo(() => {
        return [...frames].sort((a, b) => {
            // Sort primarily by y position (top to bottom), then by x (left to right)
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
            el.requestFullscreen().catch(() => {
                // Fullscreen not supported or denied, continue in regular mode
            });
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
                // User exited fullscreen via browser controls
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

            // Calculate the scale to fit the frame into the screen
            const frameAspectRatio = currentFrame.width / currentFrame.height;
            const screenAspectRatio = screenWidth / screenHeight;

            let renderWidth: number;
            let renderHeight: number;

            if (frameAspectRatio > screenAspectRatio) {
                // Frame is wider relative to screen
                renderWidth = screenWidth;
                renderHeight = screenWidth / frameAspectRatio;
            } else {
                // Frame is taller relative to screen
                renderHeight = screenHeight;
                renderWidth = screenHeight * frameAspectRatio;
            }

            const scale = window.devicePixelRatio || 1;
            canvas.width = screenWidth * scale;
            canvas.height = screenHeight * scale;
            canvas.style.width = `${screenWidth}px`;
            canvas.style.height = `${screenHeight}px`;

            // Get elements within the frame
            const frameElements = getElementsOverlappingFrame(
                elements,
                currentFrame,
            );

            // Load fonts
            await Fonts.loadElementsFonts(frameElements);

            const { imageCache } = await updateImageCache({
                imageCache: new Map(),
                fileIds: getInitializedImageElements(frameElements).map(
                    (element) => element.fileId,
                ),
                files,
            });

            const defaultAppState = getDefaultAppState();

            // Calculate scroll offsets to center the frame on the canvas
            const scaleX = screenWidth / currentFrame.width;
            const scaleY = screenHeight / currentFrame.height;
            const fitScale = Math.min(scaleX, scaleY);

            // Center the content
            const offsetX =
                (screenWidth - currentFrame.width * fitScale) / 2 / fitScale;
            const offsetY =
                (screenHeight - currentFrame.height * fitScale) / 2 / fitScale;

            const scrollX = -currentFrame.x + offsetX;
            const scrollY = -currentFrame.y + offsetY;

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
                    if (currentSlideIndex < sortedFrames.length - 1) {
                        setIsTransitioning(true);
                        setTimeout(() => {
                            setCurrentSlideIndex((prev) =>
                                Math.min(prev + 1, sortedFrames.length - 1),
                            );
                            setTimeout(() => setIsTransitioning(false), 50);
                        }, 200);
                    }
                    break;
                case "ArrowLeft":
                case "ArrowUp":
                    e.preventDefault();
                    e.stopPropagation();
                    if (currentSlideIndex > 0) {
                        setIsTransitioning(true);
                        setTimeout(() => {
                            setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
                            setTimeout(() => setIsTransitioning(false), 50);
                        }, 200);
                    }
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

        // Use capture phase to intercept before other handlers
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [currentSlideIndex, sortedFrames.length, onClose]);

    // Click event to go to next slide
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            // Right third of screen = next, left third = previous
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;

            if (clickPosition > 0.66) {
                if (currentSlideIndex < sortedFrames.length - 1) {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentSlideIndex((prev) =>
                            Math.min(prev + 1, sortedFrames.length - 1),
                        );
                        setTimeout(() => setIsTransitioning(false), 50);
                    }, 200);
                }
            } else if (clickPosition < 0.33) {
                if (currentSlideIndex > 0) {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
                        setTimeout(() => setIsTransitioning(false), 50);
                    }, 200);
                }
            }
        },
        [currentSlideIndex, sortedFrames.length],
    );

    if (sortedFrames.length === 0) {
        return createPortal(
            <div className="presentation-mode" ref={containerRef}>
                <div className="presentation-mode__empty">
                    <div className="presentation-mode__empty-icon">
                        <svg
                            width="80"
                            height="80"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                        >
                            <path d="M3 4l18 0" />
                            <path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" />
                            <path d="M12 16l0 4" />
                            <path d="M9 20l6 0" />
                        </svg>
                    </div>
                    <h2>No Frames Found</h2>
                    <p>
                        Add frames to your canvas to create presentation slides.
                        <br />
                        Each frame becomes a separate slide.
                    </p>
                    <button
                        type="button"
                        className="presentation-mode__close-btn"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <div
            className={`presentation-mode ${isTransitioning ? "presentation-mode--transitioning" : ""}`}
            ref={containerRef}
            onClick={handleClick}
        >
            <canvas
                ref={canvasRef}
                className={`presentation-mode__canvas ${isRendering ? "presentation-mode__canvas--loading" : ""}`}
            />

            {/* Slide counter */}
            <div className="presentation-mode__counter">
                <span className="presentation-mode__counter-current">
                    {currentSlideIndex + 1}
                </span>
                <span className="presentation-mode__counter-separator">/</span>
                <span className="presentation-mode__counter-total">
                    {sortedFrames.length}
                </span>
            </div>

            {/* Navigation arrows */}
            {currentSlideIndex > 0 && (
                <button
                    type="button"
                    className="presentation-mode__nav presentation-mode__nav--prev"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsTransitioning(true);
                        setTimeout(() => {
                            setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
                            setTimeout(() => setIsTransitioning(false), 50);
                        }, 200);
                    }}
                    aria-label="Previous slide"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            )}

            {currentSlideIndex < sortedFrames.length - 1 && (
                <button
                    type="button"
                    className="presentation-mode__nav presentation-mode__nav--next"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsTransitioning(true);
                        setTimeout(() => {
                            setCurrentSlideIndex((prev) =>
                                Math.min(prev + 1, sortedFrames.length - 1),
                            );
                            setTimeout(() => setIsTransitioning(false), 50);
                        }, 200);
                    }}
                    aria-label="Next slide"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            )}

            {/* Close button */}
            <button
                type="button"
                className="presentation-mode__exit"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                aria-label="Exit presentation"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>ESC</span>
            </button>

            {/* Slide indicator dots */}
            {sortedFrames.length <= 20 && (
                <div className="presentation-mode__dots">
                    {sortedFrames.map((_, index) => (
                        <button
                            type="button"
                            key={index}
                            className={`presentation-mode__dot ${index === currentSlideIndex ? "presentation-mode__dot--active" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsTransitioning(true);
                                setTimeout(() => {
                                    setCurrentSlideIndex(index);
                                    setTimeout(() => setIsTransitioning(false), 50);
                                }, 200);
                            }}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Loading indicator */}
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

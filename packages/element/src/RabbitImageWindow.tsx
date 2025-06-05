import React, { useState, useRef } from 'react';
import type { AppState } from "@excalidraw/excalidraw/types";

interface ImageItem {
    id: string;
    src: string;
    alt: string;
    name?: string;
    snippet?: string;
    displayImage ?: string;
}

// properties of rabbit image window
interface RabbitImageWindowProps {
    appState: AppState;
    onImageSelect: (image: any) => void;
    onImageDeselect: (image: any) => void;
    selectedImages: string[];
    onToggleVisibility: () => void;
    onTabClick?: (tabName: string, tabIndex: number) => void;
    onAddToCanvas: (selectedImages: string[]) => void;
    tabData: {
        name: string;
        images: {
            id: string;
            src: string;
            alt: string;
            name: string;
            snippet?: string;
            displayImage?: string;
        }[];
        searchQuery?: string;  // Add this
        loaded?: boolean; 
    }[];
}

export const RabbitImageWindow: React.FC<RabbitImageWindowProps> = ({
    appState,
    onImageSelect,
    onImageDeselect,
    selectedImages,
    onToggleVisibility,
    onTabClick,
    onAddToCanvas,
    tabData,
}) => {
    const [activeTab, setActiveTab] = useState(0);
    const [pos, setPos] = useState({ x: 1000, y: 160 });
    const [isMinimized, setIsMinimized] = useState(false);
    const dragRef = useRef<{ x: number; y: number } | null>(null);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);

    // Component dimensions - adjust these if you change the component size
    const COMPONENT_WIDTH = 320;
    const COMPONENT_HEIGHT = 400; // Approximate height, adjust as needed
    const MINIMIZED_WIDTH = 250;
    const MINIMIZED_HEIGHT = 50;

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { x: e.clientX, y: e.clientY };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };
    

    const onMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        
        setPos((prev) => {
            const newX = prev.x + dx;
            const newY = prev.y + dy;
            
            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Use appropriate dimensions based on minimized state
            const currentWidth = isMinimized ? MINIMIZED_WIDTH : COMPONENT_WIDTH;
            const currentHeight = isMinimized ? MINIMIZED_HEIGHT : COMPONENT_HEIGHT;
            
            // Constrain to viewport bounds
            const constrainedX = Math.max(0, Math.min(newX, viewportWidth - currentWidth));
            const constrainedY = Math.max(0, Math.min(newY, viewportHeight - currentHeight));
            
            return { x: constrainedX, y: constrainedY };
        });
        
        dragRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleDoubleClick = (image: ImageItem) => {
        if (tabData[activeTab].name === "Internet webpages") {
            window.open(
                image.src, 
                '_blank', 
                'width=1200,height=800,left=100,top=100,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes'
            );
        }
    };

    const onMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };

    const handleImageClick = (image: ImageItem) => {
        const isSelected = selectedImages.includes(image.id);
        isSelected ? onImageDeselect(image) : onImageSelect(image);
    };

    const isImageSelected = (id: string) => selectedImages.includes(id);

    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    if (
        appState.viewModeEnabled ||
        appState.zenModeEnabled ||
        appState.openDialog?.name === "elementLinkSelector"
    ) {
        return null;
    }

    return (
        <div
            style={{
                position: "absolute",
                top: pos.y,
                left: pos.x,
                width: isMinimized ? `${MINIMIZED_WIDTH}px` : "320px",
                height: isMinimized ? `${MINIMIZED_HEIGHT}px` : "auto",
                background: "white",
                border: "1px solid rgb(151, 172, 202)",
                borderRadius: "12px",
                boxShadow: "var(--shadow-3)",
                zIndex: 999,
                userSelect: dragRef.current ? "none" : "auto",
                overflow: "hidden",
                transition: "width 0.3s ease, height 0.3s ease",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: isMinimized ? "none" : "1px solid var(--color-border)",
                    background: "var(--color-surface-low)",
                    cursor: "move",
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                    borderBottomLeftRadius: isMinimized ? "12px" : "0",
                    borderBottomRightRadius: isMinimized ? "12px" : "0",
                }}
                onMouseDown={onMouseDown}
            >
                <h3 style={{ 
                    fontSize: "14px", 
                    margin: 0, 
                    userSelect: "none", 
                    fontFamily: "Assistant", 
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }}>
                    Rabbit Search
                    {isMinimized && selectedImages.length > 0 && (
                        <span style={{ 
                            fontSize: "12px", 
                            color: "var(--color-text-secondary)",
                            marginLeft: "8px"
                        }}>
                            ({selectedImages.length} selected)
                        </span>
                    )}
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={toggleMinimize}
                        title={isMinimized ? "Expand" : "Minimize"}
                        style={{
                            border: "none",
                            background: "none",
                            color: "var(--color-text-secondary)",
                            cursor: "pointer",
                            userSelect: "none",
                            fontSize: "16px",
                            padding: "0",
                            width: "16px",
                            height: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {isMinimized ? (
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M16 4l4 0l0 4" />
                                <path d="M14 10l6 -6" />
                                <path d="M8 20l-4 0l0 -4" />
                                <path d="M4 20l6 -6" />
                            </svg>
                        ) : (
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M5 12l14 0" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={onToggleVisibility}
                        title="Hide"
                        style={{
                            border: "none",
                            background: "none",
                            color: "var(--color-text-secondary)",
                            cursor: "pointer",
                            userSelect: "none",
                            fontSize: "16px",
                            padding: "0",
                            width: "16px",
                            height: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
          
                    <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
                        {tabData.map((tab, index) => {
                            const getTabIcon = (tabName: string) => {
                                switch (tabName.toLowerCase()) {
                                    case 'google':
                                        return (
                                            <svg 
                                                xmlns="http://www.w3.org/2000/svg" 
                                                width="16" 
                                                height="16" 
                                                viewBox="0 0 24 24" 
                                                fill="currentColor"
                                            >
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                <path d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1 -1.265 .06a6 6 0 1 0 2.103 6.836l.001 -.004h-3.66a1 1 0 0 1 -.992 -.883l-.007 -.117v-2a1 1 0 0 1 1 -1h6.945a1 1 0 0 1 .994 .89c.04 .367 .061 .737 .061 1.11c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10z" />
                                            </svg>
                                        );
                                    case 'youtube':
                                        return (
                                            <svg 
                                                xmlns="http://www.w3.org/2000/svg" 
                                                width="16" 
                                                height="16" 
                                                viewBox="0 0 24 24" 
                                                fill="currentColor"
                                            >
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                <path d="M18 3a5 5 0 0 1 5 5v8a5 5 0 0 1 -5 5h-12a5 5 0 0 1 -5 -5v-8a5 5 0 0 1 5 -5zm-9 6v6a1 1 0 0 0 1.514 .857l5 -3a1 1 0 0 0 0 -1.714l-5 -3a1 1 0 0 0 -1.514 .857z" />
                                            </svg>
                                        );
                                    case 'pinterest':
                                        return (
                                            <svg 
                                                xmlns="http://www.w3.org/2000/svg" 
                                                width="16" 
                                                height="16" 
                                                viewBox="0 0 24 24" 
                                                fill="currentColor"
                                            >
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                <path d="M17 3.34a10 10 0 0 1 -8.512 18.023l2.364 -5.315a3.5 3.5 0 0 0 2.398 .952c2.708 0 4.75 -2.089 4.75 -5a6 6 0 1 0 -11.64 2.041a1 1 0 1 0 1.88 -.682a4 4 0 1 1 7.76 -1.36c0 1.818 -1.156 3.001 -2.75 3.001c-.609 0 -1.153 -.361 -1.478 -1.022l1.142 -2.572a1 1 0 0 0 -1.828 -.812l-4.392 9.882a10 10 0 0 1 -4.694 -8.476l.005 -.324a10 10 0 0 1 14.995 -8.336" />
                                            </svg>
                                        );
                                    case 'internet webpages':
                                        return (
                                            <svg 
                                                xmlns="http://www.w3.org/2000/svg" 
                                                width="16" 
                                                height="16" 
                                                viewBox="0 0 24 24" 
                                                fill="none" 
                                                stroke="currentColor" 
                                                strokeWidth="2" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round"
                                            >
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                                                <path d="M3.6 9h16.8" />
                                                <path d="M3.6 15h16.8" />
                                                <path d="M11.5 3a17 17 0 0 0 0 18" />
                                                <path d="M12.5 3a17 17 0 0 1 0 18" />
                                            </svg>
                                        );
                                    default:
                                        return null;
                                }
                            };

                            return (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setActiveTab(index);
                                        // Call the lazy loading function if provided
                                        if (onTabClick) {
                                            onTabClick(tab.name, index);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: "8px",
                                        background: activeTab === index ? "white" : "#DEECFF",
                                        color: "black",
                                        border: "none",
                                        cursor: "pointer",
                                        fontFamily: "Assistant",
                                        fontWeight: 600,
                                        fontSize: "12px",
                                        borderRadius: "6px 6px 0 0",
                                        borderStyle: "solid",
                                        borderWidth: "1px 1px 0 1px",
                                        borderColor: "#93A2B7",
                                        transition: "background 0.2s ease, color 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {getTabIcon(tab.name)}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            height: "10px",
                            background: "white",
                            border: "1px solid #93A2B7",
                            borderTop: "none",
                            borderBottom: "none",
                        }}
                    ></div>

                    <div
                        style={{
                            padding: "16px",
                            maxHeight: "320px",
                            overflowY: "auto",
                            background: "white",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px",
                            borderStyle: "solid",
                            borderWidth: "0px 1px 1px 1px",
                            borderColor: "#93A2B7",
                        }}
                    >
                        {tabData[activeTab]?.images.map((image) => (
                            <div
                                key={image.id}
                                onClick={() => handleImageClick(image)}
                                onMouseEnter={() => setHoveredCard(image.id)}
                                onMouseLeave={() => setHoveredCard(null)}
                                onDoubleClick={() => handleDoubleClick(image)}
                                style={{
                                    boxSizing: "border-box",
                                    border: isImageSelected(image.id)
                                        ? "3.5px solid rgb(0, 145, 255)"
                                        : "2px solid transparent",
                                    borderRadius: "5px",
                                    overflow: "visible",
                                    cursor: "pointer",
                                    position: "relative",
                                    background: "var(--color-surface-low)",
                                    transition: "border 0.2s ease, box-shadow 0.2s ease",
                                    padding: tabData[activeTab].name === "Internet webpages" ? "8px" : "0",
                                    minHeight: tabData[activeTab].name === "Internet webpages" ? "60px" : "auto",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            > 
                                {tabData[activeTab].name === "Internet webpages" ? (
                                    <div style={{
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        color: "#333",
                                        lineHeight: "1.3",
                                        textAlign: "center",
                                        width: "100%"
                                    }}>
                                        {image.name}
                                    </div>
                                ) : (
                                    <img
                                        src={image.displayImage || image.src}
                                        alt={image.alt}
                                        style={{
                                            width: "100%",
                                            height: "auto",
                                            display: "block",
                                        }}
                                    />
                                )}
                                {/* Move tooltip INSIDE the card div */}
                                {hoveredCard === image.id && image.snippet && tabData[activeTab].name === "Internet webpages" && (
                                    <div style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: "0",
                                        right: "0",
                                        background: "#333",
                                        color: "white",
                                        padding: "8px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        zIndex: 1001,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                        marginTop: "4px",
                                        maxWidth: "280px",
                                        wordWrap: "break-word"
                                    }}>
                                        {image.snippet}
                                    </div>
                                )}
                                {/* Tooltip for YouTube - shows full title */}
                                {hoveredCard === image.id && image.name && tabData[activeTab].name === "YouTube" && (
                                    <div style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: "0",
                                        right: "0",
                                        background: "#333", // YouTube red
                                        color: "white",
                                        padding: "8px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        zIndex: 1001,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                        marginTop: "4px",
                                        maxWidth: "280px",
                                        wordWrap: "break-word"
                                    }}>
                                        {image.name}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {selectedImages.length > 0 && (
                        <div
                            style={{
                                padding: "12px 0px",
                                borderTop: "1px solid var(--color-border)",
                                background: "var(--color-surface-low)",
                                marginBottom: "10px",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: "11px",
                                    fontFamily: "Assistant",
                                    color: "var(--color-text-secondary)",
                                    textAlign: "center",
                                    margin: 0,
                                }}
                            >
                                {selectedImages.length} selected
                            </p>

                            <button
                                onClick={() => {
                                    // calls onAddToCanvas function in App.tsx which generates rabbit-images
                                    onAddToCanvas(selectedImages);
                                }}
                                style={{
                                    background: "rgb(107, 176, 229)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "6px 16px", // Smaller padding
                                    fontSize: "12px", // Smaller font
                                    fontFamily: "Assistant",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    boxShadow: "0 1px 4px rgba(151, 172, 202, 0.3)",
                                    minWidth: "70px", // Smaller minimum width
                                    display: "block",
                                    margin: "0 auto",
                                    marginLeft: "110px",
                                    marginTop: "10px",
                                    marginBottom: "-8px",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                    e.currentTarget.style.background = "rgb(66, 144, 204)"; // Darker on hover
                                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(151, 172, 202, 0.4)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.background = "rgb(107, 176, 229)";
                                    e.currentTarget.style.boxShadow = "0 1px 4px rgba(151, 172, 202, 0.3)";
                                }}
                                onMouseDown={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                Add to Canvas
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
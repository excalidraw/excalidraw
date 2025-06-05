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
    const dragRef = useRef<{ x: number; y: number } | null>(null);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);

    // Component dimensions - adjust these if you change the component size
    const COMPONENT_WIDTH = 320;
    const COMPONENT_HEIGHT = 400; // Approximate height, adjust as needed

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
            
            // Constrain to viewport bounds
            const constrainedX = Math.max(0, Math.min(newX, viewportWidth - COMPONENT_WIDTH));
            const constrainedY = Math.max(0, Math.min(newY, viewportHeight - COMPONENT_HEIGHT));
            
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
                width: "320px",
                background: "white",
                border: "1px solid rgb(151, 172, 202)",
                borderRadius: "12px",
                boxShadow: "var(--shadow-3)",
                zIndex: 999,
                userSelect: dragRef.current ? "none" : "auto",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-surface-low)",
                    cursor: "move",
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                }}
                onMouseDown={onMouseDown}
            >
                <h3 style={{ fontSize: "14px", margin: 0, userSelect: "none", fontFamily: "Assistant", fontWeight: 600 }}>
                    Rabbit Image Search
                </h3>
                <button
                    onClick={onToggleVisibility}
                    title="Hide"
                    style={{
                        border: "none",
                        background: "none",
                        color: "var(--color-text-secondary)",
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    ✕
                </button>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
                {tabData.map((tab, index) => (
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
                        }}
                    >
                        {tab.name}
                    </button>
                ))}
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
                        onMouseEnter = {() => setHoveredCard(image.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onDoubleClick= {()=> handleDoubleClick(image)}
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
                    > {tabData[activeTab].name === "Internet webpages" ? (
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
        </div>
    );
};
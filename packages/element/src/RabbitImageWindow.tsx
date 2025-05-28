import React, { useState } from 'react';
import type {
    AppState,
    PointerDownState as ExcalidrawPointerDownState,
} from "@excalidraw/excalidraw/types";
interface RabbitImageWindowProps {
    appState: AppState;
    onImageSelect: (image: any) => void;
    onImageDeselect: (image: any) => void;
    selectedImages: string[];
    onToggleVisibility: () => void;
}

export const RabbitImageWindow: React.FC<RabbitImageWindowProps> = ({
    appState,
    onImageSelect,
    onImageDeselect,
    selectedImages,
    onToggleVisibility,
}) => {
    const [activeTab, setActiveTab] = useState(0);

    const tabData = [
        {
            name: "Animals",
            images: Array.from({ length: 10 }, (_, i) => ({
                id: `animal-${i}`,
                src: `https://picsum.photos/80/80?random=${i + 1}`,
                alt: `Animal ${i + 1}`,
                name: `Animal ${i + 1}`,
            })),
        },
        {
            name: "Nature",
            images: Array.from({ length: 10 }, (_, i) => ({
                id: `nature-${i}`,
                src: `https://picsum.photos/80/80?random=${i + 11}`,
                alt: `Nature ${i + 1}`,
                name: `Nature ${i + 1}`,
            })),
        },
        {
            name: "Objects",
            images: Array.from({ length: 10 }, (_, i) => ({
                id: `object-${i}`,
                src: `https://picsum.photos/80/80?random=${i + 21}`,
                alt: `Object ${i + 1}`,
                name: `Object ${i + 1}`,
            })),
        },
    ];

    const handleImageClick = (image: any) => {
        const isSelected = selectedImages.includes(image.id);
        isSelected ? onImageDeselect(image) : onImageSelect(image);
    };

    const isImageSelected = (id: string) => selectedImages.includes(id);

    // Do not show in certain modes
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
                top: "calc(100% + 4px)",
                left: 0,
                width: "320px",
                background: "var(--color-surface-lowest)",
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                boxShadow: "var(--shadow-3)",
                zIndex: 999,
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-surface-low)",
                }}
            >
                <h3 style={{ fontSize: "14px", margin: 0 }}>Rabbit Images</h3>
                <button
                    onClick={onToggleVisibility}
                    title="Hide"
                    style={{
                        border: "none",
                        background: "none",
                        color: "var(--color-text-secondary)",
                        cursor: "pointer",
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Tabs */}
            <div
                style={{
                    display: "flex",
                    borderBottom: "1px solid var(--color-border)",
                }}
            >
                {tabData.map((tab, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveTab(index)}
                        style={{
                            flex: 1,
                            padding: "8px",
                            background: activeTab === index ? "#007BFF" : "transparent", // solid blue for active
                            color: activeTab === index ? "#ffffff" : "var(--color-text-secondary)",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "12px",
                            borderBottom: activeTab === index ? "3px solid #0056b3" : "none", // optional accent
                            borderRadius: "6px 6px 0 0", // optional rounded top corners
                            transition: "background 0.2s ease, color 0.2s ease",
                        }}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Image Grid */}
            <div
                style={{
                    padding: "16px",
                    maxHeight: "400px",
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                }}
            >
                {tabData[activeTab].images.map((image) => (
                    <div
                        key={image.id}
                        onClick={() => handleImageClick(image)}
                        style={{
                            boxSizing: "border-box", // ← this fixes the resize issue
                            border: isImageSelected(image.id)
                                ? "3px solid #007BFF"
                                : "2px solid transparent",
                            borderRadius: "10px",
                            overflow: "hidden",
                            cursor: "pointer",
                            position: "relative",
                            background: "var(--color-surface-low)",
                            boxShadow: isImageSelected(image.id)
                                ? "0 0 0 2px rgba(0, 123, 255, 0.3)"
                                : "none",
                            transition: "border 0.2s ease, box-shadow 0.2s ease",
                        }}
                    >
                        <img
                            src={image.src}
                            alt={image.alt}
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                            }}
                        />
                        <p
                            style={{
                                fontSize: "11px",
                                textAlign: "center",
                                margin: "4px 0 0 0",
                            }}
                        >
                            {image.name}
                        </p>
                    </div>
                ))}
            </div>

            {/* Footer */}
            {selectedImages.length > 0 && (
                <div
                    style={{
                        padding: "12px 16px",
                        borderTop: "1px solid var(--color-border)",
                        background: "var(--color-surface-low)",
                    }}
                >
                    <p
                        style={{
                            fontSize: "11px",
                            color: "var(--color-text-secondary)",
                            textAlign: "center",
                            margin: 0,
                        }}
                    >
                        {selectedImages.length} selected
                    </p>
                </div>
            )}
        </div>
    );
};
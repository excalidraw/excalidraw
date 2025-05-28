// import React, { useState, useRef } from 'react';
// import type {
//     AppState,
// } from "@excalidraw/excalidraw/types";

// interface RabbitImageWindowProps {
//     appState: AppState;
//     onImageSelect: (image: any) => void;
//     onImageDeselect: (image: any) => void;
//     selectedImages: string[];
//     onToggleVisibility: () => void;
// }

// export const RabbitImageWindow: React.FC<RabbitImageWindowProps> = ({
//     appState,
//     onImageSelect,
//     onImageDeselect,
//     selectedImages,
//     onToggleVisibility,
// }) => {
//     const [activeTab, setActiveTab] = useState(0);

//     // Initial position (can adjust)
//     const [pos, setPos] = useState({ x: 0, y: 0 });

//     // Used to track dragging state & last cursor position
//     const dragRef = useRef<{ x: number; y: number } | null>(null);

//     // Start dragging
//     const onMouseDown = (e: React.MouseEvent) => {
//         e.preventDefault(); // prevent text selection etc
//         dragRef.current = { x: e.clientX, y: e.clientY };
//         window.addEventListener("mousemove", onMouseMove);
//         window.addEventListener("mouseup", onMouseUp);
//     };

//     // Drag move
//     const onMouseMove = (e: MouseEvent) => {
//         if (!dragRef.current) return;
//         const dx = e.clientX - dragRef.current.x;
//         const dy = e.clientY - dragRef.current.y;
//         setPos((prev) => ({
//             x: prev.x + dx,
//             y: prev.y + dy,
//         }));
//         dragRef.current = { x: e.clientX, y: e.clientY };
//     };

//     // Drag end
//     const onMouseUp = () => {
//         dragRef.current = null;
//         window.removeEventListener("mousemove", onMouseMove);
//         window.removeEventListener("mouseup", onMouseUp);
//     };

//     const tabData = [
//         {
//             name: "Google",
//             images: Array.from({ length: 10 }, (_, i) => ({
//                 id: `animal-${i}`,
//                 src: `https://picsum.photos/80/80?random=${i + 1}`,
//                 alt: `Animal ${i + 1}`,
//                 name: `Animal ${i + 1}`,
//             })),
//         },
//         {
//             name: "Pinterest",
//             images: Array.from({ length: 10 }, (_, i) => ({
//                 id: `nature-${i}`,
//                 src: `https://picsum.photos/80/80?random=${i + 11}`,
//                 alt: `Nature ${i + 1}`,
//                 name: `Nature ${i + 1}`,
//             })),
//         },
//         {
//             name: "YouTube",
//             images: Array.from({ length: 10 }, (_, i) => ({
//                 id: `object-${i}`,
//                 src: `https://picsum.photos/80/80?random=${i + 21}`,
//                 alt: `Object ${i + 1}`,
//                 name: `Object ${i + 1}`,
//             })),
//         },
//     ];

//     const handleImageClick = (image: any) => {
//         const isSelected = selectedImages.includes(image.id);
//         isSelected ? onImageDeselect(image) : onImageSelect(image);
//     };

//     const isImageSelected = (id: string) => selectedImages.includes(id);

//     // Hide in some modes
//     if (
//         appState.viewModeEnabled ||
//         appState.zenModeEnabled ||
//         appState.openDialog?.name === "elementLinkSelector"
//     ) {
//         return null;
//     }

//     return (
//         <div
//             style={{
//                 position: "absolute",
//                 top: pos.y,
//                 left: pos.x,
//                 width: "320px",
//                 // background: "var(--color-surface-lowest)",
//                 background: "white",

//                 border: "1px solid rgb(151, 172, 202)",
//                 borderRadius: "12px",
//                 boxShadow: "var(--shadow-3)",
//                 zIndex: 999,
//                 userSelect: dragRef.current ? "none" : "auto", // disable text select while dragging
//             }}
//         >
//             {/* Header: draggable */}
//             <div
//                 style={{
//                     display: "flex",
//                     justifyContent: "space-between",
//                     alignItems: "center",
//                     padding: "12px 16px",
//                     borderBottom: "1px solid var(--color-border)",
//                     background: "var(--color-surface-low)",
//                     cursor: "move", // show drag cursor
//                     borderTopLeftRadius: "12px",
//                     borderTopRightRadius: "12px",
//                 }}
//                 onMouseDown={onMouseDown}
//             >
//                 <h3 style={{ fontSize: "14px", margin: 0, userSelect: "none", fontFamily: "Assistant", fontWeight: 600 }}>
//                     Rabbit Image Search
//                 </h3>
//                 <button
//                     onClick={onToggleVisibility}
//                     title="Hide"
//                     style={{
//                         border: "none",
//                         background: "none",
//                         color: "var(--color-text-secondary)",
//                         cursor: "pointer",
//                         userSelect: "none",
//                     }}
//                 >
//                     ✕
//                 </button>
//             </div>

//             {/* Tabs */}
//             <div
//                 style={{
//                     display: "flex",
//                     borderBottom: "1px solid var(--color-border)",
//                 }}
//             >
//                 {tabData.map((tab, index) => (
//                     <button
//                         key={index}
//                         onClick={() => setActiveTab(index)}
//                         style={{
//                             flex: 1,
//                             padding: "8px",
//                             background: activeTab === index ? "white" : "#DEECFF",  // light blue for unselected
//                             color: "black",
//                             border: "none",
//                             cursor: "pointer",
//                             fontFamily: "Assistant",
//                             fontWeight: 600,
//                             fontSize: "12px",
//                             borderRadius: "6px 6px 0 0",
//                             borderStyle: "solid",
//                             borderWidth: "1px 1px 0 1px",  // top, right, bottom, left
//                             borderColor: "#93A2B7",
//                             transition: "background 0.2s ease, color 0.2s ease",
//                         }}
//                     >
//                         {tab.name}
//                     </button>

//                 ))}
//             </div>

//             {/* Spacer div for margin */}
//             <div
//                 style={{
//                     height: "10px",   // or however much space you want
//                     background: "white",
                   
//                     border: "1px solid #93A2B7",
//                     borderTop: "none",
//                     borderBottom: "none",
//                 }}
//             ></div>

//             {/* Image Grid */}
//             <div
//                 style={{
//                     padding: "16px",

//                     maxHeight: "400px",
//                     overflowY: "auto",
//                     background: "white", // same blue as selected tab
//                     display: "grid",
//                     gridTemplateColumns: "1fr 1fr",
//                     gap: "12px",
//                     borderStyle: "solid",
//                     borderWidth: "0px 1px 1px 1px",  // top, right, bottom, left
//                     borderColor: "#93A2B7",
//                     // borderBottom: "none",
//                 }}
//             >
//                 {tabData[activeTab].images.map((image) => (
//                     <div
//                         key={image.id}
//                         onClick={() => handleImageClick(image)}
//                         style={{
//                             boxSizing: "border-box",
//                             border: isImageSelected(image.id)
//                                 ? "3.5px solid rgb(0, 145, 255)"
//                                 : "2px solid transparent",
//                             borderRadius: "5px",
//                             overflow: "hidden",
//                             cursor: "pointer",
//                             position: "relative",
//                             background: "var(--color-surface-low)",
//                             // boxShadow: isImageSelected(image.id)
//                             //     ? "0 0 0 2px rgba(0, 123, 255, 0.3)"
//                             //     : "none",
//                             transition: "border 0.2s ease, box-shadow 0.2s ease",
//                         }}
//                     >
//                         <img
//                             src={image.src}
//                             alt={image.alt}
//                             style={{
//                                 width: "100%",
//                                 height: "auto",
//                                 display: "block",
//                             }}
//                         />

//                     </div>
//                 ))}
//             </div>

//             {/* Footer */}
//             {selectedImages.length > 0 && (
//                 <div
//                     style={{
//                         padding: "12px 16px",
//                         borderTop: "1px solid var(--color-border)",
//                         background: "var(--color-surface-low)",
//                     }}
//                 >
//                     <p
//                         style={{
//                             fontSize: "11px",
//                             fontFamily: "Assistant",
//                             color: "var(--color-text-secondary)",
//                             textAlign: "center",
//                             margin: 0,
//                         }}
//                     >
//                         {selectedImages.length} selected
//                     </p>
//                 </div>
//             )}
//         </div>
//     );
// };

import React, { useState, useRef } from 'react';
import type { AppState } from "@excalidraw/excalidraw/types";

interface ImageItem {
  id: string;
  src: string;
  alt: string;
  name?: string;
}

interface Tab {
  name: string;
  images: ImageItem[];
}

interface RabbitImageWindowProps {
  appState: AppState;
  onImageSelect: (image: ImageItem) => void;
  onImageDeselect: (image: ImageItem) => void;
  selectedImages: string[];
  onToggleVisibility: () => void;
  tabs: Tab[];
}

export const RabbitImageWindow: React.FC<RabbitImageWindowProps> = ({
  appState,
  onImageSelect,
  onImageDeselect,
  selectedImages,
  onToggleVisibility,
  tabs,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

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
    setPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    dragRef.current = { x: e.clientX, y: e.clientY };
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
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
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
          maxHeight: "400px",
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
        {tabs[activeTab]?.images.map((image) => (
          <div
            key={image.id}
            onClick={() => handleImageClick(image)}
            style={{
              boxSizing: "border-box",
              border: isImageSelected(image.id)
                ? "3.5px solid rgb(0, 145, 255)"
                : "2px solid transparent",
              borderRadius: "5px",
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              background: "var(--color-surface-low)",
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
          </div>
        ))}
      </div>

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
              fontFamily: "Assistant",
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

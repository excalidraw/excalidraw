
import React from "react";
import { NonDeletedExcalidrawElement } from "../../../../packages/excalidraw/element/types";

interface PropertiesSidebarProps {
  selectedElement: NonDeletedExcalidrawElement | null;
  onUpdateElement: (updatedData: any) => void;
}

const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  selectedElement,
  onUpdateElement,
}) => {
  if (!selectedElement) {
    return null;
  }

  const isZone = selectedElement.customData?.isZone;

  const handleAcceptsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateElement({ accepts: event.target.value });
  };

  return (
    <div className="properties-sidebar" style={{
      position: "absolute",
      top: "60px",
      right: "10px",
      width: "250px",
      backgroundColor: "rgb(255, 255, 255)",
      border: "1px solid rgb(233, 233, 233)",
      borderRadius: "8px",
      padding: "16px",
      zIndex: 10,
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
    }}>
      <h4>Eigenschaften</h4>
      <div>
        <strong>Typ:</strong> {isZone ? "Zone" : "Karte"}
      </div>
      <div>
        <strong>ID:</strong> <span style={{ fontSize: "0.8em", color: "#666" }}>{selectedElement.id}</span>
      </div>
      {isZone && (
        <div style={{ marginTop: "10px" }}>
          <label htmlFor="accepts-input">
            <strong>Akzeptiert:</strong>
          </label>
          <input
            id="accepts-input"
            type="text"
            value={selectedElement.customData?.accepts || ""}
            onChange={handleAcceptsChange}
            style={{
              width: "100%",
              marginTop: "5px",
              padding: "4px 8px",
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PropertiesSidebar;

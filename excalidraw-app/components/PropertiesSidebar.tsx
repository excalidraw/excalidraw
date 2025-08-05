import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

interface PropertiesSidebarProps {
  element: NonDeletedExcalidrawElement;
  onUpdate: (data: any) => void;
}

export const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  element,
  onUpdate,
}) => {
  const { customData = {} } = element;

  return (
    <div
      style={{
        background: "#fff",
        padding: "1rem",
        width: "250px",
        border: "1px solid #ccc",
        borderRadius: "8px",
      }}
    >
      <h4>Eigenschaften</h4>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={!!customData.isCard}
            onChange={(e) =>
              onUpdate({ isCard: e.target.checked, isZone: false })
            }
          />
          Ist eine Karte
        </label>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={!!customData.isZone}
            onChange={(e) =>
              onUpdate({ isZone: e.target.checked, isCard: false })
            }
          />
          Ist eine Zone
        </label>
      </div>

      {customData.isCard && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Karten-Typ
          </label>
          <input
            type="text"
            placeholder="z.B. 'apfel' oder 'frage_1'"
            defaultValue={customData.cardType || ""}
            onChange={(e) => onUpdate({ cardType: e.target.value })}
            style={{ width: "200px" }}
          />
        </div>
      )}

      {customData.isZone && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Akzeptierte Karten-Typen (kommagetrennt)
          </label>
          <input
            type="text"
            placeholder="z.B. 'apfel,birne'"
            defaultValue={customData.acceptedCardTypes || ""}
            onChange={(e) => onUpdate({ acceptedCardTypes: e.target.value })}
            style={{ width: "200px" }}
          />
        </div>
      )}
    </div>
  );
};

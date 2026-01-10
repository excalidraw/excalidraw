import React, { useState } from "react";
import { useAtom } from "jotai";
import { isSidebarOpenAtom, sidebarWidthAtom } from "./atoms";
import { getAvailableTemplates, type Template } from "./templates";
import "./SidebarDrawer.scss";

interface SidebarDrawerProps {
  onLoadTemplate?: (template: Template) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  onLoadTemplate,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(isSidebarOpenAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [activeTab, setActiveTab] = useState<"templates" | "layers">(
    "templates",
  );
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  if (!isSidebarOpen) {
    return null;
  }

  return (
    <div className="chatcanvas-sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="chatcanvas-sidebar__header">
        <h2 className="chatcanvas-sidebar__title">Assets</h2>
        <button
          className="chatcanvas-sidebar__close"
          onClick={() => setIsSidebarOpen(false)}
          title="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="chatcanvas-sidebar__tabs">
        <button
          className={`chatcanvas-sidebar__tab ${
            activeTab === "templates" ? "chatcanvas-sidebar__tab--active" : ""
          }`}
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </button>
        <button
          className={`chatcanvas-sidebar__tab ${
            activeTab === "layers" ? "chatcanvas-sidebar__tab--active" : ""
          }`}
          onClick={() => setActiveTab("layers")}
        >
          Layers
        </button>
      </div>

      {/* Content */}
      <div className="chatcanvas-sidebar__content">
        {activeTab === "templates" && (
          <div className="chatcanvas-sidebar__templates">
            {getAvailableTemplates().map((template) => (
              <div
                key={template.id}
                className="chatcanvas-sidebar__template-item"
                onClick={() => onLoadTemplate?.(template)}
              >
                <div className="chatcanvas-sidebar__template-thumbnail">
                  {template.thumbnail}
                </div>
                <div className="chatcanvas-sidebar__template-info">
                  <div className="chatcanvas-sidebar__template-name">
                    {template.name}
                  </div>
                  <div className="chatcanvas-sidebar__template-desc">
                    {template.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "layers" && (
          <div className="chatcanvas-sidebar__layers">
            <p className="chatcanvas-sidebar__placeholder">
              Layers panel coming soon
            </p>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="chatcanvas-sidebar__resizer"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

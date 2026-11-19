import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { EditIcon, DuplicateIcon, TrashIcon } from "./icons";

interface SheetMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  anchorRect: DOMRect | null;
  coords?: { x: number; y: number } | null;
  isDark?: boolean;
}

export const SheetMenu: React.FC<SheetMenuProps> = ({
  isOpen,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  anchorRect,
  coords,
  isDark,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const doc = menuRef.current?.ownerDocument || document;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    doc.addEventListener("pointerdown", handlePointerDown, true);
    doc.addEventListener("keydown", handleKeyDown, true);

    return () => {
      doc.removeEventListener("pointerdown", handlePointerDown, true);
      doc.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const doc = document;
  const win = doc.defaultView || window;
  const viewportHeight = win.innerHeight;
  const viewportWidth = win.innerWidth;

  const MENU_WIDTH = 152;
  let positionStyle: React.CSSProperties = {};

  if (coords) {
    const bottom = Math.max(12, viewportHeight - coords.y + 8);
    const left = Math.max(
      12,
      Math.min(coords.x - MENU_WIDTH / 2, viewportWidth - MENU_WIDTH - 12),
    );
    positionStyle = {
      position: "fixed",
      bottom: `${bottom}px`,
      left: `${left}px`,
    };
  } else if (anchorRect) {
    const bottom = Math.max(12, viewportHeight - anchorRect.top + 8);
    let left = anchorRect.left + anchorRect.width / 2 - MENU_WIDTH / 2;
    left = Math.max(12, Math.min(left, viewportWidth - MENU_WIDTH - 12));
    positionStyle = {
      position: "fixed",
      bottom: `${bottom}px`,
      left: `${left}px`,
    };
  }

  return createPortal(
    <div className={clsx("excalidraw", { "theme--dark": isDark })}>
      <div
        className="sheet-menu"
        ref={menuRef}
        style={positionStyle}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="sheet-menu__item"
          role="menuitem"
          onClick={() => {
            onClose();
            onRename();
          }}
        >
          <span className="sheet-menu__icon">
            <EditIcon />
          </span>
          <span className="sheet-menu__label">Rename</span>
        </button>

        <button
          type="button"
          className="sheet-menu__item"
          role="menuitem"
          onClick={() => {
            onClose();
            onDuplicate();
          }}
        >
          <span className="sheet-menu__icon">
            <DuplicateIcon />
          </span>
          <span className="sheet-menu__label">Duplicate</span>
        </button>

        <div className="sheet-menu__separator" />

        <button
          type="button"
          className="sheet-menu__item sheet-menu__item--danger"
          role="menuitem"
          onClick={() => {
            onClose();
            onDelete();
          }}
        >
          <span className="sheet-menu__icon">
            <TrashIcon />
          </span>
          <span className="sheet-menu__label">Delete</span>
        </button>
      </div>
    </div>,
    doc.body,
  );
};

import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { ChevronDownIcon } from "./icons";

import type { SheetMetadata } from "../../data/sheetStorage";

interface SheetTabProps {
  sheet: SheetMetadata;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (newTitle: string) => void;
  onCancelRename: () => void;
  onOpenMenu: (rect: DOMRect, coords?: { x: number; y: number }) => void;
}

export const SheetTab: React.FC<SheetTabProps> = ({
  sheet,
  isActive,
  isEditing,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
}) => {
  const [editValue, setEditValue] = useState(sheet.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const isCanceledRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setEditValue(sheet.title);
      isCanceledRef.current = false;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [isEditing, sheet.title]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommitRename(editValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      isCanceledRef.current = true;
      onCancelRename();
    }
  };

  const handleBlur = () => {
    if (!isCanceledRef.current) {
      onCommitRename(editValue);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (tabRef.current) {
      onOpenMenu(tabRef.current.getBoundingClientRect(), {
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  const handleMenuButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabRef.current) {
      onOpenMenu(tabRef.current.getBoundingClientRect());
    }
  };

  return (
    <div
      ref={tabRef}
      className={clsx("sheet-tab", {
        "sheet-tab--active": isActive,
        "sheet-tab--editing": isEditing,
      })}
      onClick={() => {
        if (!isEditing) {
          onSelect();
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartRename();
      }}
      onContextMenu={handleContextMenu}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          onSelect();
        }
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="sheet-tab__input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="sheet-tab__title" title={sheet.title}>
          {sheet.title}
        </span>
      )}

      <button
        ref={menuBtnRef}
        type="button"
        className="sheet-tab__menu-btn"
        aria-label={`Options for ${sheet.title}`}
        title="Sheet options"
        onClick={handleMenuButtonClick}
      >
        <ChevronDownIcon />
      </button>
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from "react";

import { useAtom, useAtomValue } from "../app-jotai";
import { activeTabIdAtom, tabsAtom } from "../tabs-atoms";

import { DocumentStore } from "../data/DocumentStore";
import { LocalData } from "../data/LocalData";
import {
  activateTab,
  createBlankTab,
  getNextDefaultTabName,
  saveTabsMetadata,
} from "../data/tabsStore";

import "./TabBar.scss";

import type { Tab } from "../data/tabsStore";

const MAX_NAME_LENGTH = 60;

export const useTabActions = () => {
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTabId] = useAtom(activeTabIdAtom);

  const persistTabs = useCallback(
    (next: Tab[]) => {
      setTabs(next);
      saveTabsMetadata(next);
    },
    [setTabs],
  );

  const switchToTab = useCallback(
    (id: string) => {
      if (id === activeTabId) {
        return;
      }
      activateTab(id);
    },
    [activeTabId],
  );

  const newTab = useCallback(() => {
    const tab = createBlankTab(getNextDefaultTabName(tabs));
    const next = [...tabs, tab];
    persistTabs(next);
    activateTab(tab.id);
    return tab;
  }, [tabs, persistTabs]);

  const renameTab = useCallback(
    (id: string, rawName: string) => {
      const name =
        rawName.trim().slice(0, MAX_NAME_LENGTH) ||
        tabs.find((t) => t.id === id)?.name ||
        "Untitled";
      const next = tabs.map((t) =>
        t.id === id ? { ...t, name, updatedAt: Date.now() } : t,
      );
      persistTabs(next);
    },
    [tabs, persistTabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) {
        return;
      }

      const remaining = tabs.filter((t) => t.id !== id);

      // Drop any pending save targeted at the doc we're about to delete to
      // avoid resurrecting it via a debounced write after deletion.
      if (id === activeTabId) {
        LocalData.cancelSave();
      }

      // If closing the last tab, replace with a fresh empty drawing
      if (remaining.length === 0) {
        const replacement = createBlankTab("Drawing 1");
        persistTabs([replacement]);
        activateTab(replacement.id);
        DocumentStore.deleteDocument(id);
        return;
      }

      persistTabs(remaining);

      if (id === activeTabId) {
        // Activate the tab that takes the closed tab's slot, falling back to
        // the previous one when closing the rightmost tab.
        const nextActive = remaining[Math.min(idx, remaining.length - 1)];
        activateTab(nextActive.id);
      }

      DocumentStore.deleteDocument(id);
    },
    [tabs, activeTabId, persistTabs],
  );

  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= tabs.length ||
        toIndex >= tabs.length
      ) {
        return;
      }
      const next = tabs.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persistTabs(next);
    },
    [tabs, persistTabs],
  );

  return {
    tabs,
    activeTabId,
    switchToTab,
    newTab,
    closeTab,
    renameTab,
    reorderTabs,
  };
};

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M7 2v10M2 7h10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2 2l6 6M8 2l-6 6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

type TabItemProps = {
  tab: Tab;
  index: number;
  isActive: boolean;
  isOnlyTab: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDropTarget: boolean;
};

const TabItem = ({
  tab,
  index,
  isActive,
  isOnlyTab,
  onSelect,
  onClose,
  onRename,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDropTarget,
}: TabItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(tab.name);
    }
  }, [tab.name, isEditing]);

  const commit = () => {
    if (draft.trim() && draft !== tab.name) {
      onRename(draft);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(tab.name);
    setIsEditing(false);
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      className={`excalidraw-tabbar__tab${
        isActive ? " excalidraw-tabbar__tab--active" : ""
      }${isDropTarget ? " excalidraw-tabbar__tab--drop-target" : ""}`}
      onClick={() => {
        if (!isEditing) {
          onSelect();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
      draggable={!isEditing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", tab.id);
        onDragStart(index);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
      title={tab.name}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          className="excalidraw-tabbar__input"
          value={draft}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              commit();
            } else if (event.key === "Escape") {
              cancel();
            }
          }}
        />
      ) : (
        <span className="excalidraw-tabbar__name">{tab.name}</span>
      )}
      {!isOnlyTab && !isEditing && (
        <button
          type="button"
          aria-label={`Close ${tab.name}`}
          className="excalidraw-tabbar__close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
};

type TabBarProps = {
  hidden?: boolean;
};

export const TabBar = ({ hidden = false }: TabBarProps) => {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const { switchToTab, newTab, closeTab, renameTab, reorderTabs } =
    useTabActions();

  const dragSourceRef = useRef<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragSourceRef.current = index;
  };

  const handleDragOver = (index: number) => {
    if (dragSourceRef.current === null) {
      return;
    }
    if (dropTargetIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragSourceRef.current !== null && dropTargetIndex !== null) {
      reorderTabs(dragSourceRef.current, dropTargetIndex);
    }
    dragSourceRef.current = null;
    setDropTargetIndex(null);
  };

  // Global keyboard shortcuts: Cmd/Ctrl+T new tab, Cmd/Ctrl+Shift+W close tab.
  // We deliberately use Shift+W instead of plain W because Cmd+W is "close
  // window" in the browser and isn't easily preventable on most browsers.
  useEffect(() => {
    if (hidden) {
      return undefined;
    }
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInputFocused =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (isInputFocused) {
        return;
      }
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) {
        return;
      }
      if (event.key.toLowerCase() === "t" && !event.shiftKey) {
        event.preventDefault();
        newTab();
      } else if (event.key.toLowerCase() === "w" && event.shiftKey) {
        event.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hidden, newTab, closeTab, activeTabId]);

  if (hidden) {
    return null;
  }

  const isOnlyTab = tabs.length <= 1;

  return (
    <div className="excalidraw-tabbar" role="tablist">
      <div className="excalidraw-tabbar__scroll">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            isOnlyTab={isOnlyTab}
            onSelect={() => switchToTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onRename={(name) => renameTab(tab.id, name)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            isDropTarget={dropTargetIndex === index}
          />
        ))}
      </div>
      <button
        type="button"
        className="excalidraw-tabbar__new"
        aria-label="New drawing"
        title="New drawing (Cmd/Ctrl+T)"
        onClick={() => newTab()}
      >
        <PlusIcon />
      </button>
    </div>
  );
};

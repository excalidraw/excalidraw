import React, { useEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import {
  activeCollectionDirtyAtom,
  activeSaveLocationAtom,
} from "../data/collectionUiAtoms";
import {
  lastSavedAtAtom,
  saveErrorMessageAtom,
  saveStatusAtom,
} from "../data/saveStatusAtoms";
import { CollectionStore } from "../data/collections/CollectionStore";

import "./SaveStatusIndicator.scss";

const formatRelativeTime = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return new Date(timestamp).toLocaleTimeString();
};

export type SaveStatusIndicatorProps = {
  onSaveActive?: () => void;
};

export const SaveStatusIndicator = ({
  onSaveActive,
}: SaveStatusIndicatorProps) => {
  const status = useAtomValue(saveStatusAtom);
  const lastSavedAt = useAtomValue(lastSavedAtAtom);
  const errorMessage = useAtomValue(saveErrorMessageAtom);
  const isDirty = useAtomValue(activeCollectionDirtyAtom);
  const saveLocation = useAtomValue(activeSaveLocationAtom);
  const fsSupported = CollectionStore.isFileSystemSupported();
  const [, tick] = useState(0);

  useEffect(() => {
    if (status !== "saved" || !lastSavedAt) {
      return;
    }
    const id = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, [status, lastSavedAt]);

  const canClickSave =
    !!onSaveActive &&
    (status === "saved" || status === "error" || isDirty) &&
    status !== "saving";

  if (status === "idle" && !isDirty) {
    return null;
  }

  let label = "";
  let className = "save-status-indicator";

  switch (status) {
    case "saving":
      label = "Saving…";
      className += " save-status-indicator--saving";
      break;
    case "saved":
      if (isDirty) {
        label = "Unsaved changes";
        className += " save-status-indicator--dirty";
      } else {
        label = lastSavedAt
          ? `Saved · ${formatRelativeTime(lastSavedAt)}`
          : "Saved";
        className += " save-status-indicator--saved";
      }
      break;
    case "error":
      label = "Save failed";
      className += " save-status-indicator--error";
      break;
    default:
      if (isDirty) {
        label = "Unsaved changes";
        className += " save-status-indicator--dirty";
      }
      break;
  }

  const locationHint = saveLocation
    ? fsSupported
      ? saveLocation
      : `Browser · ${saveLocation}`
    : undefined;

  const title = [
    errorMessage,
    locationHint,
    canClickSave ? "Click to save" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const handleClick = () => {
    if (canClickSave) {
      onSaveActive?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (canClickSave && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSaveActive?.();
    }
  };

  return (
    <span
      className={className}
      title={title || undefined}
      aria-live="polite"
      role={canClickSave ? "button" : undefined}
      tabIndex={canClickSave ? 0 : undefined}
      onClick={canClickSave ? handleClick : undefined}
      onKeyDown={canClickSave ? handleKeyDown : undefined}
    >
      {label}
      {locationHint && !isDirty && status === "saved" && (
        <span className="save-status-indicator__path">{locationHint}</span>
      )}
    </span>
  );
};

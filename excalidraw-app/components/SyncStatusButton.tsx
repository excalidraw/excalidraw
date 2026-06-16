import { Button } from "@excalidraw/excalidraw/components/Button";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import "./SyncStatusButton.scss";

import type { SyncRole } from "../data/supabase/lockAtom";
import type { SyncStatus } from "../data/supabase/syncStatusAtom";

export interface SyncStatusButtonProps {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error?: string | null;
  onSyncNow: () => void;
  isSignedIn: boolean;
  onRequestSignIn: () => void;
  /**
   * The single-writer/multi-reader role of this session. `"writer"` ⇒ the normal status pill;
   * `"reader"` ⇒ a distinct muted "Read-only" pill that offers "Take over editing". Optional +
   * defaults to `"writer"` so the existing (non-reader-aware) call sites are unchanged.
   */
  role?: SyncRole;
  /** reader action: request the current writer hand off the lock (decision #2). */
  onTakeOver?: () => void;
  /** `true` while THIS session is waiting to become the writer — disables/relabels the action. */
  takeoverInFlight?: boolean;
}

interface StatusPresentation {
  glyph: string;
  label: string;
  modifier: string;
}

const getPresentation = (
  status: SyncStatus,
  isSignedIn: boolean,
  role: SyncRole,
): StatusPresentation => {
  if (!isSignedIn) {
    return { glyph: "🔑", label: "Sign in to sync", modifier: "--idle" };
  }

  // A reader is HARD read-only (viewModeEnabled); surface a distinct, muted pill regardless of the
  // push-pipeline status (which is orthogonal to role).
  if (role === "reader") {
    return { glyph: "👁", label: "Read-only", modifier: "--reader" };
  }

  switch (status) {
    case "syncing":
      return { glyph: "◴", label: "Syncing…", modifier: "--syncing" };
    case "synced":
      return { glyph: "✓", label: "Synced", modifier: "--synced" };
    case "error":
      return { glyph: "⚠", label: "Sync error", modifier: "--error" };
    case "offline":
      return { glyph: "⦸", label: "Offline", modifier: "--offline" };
    case "idle":
    default:
      return { glyph: "✓", label: "Synced", modifier: "--idle" };
  }
};

const formatTime = (lastSyncedAt: number | null): string | null => {
  if (lastSyncedAt == null) {
    return null;
  }
  return new Date(lastSyncedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const SyncStatusButton = ({
  status,
  lastSyncedAt,
  error,
  onSyncNow,
  isSignedIn,
  onRequestSignIn,
  role = "writer",
  onTakeOver,
  takeoverInFlight = false,
}: SyncStatusButtonProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // close the popover when clicking outside of it
  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const presentation = getPresentation(status, isSignedIn, role);
  const formattedTime = formatTime(lastSyncedAt);
  const isReader = isSignedIn && role === "reader";

  const handleSyncNow = () => {
    onSyncNow();
    setOpen(false);
  };

  const handleSignIn = () => {
    onRequestSignIn();
    setOpen(false);
  };

  const handleTakeOver = () => {
    onTakeOver?.();
    // keep the popover open so the user sees the "Requesting…" feedback in place.
  };

  return (
    <div className="excalidraw-sync-status-button" ref={containerRef}>
      <Button
        className={clsx(
          "excalidraw-sync-status-button__pill",
          `excalidraw-sync-status-button__pill${presentation.modifier}`,
        )}
        type="button"
        onSelect={() => setOpen((prev) => !prev)}
        aria-label={presentation.label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={presentation.label}
      >
        {status === "syncing" && isSignedIn && !isReader ? (
          <span
            className="excalidraw-sync-status-button__spinner"
            aria-hidden="true"
          />
        ) : (
          <span
            className="excalidraw-sync-status-button__glyph"
            aria-hidden="true"
          >
            {presentation.glyph}
          </span>
        )}
        <span className="excalidraw-sync-status-button__label">
          {presentation.label}
        </span>
        <span
          className="excalidraw-sync-status-button__caret"
          aria-hidden="true"
        >
          ▾
        </span>
      </Button>

      {open && (
        <div
          className="excalidraw-sync-status-popover"
          role="menu"
          aria-label="Sync options"
        >
          <div className="excalidraw-sync-status-popover__time">
            {isReader
              ? "Editing is active on another session"
              : formattedTime
              ? `Last synced: ${formattedTime}`
              : "Not synced yet"}
          </div>
          <div className="excalidraw-sync-status-popover__separator" />
          {!isSignedIn ? (
            <button
              type="button"
              role="menuitem"
              className="excalidraw-sync-status-popover__item"
              onClick={handleSignIn}
            >
              <span aria-hidden="true">🔑</span> Sign in to sync
            </button>
          ) : isReader ? (
            <button
              type="button"
              role="menuitem"
              className="excalidraw-sync-status-popover__item excalidraw-sync-status-popover__item--takeover"
              onClick={handleTakeOver}
              disabled={takeoverInFlight}
            >
              <span aria-hidden="true">✎</span>{" "}
              {takeoverInFlight ? "Requesting…" : "Take over editing"}
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="excalidraw-sync-status-popover__item"
              onClick={handleSyncNow}
              disabled={status === "syncing"}
            >
              <span aria-hidden="true">↻</span> Sync now
            </button>
          )}
          {status === "error" && error && !isReader && (
            <div className="excalidraw-sync-status-popover__error" role="alert">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

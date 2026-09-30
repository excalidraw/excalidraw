import type { SaveState } from "./AutosaveEngine";

const LABEL: Record<SaveState, string> = {
  idle: "Saved",
  dirty: "Unsaved changes…",
  saving: "Saving…",
  saved: "All changes saved",
  offline: "Offline — changes kept locally, will retry",
  error: "Could not save",
};

export const SaveIndicator = ({
  state,
  detail,
  online,
  onRetry,
  live,
}: {
  state: SaveState;
  detail?: string;
  online: boolean;
  onRetry: () => void;
  /** a live session is persisting the scene on the server */
  live?: boolean;
}) => {
  const shown: SaveState =
    live && (state === "dirty" || state === "idle") ? "saved" : state;
  const tone =
    shown === "error"
      ? "bad"
      : shown === "offline" || !online
      ? "warn"
      : shown === "saving" || shown === "dirty"
      ? "busy"
      : "ok";
  const label =
    !online && shown !== "error"
      ? "You are offline — changes kept locally"
      : live && shown === "saved"
      ? "Live — saved automatically"
      : LABEL[shown];
  return (
    <div
      className={`save-ind ${tone}`}
      role="status"
      aria-live="polite"
      title={detail}
    >
      <span className="dot" />
      <span>{label}</span>
      {(shown === "offline" || shown === "error") && (
        <button className="link-btn" onClick={onRetry}>
          Retry
        </button>
      )}
      {shown === "error" && detail && (
        <span className="muted small"> · {detail}</span>
      )}
    </div>
  );
};

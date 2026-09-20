import "./DurabilityToast.css";

interface DurabilityToastProps {
  templateLabel: string;
  onDownload: () => void;
  onRegenerate: () => void;
  onDismiss: () => void;
}

// Post-generation save nudge: browser storage can be cleared unexpectedly
// (see the source-of-truth doc's KPI section), so this makes local
// persistence legible without gating anything on signup.
export function DurabilityToast({
  templateLabel,
  onDownload,
  onRegenerate,
  onDismiss,
}: DurabilityToastProps) {
  return (
    <div className="durability-toast">
      <span className="durability-toast__text">
        Your {templateLabel.toLowerCase()} is saved in this browser. Download
        a copy to keep it anywhere else.
      </span>
      <div className="durability-toast__actions">
        <button type="button" onClick={onDownload}>
          Download .excalidraw
        </button>
        <button type="button" onClick={onRegenerate}>
          Regenerate
        </button>
        <button
          type="button"
          className="durability-toast__dismiss"
          onClick={onDismiss}
        >
          dismiss
        </button>
      </div>
    </div>
  );
}

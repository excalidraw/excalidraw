import "./ReadOnlyBanner.scss";

export interface ReadOnlyBannerProps {
  /** reader action: request the current writer hand off the lock (decision #2). */
  onTakeOver: () => void;
  /** `true` while THIS session is waiting to become the writer — disables/relabels the button. */
  takeoverInFlight?: boolean;
  /** optional label for who/where editing is active (e.g. "another session"). */
  writerLabel?: string | null;
}

/**
 * Small, unobtrusive top-center banner shown to a reader (single-writer/multi-reader sync). It
 * explains why the canvas is read-only and offers "Take over editing". Purely presentational —
 * props in, callback out; no engine/hook import. The App renders it only under the feature flag +
 * `role === "reader"`.
 */
export const ReadOnlyBanner = ({
  onTakeOver,
  takeoverInFlight = false,
  writerLabel,
}: ReadOnlyBannerProps) => {
  return (
    <div className="excalidraw-readonly-banner" role="status">
      <span className="excalidraw-readonly-banner__glyph" aria-hidden="true">
        👁
      </span>
      <span className="excalidraw-readonly-banner__text">
        Read-only — editing is active on{" "}
        {writerLabel ? writerLabel : "another session"}
      </span>
      <button
        type="button"
        className="excalidraw-readonly-banner__action"
        onClick={onTakeOver}
        disabled={takeoverInFlight}
      >
        {takeoverInFlight ? "Requesting…" : "Take over editing"}
      </button>
    </div>
  );
};

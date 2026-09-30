import { useMemo, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { report } from "../api/telemetry";
import { useAuth } from "../auth/AuthProvider";
import {
  downloadBlob,
  exportPdf,
  NothingToExportError,
  safeFileName,
} from "../export/pdf";
import { exportPptx } from "../export/pptx";
import { getSlideElements } from "../presentation/slides";

import { Modal } from "./Modal";

import type { PdfScope } from "../export/pdf";
import type { PptxMode } from "../export/pptx";

type Format = "pdf" | "pptx";

export const ExportDialog = ({
  api,
  title,
  onClose,
}: {
  api: ExcalidrawImperativeAPI;
  title: string;
  onClose: () => void;
}) => {
  const { features } = useAuth();
  const pptxEnabled = features?.pptxExport === true;
  const live = useMemo(() => api.getSceneElements(), [api]);
  const frames = useMemo(() => getSlideElements(live).length, [live]);
  const selected = Object.keys(api.getAppState().selectedElementIds).length;

  const [format, setFormat] = useState<Format>("pdf");
  const [pptxMode, setPptxMode] = useState<PptxMode>("editable");
  const [scope, setScope] = useState<PdfScope>(frames > 0 ? "frames" : "scene");
  const [background, setBackground] = useState(true);
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // PowerPoint has no "selection" notion: fall back to the whole canvas
  const effectiveScope: PdfScope =
    format === "pptx" && scope === "selection" ? "scene" : scope;

  const run = async () => {
    setError(null);
    setBusy({
      done: 0,
      total: effectiveScope === "frames" ? frames || 1 : 1,
    });
    const onProgress = (done: number, total: number) =>
      setBusy({ done, total });
    try {
      const state = api.getAppState();
      const common = {
        elements: api.getSceneElements(),
        files: api.getFiles(),
        appState: state,
        background,
        title,
        onProgress,
      };
      const blob =
        format === "pdf"
          ? await exportPdf({
              ...common,
              scope: effectiveScope,
              selectedIds: Object.keys(state.selectedElementIds),
              darkMode: dark,
            })
          : await exportPptx({
              ...common,
              scope: effectiveScope === "frames" ? "frames" : "scene",
              mode: pptxMode,
            });
      downloadBlob(blob, safeFileName(title, format));
      onClose();
    } catch (e: any) {
      report("export_failure", e?.message ?? String(e), { format });
      setError(
        e instanceof NothingToExportError
          ? e.message
          : `Export failed: ${e?.message ?? e}`,
      );
      setBusy(null);
    }
  };

  return (
    <Modal title="Export" onClose={busy ? () => {} : onClose}>
      <div className="form" style={{ border: "none", padding: 0 }}>
        {pptxEnabled && (
          <div
            className="seg"
            style={{ alignSelf: "flex-start", marginLeft: 0 }}
            role="tablist"
          >
            <button
              className={format === "pdf" ? "on" : ""}
              onClick={() => setFormat("pdf")}
              disabled={!!busy}
            >
              PDF
            </button>
            <button
              className={format === "pptx" ? "on" : ""}
              onClick={() => setFormat("pptx")}
              disabled={!!busy}
            >
              PowerPoint
            </button>
          </div>
        )}
        <p className="muted small">
          {format === "pdf"
            ? "Vector PDF: shapes, arrows and text stay sharp at any zoom, images are embedded, and text remains searchable."
            : "Each frame becomes a slide (in slide order). Editable mode uses real PowerPoint shapes, text boxes and connectors; the hand-drawn look is simplified and fonts are mapped to common ones."}
        </p>
        {format === "pptx" && (
          <label>
            Fidelity
            <select
              value={pptxMode}
              onChange={(e) => setPptxMode(e.target.value as PptxMode)}
              disabled={!!busy}
            >
              <option value="editable">Editable shapes (recommended)</option>
              <option value="picture">
                Exact appearance (one picture per slide)
              </option>
            </select>
          </label>
        )}
        <label>
          What to export
          <select
            value={effectiveScope}
            onChange={(e) => setScope(e.target.value as PdfScope)}
            disabled={!!busy}
          >
            <option value="frames" disabled={frames === 0}>
              Each frame as a {format === "pdf" ? "page" : "slide"}
              {frames
                ? ` (${frames} ${
                    frames === 1 ? "item" : "items"
                  }, in slide order)`
                : " — no frames in this scene"}
            </option>
            <option value="scene">Whole canvas on one page</option>
            {format === "pdf" && (
              <option value="selection" disabled={selected === 0}>
                Current selection
                {selected
                  ? ` (${selected} element${selected === 1 ? "" : "s"})`
                  : " — nothing selected"}
              </option>
            )}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={background}
            onChange={(e) => setBackground(e.target.checked)}
            disabled={!!busy}
          />
          Include background
        </label>
        {format === "pdf" && (
          <label className="check">
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
              disabled={!!busy}
            />
            Dark mode colours
          </label>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {busy && (
          <div className="notice" role="status">
            Rendering page {Math.min(busy.done + 1, busy.total)} of {busy.total}
            …
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose} disabled={!!busy}>
          Cancel
        </button>
        <button className="btn primary" onClick={run} disabled={!!busy}>
          {busy
            ? "Exporting…"
            : format === "pdf"
            ? "Export PDF"
            : "Export PowerPoint"}
        </button>
      </div>
    </Modal>
  );
};

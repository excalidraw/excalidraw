import { useState } from "react";

const BACKEND_URL =
  import.meta.env.VITE_TERRAFORM_BACKEND_URL || "http://localhost:3000";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "rendering"; uploadId: number }
  | { kind: "ready"; uploadId: number }
  | { kind: "error"; message: string };

type Props = {
  onSceneLoaded: (scene: unknown) => void;
  onError?: (message: string) => void;
  hasScene: boolean;
  dependencyLayerEnabled: boolean;
  dataFlowLayerEnabled: boolean;
  hasSelectedExplodeTarget: boolean;
  onToggleDependency: () => void;
  onToggleDataFlow: () => void;
  onExplodeSelected: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export function UploadPanel({
  onSceneLoaded,
  onError,
  hasScene,
  dependencyLayerEnabled,
  dataFlowLayerEnabled,
  hasSelectedExplodeTarget,
  onToggleDependency,
  onToggleDataFlow,
  onExplodeSelected,
  onExpandAll,
  onCollapseAll,
}: Props) {
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [dotFile, setDotFile] = useState<File | null>(null);
  const [stateFile, setStateFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const hasPlanAndDot = Boolean(planFile && dotFile);
  const canImport =
    hasPlanAndDot || Boolean(stateFile && !planFile && !dotFile);

  const setError = (message: string) => {
    setStatus({ kind: "error", message });
    onError?.(message);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((planFile && !dotFile) || (!planFile && dotFile)) {
      setError(
        "Select plan JSON and DOT together, or clear both and upload raw Terraform state alone.",
      );
      return;
    }
    if (!canImport) {
      setError(
        "Upload plan+DOT (optional state), or a raw state JSON file alone.",
      );
      return;
    }

    try {
      setStatus({ kind: "uploading" });
      const fd = new FormData();
      if (hasPlanAndDot) {
        fd.append("planFile", planFile!);
        fd.append("dotFile", dotFile!);
      }
      if (stateFile) {
        fd.append("stateFile", stateFile);
      }

      const uploadRes = await fetch(`${BACKEND_URL}/terraform/upload`, {
        method: "POST",
        body: fd,
      });
      const uploadBody = (await uploadRes.json().catch(() => ({}))) as {
        error?: string;
        id?: number;
      };
      if (!uploadRes.ok) {
        throw new Error(
          uploadBody.error || `Upload failed: ${uploadRes.status}`,
        );
      }
      const { id } = uploadBody;
      if (typeof id !== "number") {
        throw new Error("Upload response missing id");
      }

      setStatus({ kind: "rendering", uploadId: id });
      const sceneRes = await fetch(
        `${BACKEND_URL}/terraform/upload/${id}/render/tldraw`,
      );
      if (!sceneRes.ok) {
        throw new Error(`Render failed: ${sceneRes.status}`);
      }
      const scene = await sceneRes.json();
      onSceneLoaded(scene);
      setStatus({ kind: "ready", uploadId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const busy = status.kind === "uploading" || status.kind === "rendering";

  return (
    <form className="upload" onSubmit={handleSubmit}>
      <label>
        plan JSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label>
        DOT graph
        <input
          type="file"
          accept=".dot,.gv,text/vnd.graphviz"
          onChange={(e) => setDotFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label>
        state (optional with plan+dot, or alone for state-only)
        <input
          type="file"
          accept=".tfstate,.json,application/json"
          onChange={(e) => setStateFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={busy || !canImport}>
        {status.kind === "uploading"
          ? "Uploading…"
          : status.kind === "rendering"
          ? "Rendering…"
          : "Import"}
      </button>
      <button type="button" disabled={!hasScene} onClick={onToggleDependency}>
        {dependencyLayerEnabled ? "Hide Dependency" : "Show Dependency"}
      </button>
      <button type="button" disabled={!hasScene} onClick={onToggleDataFlow}>
        {dataFlowLayerEnabled ? "Hide Data Flow" : "Show Data Flow"}
      </button>
      <button
        type="button"
        disabled={!hasScene || !hasSelectedExplodeTarget}
        onClick={onExplodeSelected}
      >
        Explode Selected
      </button>
      <button type="button" disabled={!hasScene} onClick={onExpandAll}>
        Expand All
      </button>
      <button type="button" disabled={!hasScene} onClick={onCollapseAll}>
        Collapse All
      </button>
      <span
        className={`status${status.kind === "error" ? " error" : ""}`}
        title={BACKEND_URL}
      >
        {status.kind === "idle" && `backend: ${BACKEND_URL}`}
        {status.kind === "ready" && `loaded upload #${status.uploadId}`}
        {status.kind === "error" && status.message}
      </span>
    </form>
  );
}

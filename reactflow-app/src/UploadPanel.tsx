import { useState } from "react";
import type { Edge, Node } from "@xyflow/react";

const BACKEND_URL =
  import.meta.env.VITE_TERRAFORM_BACKEND_URL || "http://localhost:3000";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "rendering"; uploadId: number }
  | { kind: "ready"; uploadId: number }
  | { kind: "error"; message: string };

export type ReactFlowScene = {
  nodes?: Node[];
  edges?: Edge[];
  meta?: {
    edgePolicy?: string;
    layoutEngine?: string;
  };
};

type Props = {
  onSceneLoaded: (scene: ReactFlowScene) => void;
};

export function UploadPanel({ onSceneLoaded }: Props) {
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [dotFile, setDotFile] = useState<File | null>(null);
  const [stateFile, setStateFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const hasPlanAndDot = Boolean(planFile && dotFile);
  const canImport = hasPlanAndDot || Boolean(stateFile && !planFile && !dotFile);

  const setError = (message: string) => {
    setStatus({ kind: "error", message });
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
      setError("Upload plan+DOT (optional state), or a raw state JSON file alone.");
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
        throw new Error(uploadBody.error || `Upload failed: ${uploadRes.status}`);
      }
      const { id } = uploadBody;
      if (typeof id !== "number") {
        throw new Error("Upload response missing id");
      }

      setStatus({ kind: "rendering", uploadId: id });
      const sceneRes = await fetch(
        `${BACKEND_URL}/terraform/upload/${id}/render/reactflow`,
      );
      if (!sceneRes.ok) throw new Error(`Render failed: ${sceneRes.status}`);
      const scene = (await sceneRes.json()) as ReactFlowScene;
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
          ? "Uploading..."
          : status.kind === "rendering"
            ? "Rendering..."
            : "Import"}
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

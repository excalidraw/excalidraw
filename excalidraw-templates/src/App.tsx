import { useState } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { TemplateStrip } from "./components/TemplateStrip";
import { PromptPanel } from "./components/PromptPanel";
import { DurabilityToast } from "./components/DurabilityToast";
import { EventsDebugPanel } from "./components/EventsDebugPanel";
import type { Template } from "./templates/registry";
import {
  insertDiagram,
  parseDiagram,
  commitDiagram,
} from "./lib/insertDiagram";
import { generate } from "./lib/generate";
import { track } from "./lib/events";
import { generateWithRepair as runGenerateWithRepair } from "./lib/generateWithRepair";
import type { FallbackReason } from "./lib/generateWithRepair";

const IMAGE_FALLBACK_ERROR =
  "The diagram came back as a flat image instead of editable shapes, which usually means an unsupported mermaid diagram type was used.";

function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [isSceneEmpty, setIsSceneEmpty] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [durabilityTemplate, setDurabilityTemplate] =
    useState<Template | null>(null);

  // Tries to turn `mermaid` into a committed scene. Never commits a result
  // with a non-empty files map (the mermaid-to-excalidraw image-fallback
  // case from docs/spike-mermaid.md) — that's treated the same as a parse
  // failure, since it isn't the editable diagram the user asked for.
  const tryInsert = async (
    mermaid: string,
  ): Promise<{ ok: true } | { ok: false; errorMessage: string }> => {
    try {
      const parsed = await parseDiagram(mermaid);
      if (parsed.filesCount > 0) {
        return { ok: false, errorMessage: IMAGE_FALLBACK_ERROR };
      }
      if (excalidrawAPI) commitDiagram(excalidrawAPI, parsed);
      return { ok: true };
    } catch (err) {
      return { ok: false, errorMessage: (err as Error).message };
    }
  };

  const showDurabilityFor = (template: Template) => {
    setDurabilityTemplate(template);
    track("durability_shown", { templateId: template.id });
  };

  const reasonToBannerText = (reason: FallbackReason): string => {
    if (reason.type === "initial_generate_failed") {
      return `Couldn't reach the diagram generator (${reason.error}).`;
    }
    return "That description was hard to turn into a diagram.";
  };

  // Retry policy lives in lib/generateWithRepair.ts, decoupled from React
  // state so its branching is unit-tested directly. This wires it to the
  // real generate()/canvas/analytics and turns the outcome into UI state.
  const generateWithRepair = async (template: Template, prompt: string) => {
    if (!excalidrawAPI) return;
    setIsGenerating(true);
    setBanner(null);

    try {
      const outcome = await runGenerateWithRepair(
        {
          generate,
          tryInsert,
          insertFallback: async (t) => {
            await insertDiagram(excalidrawAPI, t.fallback);
          },
          track,
        },
        template,
        prompt,
      );

      if (outcome.kind === "success") {
        showDurabilityFor(template);
        return;
      }

      const reasonText = reasonToBannerText(outcome.reason);
      setBanner(
        `${reasonText} We started you with a basic ${template.label.toLowerCase()} instead.`,
      );
    } finally {
      setIsGenerating(false);
      setSelectedTemplate(null);
    }
  };

  const handleDownload = () => {
    if (!excalidrawAPI || !durabilityTemplate) return;
    const json = serializeAsJSON(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
      "local",
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${durabilityTemplate.id}.excalidraw`;
    a.click();
    URL.revokeObjectURL(url);
    track("file_downloaded", { templateId: durabilityTemplate.id });
  };

  const handleRegenerate = () => {
    if (!durabilityTemplate) return;
    track("regenerate_clicked", { templateId: durabilityTemplate.id });
    setSelectedTemplate(durabilityTemplate);
    setDurabilityTemplate(null);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={(elements) => setIsSceneEmpty(elements.length === 0)}
      />

      {selectedTemplate ? (
        <PromptPanel
          template={selectedTemplate}
          isSubmitting={isGenerating}
          onSubmit={(prompt) => generateWithRepair(selectedTemplate, prompt)}
          onCancel={() => setSelectedTemplate(null)}
        />
      ) : (
        <TemplateStrip
          isSceneEmpty={isSceneEmpty}
          onSelectTemplate={(template) => {
            track("template_selected", { templateId: template.id });
            setSelectedTemplate(template);
          }}
        />
      )}

      {durabilityTemplate && (
        <DurabilityToast
          templateLabel={durabilityTemplate.label}
          onDownload={handleDownload}
          onRegenerate={handleRegenerate}
          onDismiss={() => setDurabilityTemplate(null)}
        />
      )}

      {banner && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            background: "#403e6a",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            maxWidth: 480,
            textAlign: "center",
            zIndex: 5,
          }}
        >
          {banner}
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{
              marginLeft: 12,
              background: "none",
              border: "none",
              color: "#fff",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            dismiss
          </button>
        </div>
      )}

      {import.meta.env.DEV && <EventsDebugPanel />}
    </div>
  );
}

export default App;

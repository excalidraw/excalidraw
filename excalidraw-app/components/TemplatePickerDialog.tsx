import React, { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";
import { t } from "@excalidraw/excalidraw/i18n";
import { exportToCanvas } from "@excalidraw/utils/export";

import type { NonDeleted } from "@excalidraw/element/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useLuzmoChartContext } from "../context/LuzmoChartContext";

import "./TemplatePickerDialog.scss";

const TEMPLATES = [
  {
    id: "01_incident_command_center",
    name: "Incident Command Center",
    description: "Incident Commander — live outage, system topology, AI brief",
  },
  {
    id: "02_growth_strategy_lab",
    name: "Growth Strategy Lab",
    description: "Head of Growth — funnel, cohort, channel performance",
  },
  {
    id: "03_executive_strategy_map",
    name: "Executive Strategy Map",
    description: "CEO — revenue, churn, pipeline, strategic notes",
  },
  {
    id: "04_customer_journey_experience_board",
    name: "Customer Journey Experience Board",
    description: "UX Lead — stage conversion, device drop-off, NPS",
  },
  {
    id: "05_workforce_health_observatory",
    name: "Workforce Health Observatory",
    description: "People Ops — attrition, hiring, engagement, diversity",
  },
  {
    id: "06_sprint_execution_arena",
    name: "Sprint Execution Arena",
    description: "Engineering Manager — burndown, velocity, Kanban, AI risk",
  },
  {
    id: "07_payments_risk_intelligence_board",
    name: "Payments Risk Intelligence Board",
    description: "Fraud & Risk Lead — fraud by region, failures, latency",
  },
  {
    id: "08_support_escalation_control_room",
    name: "Support Escalation Control Room",
    description: "Head of Support — Tier stack, heatmap, SLA, resolution",
  },
] as const;

const getTemplateUrl = (id: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = import.meta.env.BASE_URL || "/";
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `${origin}${base}templates/${id}.flexcalidraw`;
};

type PreviewStatus = "idle" | "loading" | "ready" | "error";

type TemplateType = typeof TEMPLATES[number];

const TemplatePreviewCard = ({
  template,
  onSelect,
  isDisabled,
  isApplying,
}: {
  template: TemplateType;
  onSelect: (id: string) => void;
  isDisabled: boolean;
  isApplying: boolean;
}) => {
  const cardRef = useRef<HTMLButtonElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const loadPreview = useCallback(async () => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    setPreviewStatus("loading");

    try {
      const url = getTemplateUrl(template.id);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const { elements, appState, files } = await loadFromBlob(
        blob,
        null,
        null,
        null,
      );

      const wrapper = previewWrapperRef.current;
      const width = wrapper?.offsetWidth ?? 400;
      const height = wrapper?.offsetHeight ?? 225;
      const maxDim = Math.max(width, height) * 2;

      const canvas = await exportToCanvas({
        elements: elements.filter(
          (el) => !el.isDeleted,
        ) as NonDeleted<ExcalidrawElement>[],
        appState: {
          exportBackground: true,
          viewBackgroundColor:
            (appState as { viewBackgroundColor?: string })
              .viewBackgroundColor || "#ffffff",
        },
        files: files ?? {},
        exportPadding: DEFAULT_EXPORT_PADDING,
        maxWidthOrHeight: maxDim,
      });

      const dataUrl = canvas.toDataURL("image/png");
      setPreviewDataUrl(dataUrl);
      setPreviewStatus("ready");
    } catch (e) {
      console.warn("Template preview failed:", e);
      setPreviewStatus("error");
    }
  }, [template.id]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPreview();
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadPreview]);

  return (
    <button
      ref={cardRef}
      type="button"
      className={`template-card${isApplying ? " template-card--applying" : ""}`}
      onClick={() => onSelect(template.id)}
      disabled={isDisabled}
      aria-label={`Use template: ${template.name}`}
      title={template.name}
    >
      <div className="template-card__preview" ref={previewWrapperRef}>
        {(previewStatus === "idle" || previewStatus === "loading") && (
          <div className="template-card__skeleton" />
        )}
        {previewStatus === "error" && (
          <div className="template-card__preview-error">
            <span>Preview unavailable</span>
          </div>
        )}
        {previewStatus === "ready" && previewDataUrl && (
          <img
            src={previewDataUrl}
            alt=""
            className="template-card__preview-img"
          />
        )}
        {isApplying && (
          <div className="template-card__applying-overlay">
            <div className="template-card__spinner" />
          </div>
        )}
      </div>
      <div className="template-card__info">
        <span className="template-card__name">{template.name}</span>
        <span className="template-card__desc">{template.description}</span>
      </div>
    </button>
  );
};

export const TemplatePickerDialog: React.FC = () => {
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const luzmoContext = useLuzmoChartContext();
  const excalidrawAPI = luzmoContext?.excalidrawAPI ?? null;
  const { TemplatePickerDialogTunnel } = useTunnels();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClose = useCallback(() => {
    setAppState({ openDialog: null });
    setError(null);
    setLoadingId(null);
  }, [setAppState]);

  const onSelectTemplate = useCallback(
    async (templateId: string) => {
      if (!excalidrawAPI) {
        setError("Editor not ready");
        return;
      }
      setLoadingId(templateId);
      setError(null);
      try {
        const url = getTemplateUrl(templateId);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.status}`);
        }
        const blob = await response.blob();
        const {
          elements,
          appState: loadedAppState,
          files,
        } = await loadFromBlob(
          blob,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElementsIncludingDeleted(),
          null,
        );
        excalidrawAPI.updateScene({
          elements,
          appState: loadedAppState,
        });
        if (files && Object.keys(files).length > 0) {
          excalidrawAPI.addFiles(Object.values(files));
        }
        // Center and zoom to fit the template content nicely in the viewport
        const elementsToFit = elements.filter((el) => !el.isDeleted);
        if (elementsToFit.length > 0) {
          excalidrawAPI.scrollToContent(elementsToFit);
        }
        onClose();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load template";
        setError(message);
      } finally {
        setLoadingId(null);
      }
    },
    [excalidrawAPI, onClose],
  );

  if (appState.openDialog?.name !== "templatePicker") {
    return null;
  }

  return (
    <TemplatePickerDialogTunnel.In>
      <Dialog
        onCloseRequest={onClose}
        title={t("templatePicker.title")}
        size="wide"
        className="template-picker-dialog"
      >
        <div className="template-picker-content">
          <p className="template-picker-subtitle">
            Pick a ready-made board to get started instantly.
          </p>
          {error && <div className="template-picker-error">{error}</div>}
          <div className="template-picker-grid">
            {TEMPLATES.map((template) => (
              <TemplatePreviewCard
                key={template.id}
                template={template}
                onSelect={onSelectTemplate}
                isDisabled={!!loadingId}
                isApplying={loadingId === template.id}
              />
            ))}
          </div>
        </div>
      </Dialog>
    </TemplatePickerDialogTunnel.In>
  );
};

import { exportToCanvas } from "@excalidraw/utils/export";
import React, { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  cloneJSON,
} from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import { prepareElementsForExport } from "../data";
import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { FilledButton } from "./FilledButton";

import "./TerraformImportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

export const ErrorCanvasPreview = () => {
    return (
      <div>
        <h3>{t("canvasError.cannotShowPreview")}</h3>
        <p>
          <span>{t("canvasError.canvasTooBig")}</span>
        </p>
        <em>({t("canvasError.canvasTooBigTip")})</em>
      </div>
    );
  };

type ImageExportModalProps = {
    appStateSnapshot: Readonly<UIAppState>;
    elementsSnapshot: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles;
    actionManager: ActionManager;
    onExportImage: AppClassProperties["onExportImage"];
    name: string;
};

const ImageExportModal = ({
    appStateSnapshot,
    elementsSnapshot,
    files,
    actionManager,
    onExportImage,
    name,
  }: ImageExportModalProps) => {
    const hasSelection = isSomeElementSelected(
      elementsSnapshot,
      appStateSnapshot,
    );
  
    const [projectName, setProjectName] = useState(name);
    const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
    const [exportWithBackground, setExportWithBackground] = useState(
      appStateSnapshot.exportBackground,
    );
    const [exportDarkMode, setExportDarkMode] = useState(
      appStateSnapshot.exportWithDarkMode,
    );
    const [embedScene, setEmbedScene] = useState(
      appStateSnapshot.exportEmbedScene,
    );
    const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);
  
    const previewRef = useRef<HTMLDivElement>(null);
    const [renderError, setRenderError] = useState<Error | null>(null);
  
    const { onCopy, copyStatus, resetCopyStatus } = useCopyStatus();

    const [ planFile, setPlanFile] = useState<File | null>(null);
    const [dotFile, setDotFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!planFile || !dotFile) return;
        setLoading(true);
        setError(null);
        try {
          const formData = new FormData();
          formData.append("planFile", planFile);
          formData.append("dotFile", dotFile);
          const res = await fetch("http://localhost:3000/terraform/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          console.log("Backend response:", data);
        } catch (err) {
          console.error("Backend error:", err);
          setError(err instanceof Error ? err.message : "Request failed");
        } finally {
          setLoading(false);
        }
    }

  
    useEffect(() => {
      // if user changes setting right after export to clipboard, reset the status
      // so they don't have to wait for the timeout to click the button again
      resetCopyStatus();
    }, [
      projectName,
      exportWithBackground,
      exportDarkMode,
      exportScale,
      embedScene,
      resetCopyStatus,
    ]);
  
    const { exportedElements, exportingFrame } = prepareElementsForExport(
      elementsSnapshot,
      appStateSnapshot,
      exportSelectionOnly,
    );
  
    useEffect(() => {
      const previewNode = previewRef.current;
      if (!previewNode) {
        return;
      }
      const maxWidth = previewNode.offsetWidth;
      const maxHeight = previewNode.offsetHeight;
      if (!maxWidth) {
        return;
      }
    }, [
      appStateSnapshot,
      files,
      exportedElements,
      exportingFrame,
      projectName,
      exportWithBackground,
      exportDarkMode,
      exportScale,
      embedScene,
    ]);
  
    return (
      <div className="TerraformImportModal">
        <h3>Import Terraform</h3>
        <div className="TerraformImportModal__settings__inputs">
          <input type="file" accept=".json" onChange={e => setPlanFile(e.target.files?.[0] ?? null)} />
          <input type="file" accept=".dot" onChange={e => setDotFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="TerraformImportModal__settings__buttons">
            <FilledButton 
                className="TerraformImportModal__settings__buttons__button"
                onClick={handleSubmit} 
                disabled={!planFile || !dotFile || loading}>
                Import
            </FilledButton>
        </div>
      </div>
    );
  };
  

export const TerraformImportDialog = ({
    elements,
    appState,
    files,
    actionManager,
    onExportImage,
    onCloseRequest,
    name,
  }: {
    appState: UIAppState;
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles;
    actionManager: ActionManager;
    onExportImage: AppClassProperties["onExportImage"];
    onCloseRequest: () => void;
    name: string;
  }) => {
    // we need to take a snapshot so that the exported state can't be modified
    // while the dialog is open
    const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
      return {
        appStateSnapshot: cloneJSON(appState),
        elementsSnapshot: cloneJSON(elements),
      };
    });
  
    return (
      <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
        <ImageExportModal
          elementsSnapshot={elementsSnapshot}
          appStateSnapshot={appStateSnapshot}
          files={files}
          actionManager={actionManager}
          onExportImage={onExportImage}
          name={name}
        />
      </Dialog>
    );
  };
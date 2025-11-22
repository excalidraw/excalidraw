/**
 * ImageToMermaidDialog
 * 
 * Main dialog for image-to-diagram conversion workflow.
 */

import React, { useState } from "react";
import { Dialog } from "./Dialog";
import { useAtom } from "../../../excalidraw-app/app-jotai";
import { imageToMermaidDialogOpenAtom, conversionProgressAtom, conversionResultAtom, showConfigPromptAtom, aiConfigDialogOpenAtom } from "../../../excalidraw-app/app-jotai";
import { imageProcessingService } from "../services/ImageProcessingService";
import { conversionOrchestrationService } from "../services/ConversionOrchestrationService";
import { aiConfigService } from "../services/AIConfigurationService";
import "./ImageToMermaidDialog.scss";

export const ImageToMermaidDialog: React.FC<{
  onInsertMermaid: (mermaidCode: string) => void;
}> = ({ onInsertMermaid }) => {
  const [isOpen, setIsOpen] = useAtom(imageToMermaidDialogOpenAtom);
  const [progress, setProgress] = useAtom(conversionProgressAtom);
  const [result, setResult] = useAtom(conversionResultAtom);
  const [, setShowConfigPrompt] = useAtom(showConfigPromptAtom);
  const [, setConfigDialogOpen] = useAtom(aiConfigDialogOpenAtom);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const processed = await imageProcessingService.processUploadedFiles(files);
      if (processed.length > 0) {
        setImagePreview(processed[0].dataUrl);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    try {
      const processed = await imageProcessingService.processClipboardImage(e.clipboardData);
      setImagePreview(processed.dataUrl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process clipboard image');
    }
  };

  const handleConvert = async () => {
    if (!imagePreview) return;

    // Check if configured
    const isConfigured = await aiConfigService.isConfigured();
    if (!isConfigured) {
      setShowConfigPrompt(true);
      setConfigDialogOpen(true);
      return;
    }

    try {
      setError(null);
      
      // Create processed image object
      const response = await fetch(imagePreview);
      const blob = await response.blob();
      const processedImage = {
        blob,
        dataUrl: imagePreview,
        format: blob.type,
        dimensions: { width: 0, height: 0 },
        size: blob.size,
        metadata: { source: 'upload' as const },
      };

      const mermaidCode = await conversionOrchestrationService.startConversion(
        processedImage,
        {
          progressCallback: (status) => setProgress(status),
        },
      );

      setResult(mermaidCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    }
  };

  const handleInsert = () => {
    if (result) {
      onInsertMermaid(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setImagePreview(null);
    setResult(null);
    setProgress(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <Dialog
      onCloseRequest={handleClose}
      title="Import Image to Diagram"
      className="image-to-mermaid-dialog"
    >
      <div className="dialog-content" onPaste={handlePaste}>
        {!imagePreview && !result && (
          <div className="upload-area">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              id="image-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="image-upload" className="upload-label">
              <div className="upload-icon">📷</div>
              <div className="upload-text">
                <strong>Click to upload</strong> or paste image (Ctrl+V)
              </div>
              <div className="upload-hint">
                Supports PNG, JPEG, WebP, GIF
              </div>
            </label>
          </div>
        )}

        {imagePreview && !result && (
          <div className="preview-area">
            <img src={imagePreview} alt="Preview" className="image-preview" />
            {progress && (
              <div className="progress-overlay">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
                </div>
                <div className="progress-message">{progress.message}</div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="result-area">
            <h3>Generated Mermaid Code</h3>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="mermaid-code"
              rows={15}
            />
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={handleClose}>
          Cancel
        </button>
        {imagePreview && !result && (
          <button
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={!!progress}
          >
            {progress ? 'Converting...' : 'Convert to Diagram'}
          </button>
        )}
        {result && (
          <>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>
              Try Again
            </button>
            <button className="btn btn-primary" onClick={handleInsert}>
              Insert into Canvas
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
};

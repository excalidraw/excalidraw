/**
 * Google Drive file picker and save dialog.
 */

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useCallback, useEffect, useState } from "react";

import {
  listExcalidrawFiles,
  loadFromGoogleDrive,
  saveToGoogleDrive,
  createNewFileInDrive,
  type DriveFile,
} from "../../data/google-drive";

import { GoogleDriveIcon } from "./GoogleDriveIcon";

import "./GoogleDrive.scss";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

interface GoogleDriveOpenDialogProps {
  onClose: () => void;
  onLoad: (data: ImportedDataState, fileId: string, fileName: string) => void;
}

export const GoogleDriveOpenDialog: React.FC<GoogleDriveOpenDialogProps> = ({
  onClose,
  onLoad,
}) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fileList = await listExcalidrawFiles();
        setFiles(fileList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, []);

  const handleOpen = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setIsOpening(true);
      setError(null);
      const data = await loadFromGoogleDrive(selectedFile.id);
      onLoad(data, selectedFile.id, selectedFile.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
      setIsOpening(false);
    }
  }, [selectedFile, onLoad, onClose]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title="Open from Google Drive"
    >
      <div className="google-drive-dialog__content">
        {error && <div className="google-drive-dialog__error">{error}</div>}

        {isLoading ? (
          <div className="google-drive-dialog__loading">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="google-drive-dialog__empty">
            No Excalidraw files found in your Google Drive.
          </div>
        ) : (
          <div className="google-drive-dialog__file-list">
            {files.map((file) => (
              <div
                key={file.id}
                className={`google-drive-dialog__file-item ${
                  selectedFile?.id === file.id
                    ? "google-drive-dialog__file-item--selected"
                    : ""
                }`}
                onClick={() => setSelectedFile(file)}
                onDoubleClick={() => {
                  setSelectedFile(file);
                  handleOpen();
                }}
              >
                <GoogleDriveIcon className="google-drive-dialog__file-icon" />
                <div className="google-drive-dialog__file-info">
                  <span className="google-drive-dialog__file-name">
                    {file.name}
                  </span>
                  <span className="google-drive-dialog__file-date">
                    Modified: {formatDate(file.modifiedTime)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="google-drive-dialog__actions">
          <FilledButton
            size="large"
            variant="outlined"
            label="Cancel"
            onClick={onClose}
          />
          {selectedFile ? (
            <FilledButton
              size="large"
              label="Open"
              onClick={handleOpen}
              status={isOpening ? "loading" : null}
            />
          ) : (
            <FilledButton
              size="large"
              label="Open"
              variant="outlined"
              color="muted"
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};

interface GoogleDriveSaveDialogProps {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  currentFileId?: string;
  currentFileName?: string;
  onClose: () => void;
  onSaved: (fileId: string, fileName: string) => void;
}

export const GoogleDriveSaveDialog: React.FC<GoogleDriveSaveDialogProps> = ({
  elements,
  appState,
  files,
  currentFileId,
  currentFileName,
  onClose,
  onSaved,
}) => {
  const [fileName, setFileName] = useState(
    currentFileName || "Untitled.excalidraw",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsNew, setSaveAsNew] = useState(!currentFileId);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);

      let result;
      if (currentFileId && !saveAsNew) {
        // Update existing file
        result = await saveToGoogleDrive(
          elements,
          appState,
          files,
          currentFileId,
        );
      } else {
        // Create new file
        result = await createNewFileInDrive(elements, appState, files, fileName);
      }

      onSaved(result.fileId, fileName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
      setIsSaving(false);
    }
  }, [
    elements,
    appState,
    files,
    currentFileId,
    saveAsNew,
    fileName,
    onSaved,
    onClose,
  ]);

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title="Save to Google Drive"
    >
      <div className="google-drive-dialog__content">
        {error && <div className="google-drive-dialog__error">{error}</div>}

        <div className="google-drive-dialog__save-form">
          {currentFileId && (
            <div>
              <label>
                <input
                  type="radio"
                  checked={!saveAsNew}
                  onChange={() => setSaveAsNew(false)}
                />
                Update existing file
              </label>
              <br />
              <label>
                <input
                  type="radio"
                  checked={saveAsNew}
                  onChange={() => setSaveAsNew(true)}
                />
                Save as new file
              </label>
            </div>
          )}

          {(saveAsNew || !currentFileId) && (
            <TextField
              label="File name"
              value={fileName}
              onChange={(value) => setFileName(value)}
              placeholder="Enter file name"
            />
          )}
        </div>

        <div className="google-drive-dialog__actions">
          <FilledButton
            size="large"
            variant="outlined"
            label="Cancel"
            onClick={onClose}
          />
          {(currentFileId || fileName.trim()) ? (
            <FilledButton
              size="large"
              label="Save"
              onClick={handleSave}
              status={isSaving ? "loading" : null}
            />
          ) : (
            <FilledButton
              size="large"
              label="Save"
              variant="outlined"
              color="muted"
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};

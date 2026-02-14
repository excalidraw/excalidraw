
import React, { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { useI18n } from "../i18n";
import { AppState, BinaryFiles, UIAppState } from "../types";
import { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { FilledButton } from "./FilledButton";
import { downloadIcon } from "./icons";
import { exportToCanvas } from "../scene/export";
import { canvasToBlob } from "../data/blob";
import { getFrameLikeTitle, getNonDeletedElements, isFrameLikeElement } from "@excalidraw/element";
import { CheckboxItem } from "./CheckboxItem";
import { TextField } from "./TextField";

import "./ExportFrameDialog.scss";

type ExportFrameDialogProps = {
    elements: readonly NonDeletedExcalidrawElement[];
    appState: UIAppState;
    files: BinaryFiles;
    onCloseRequest: () => void;
};

export const ExportFrameDialog = ({
    elements,
    appState,
    files,
    onCloseRequest,
}: ExportFrameDialogProps) => {
    const { t } = useI18n();
    const [framePreviews, setFramePreviews] = useState<{ id: string; blob: Blob | null; name: string }[]>([]);
    const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [customRange, setCustomRange] = useState("");

    useEffect(() => {
        const generatePreviews = async () => {
            const frames = getNonDeletedElements(elements).filter((element) =>
                isFrameLikeElement(element),
            ).sort((a, b) => {
                if (a.y === b.y) {
                    return a.x - b.x;
                }
                return a.y - b.y;
            });

            const initialSelectedIds = new Set<string>();
            frames.forEach((frame) => initialSelectedIds.add(frame.id));
            setSelectedFrameIds(initialSelectedIds);

            const previews = await Promise.all(
                frames.map(async (frame) => {
                    try {
                        const canvas = await exportToCanvas(
                            getNonDeletedElements(elements),
                            { ...appState, exportBackground: true } as AppState,
                            files,
                            {
                                exportBackground: true,
                                viewBackgroundColor: appState.viewBackgroundColor,
                                exportingFrame: frame,
                                exportPadding: 0,
                            },
                        );
                        const blob = await canvasToBlob(canvas);
                        return { id: frame.id, blob, name: getFrameLikeTitle(frame) || "Untitled Frame" };
                    } catch (e) {
                        console.error(e);
                        return { id: frame.id, blob: null, name: getFrameLikeTitle(frame) || "Untitled Frame" };
                    }
                })
            );

            setFramePreviews(previews);
            setLoading(false);
        };

        generatePreviews();
    }, [elements, appState, files]);

    const handleCheckboxChange = (id: string, checked: boolean) => {
        const newSelectedIds = new Set(selectedFrameIds);
        if (checked) {
            newSelectedIds.add(id);
        } else {
            newSelectedIds.delete(id);
        }
        setSelectedFrameIds(newSelectedIds);
    };

    const handleSelectAll = () => {
        const newSelectedIds = new Set<string>();
        framePreviews.forEach(p => newSelectedIds.add(p.id));
        setSelectedFrameIds(newSelectedIds);
        setCustomRange("");
    };

    const handleSelectNone = () => {
        setSelectedFrameIds(new Set());
        setCustomRange("");
    };

    const handleCustomRangeChange = (value: string) => {
        setCustomRange(value);
        if (!value.trim()) {
            setSelectedFrameIds(new Set());
            return;
        }

        const newSelectedIds = new Set<string>();
        const parts = value.split(",");

        parts.forEach(part => {
            const range = part.trim().split("-");
            if (range.length === 2) {
                const start = parseInt(range[0], 10);
                const end = parseInt(range[1], 10);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) {
                        if (i > 0 && i <= framePreviews.length) {
                            newSelectedIds.add(framePreviews[i - 1].id);
                        }
                    }
                }
            } else if (range.length === 1) {
                const page = parseInt(range[0], 10);
                if (!isNaN(page) && page > 0 && page <= framePreviews.length) {
                    newSelectedIds.add(framePreviews[page - 1].id);
                }
            }
        });
        setSelectedFrameIds(newSelectedIds);
    };

    const handleExportPdf = async () => {
        try {
            const { exportToPDF } = await import("../scene/export-to-pdf");
            // Filter elements to only include selected frames
            const elementsToExport = elements.filter(element => {
                if (isFrameLikeElement(element)) {
                    return selectedFrameIds.has(element.id);
                }
                return true;
            });

            if (selectedFrameIds.size === 0) {
                return;
            }

            await exportToPDF(elementsToExport, appState as AppState, files);
            onCloseRequest();
        } catch (error) {
            console.error(error);
            alert("Error exporting to PDF");
        }
    };

    const handleExportPptx = async () => {
        try {
            const { exportToPPTX } = await import("../scene/export-to-pptx");
            // Filter elements to only include selected frames
            const elementsToExport = elements.filter(element => {
                if (isFrameLikeElement(element)) {
                    return selectedFrameIds.has(element.id);
                }
                return true;
            });

            if (selectedFrameIds.size === 0) {
                return;
            }

            await exportToPPTX(elementsToExport, appState as AppState, files);
            onCloseRequest();
        } catch (error) {
            console.error(error);
            alert("Error exporting to PPTX");
        }
    };


    return (
        <Dialog onCloseRequest={onCloseRequest} size="wide" title="Export Frames">
            <div className="ExportFrameDialog">
                <div className="ExportFrameDialog__content">
                    <div className="ExportFrameDialog__preview">
                        {loading ? (
                            <div>Loading previews...</div>
                        ) : (
                            <div className="ExportFrameDialog__preview-list">
                                {framePreviews.map((preview) => (
                                    <div key={preview.id} className="ExportFrameDialog__preview-item" onClick={() => handleCheckboxChange(preview.id, !selectedFrameIds.has(preview.id))}>
                                        <div className="ExportFrameDialog__preview-image">
                                            {preview.blob && (
                                                <img src={URL.createObjectURL(preview.blob)} alt={preview.name} />
                                            )}
                                            <div className="ExportFrameDialog__preview-checkbox">
                                                <CheckboxItem
                                                    checked={selectedFrameIds.has(preview.id)}
                                                    onChange={(checked) => handleCheckboxChange(preview.id, checked)}
                                                >
                                                    { }
                                                </CheckboxItem>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {framePreviews.length === 0 && <div>No frames found to export</div>}
                            </div>
                        )}
                    </div>
                    <div className="ExportFrameDialog__actions">
                        <div className="ExportFrameDialog__selection">
                            <h3>Select</h3>
                            <div className="ExportFrameDialog__selection-buttons">
                                <button type="button" className="ExportFrameDialog__button--secondary" onClick={handleSelectAll}>All</button>
                                <button type="button" className="ExportFrameDialog__button--secondary" onClick={handleSelectNone}>None</button>
                            </div>
                            <div className="ExportFrameDialog__selection-custom">
                                <TextField
                                    value={customRange}
                                    placeholder="e.g. 1, 2, 5-9"
                                    onChange={handleCustomRangeChange}
                                    label="Custom Range"
                                />
                            </div>
                            <div className="ExportFrameDialog__selection-count">
                                {selectedFrameIds.size} frame{selectedFrameIds.size !== 1 ? 's' : ''} selected
                            </div>
                        </div>

                        <h3>Export Options</h3>
                        <FilledButton
                            className="ExportFrameDialog__button"
                            label="Export to PDF"
                            onClick={handleExportPdf}
                            icon={downloadIcon}
                            disabled={selectedFrameIds.size === 0}
                        >
                            Export to PDF
                        </FilledButton>
                        <FilledButton
                            className="ExportFrameDialog__button"
                            label="Export to PPTX"
                            onClick={handleExportPptx}
                            icon={downloadIcon}
                            disabled={selectedFrameIds.size === 0}
                        >
                            Export to PPTX
                        </FilledButton>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

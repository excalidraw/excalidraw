import React, { useEffect, useState } from "react";
import { getPDFPageCount, renderPDFThumbnails, renderPDFToImages } from "../data/pdf";
import { FilledButton } from "./FilledButton";
import Spinner from "./Spinner";
import { Island } from "./Island";

import "./PDFImportDialog.scss";

interface PDFImportDialogProps {
    file: File;
    onImport: (files: File[]) => void;
    onClose: () => void;
}

export const PDFImportDialog = ({ file, onImport, onClose }: PDFImportDialogProps) => {
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState<boolean>(true);
    const [importing, setImporting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPDF = async () => {
            try {
                await getPDFPageCount(file);
                const thumbs = await renderPDFThumbnails(file);
                setThumbnails(thumbs);
            } catch (err: any) {
                console.error("Failed to load PDF:", err);
                setError(err.message || "Failed to load PDF");
            } finally {
                setLoading(false);
            }
        };
        loadPDF();
    }, [file]);

    const togglePage = (pageIndex: number) => {
        const newSelected = new Set(selectedPages);
        if (newSelected.has(pageIndex)) {
            newSelected.delete(pageIndex);
        } else {
            newSelected.add(pageIndex);
        }
        setSelectedPages(newSelected);
    };

    const handleImport = async () => {
        if (selectedPages.size === 0) return;
        setImporting(true);
        try {
            const pagesToRender = Array.from(selectedPages).sort((a, b) => a - b).map(i => i + 1);
            const files = await renderPDFToImages(file, pagesToRender);
            onImport(files);
        } catch (err: any) {
            console.error("Failed to render PDF pages:", err);
            setError(err.message || "Failed to render PDF pages");
        } finally {
            setImporting(false);
        }
    };

    // Simple modal overlay that doesn't use context hooks
    return (
        <div className="PDFImportDialog__overlay" onClick={(e) => {
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
            <Island className="PDFImportDialog__modal">
                <h2 className="PDFImportDialog__title">Import PDF</h2>
                <div className="PDFImportDialog__content">
                    {loading ? (
                        <div className="PDFImportDialog__loading">
                            <Spinner />
                            <span>Loading PDF...</span>
                        </div>
                    ) : error ? (
                        <div className="PDFImportDialog__error">
                            <span>{error}</span>
                            <FilledButton
                                label="Close"
                                color="muted"
                                onClick={onClose}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="PDFImportDialog__grid">
                                {thumbnails.map((thumb, index) => (
                                    <div
                                        key={index}
                                        className={`PDFImportDialog__page ${selectedPages.has(index) ? "is-selected" : ""
                                            }`}
                                        onClick={() => togglePage(index)}
                                    >
                                        <img src={thumb} alt={`Page ${index + 1}`} />
                                        <div className="PDFImportDialog__page-number">{index + 1}</div>
                                        <div className="PDFImportDialog__checkbox">
                                            {selectedPages.has(index) && "✓"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="PDFImportDialog__actions">
                                <FilledButton
                                    label="Cancel"
                                    color="muted"
                                    onClick={onClose}
                                />
                                <FilledButton
                                    label={
                                        importing
                                            ? "Importing..."
                                            : `Import Selected (${selectedPages.size})`
                                    }
                                    status={importing ? "loading" : null}
                                    onClick={handleImport}
                                />
                            </div>
                        </>
                    )}
                </div>
            </Island>
        </div>
    );
};

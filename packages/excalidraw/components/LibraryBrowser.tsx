import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import Spinner from "./Spinner";
import { t } from "../i18n";
import "./LibraryBrowser.scss";
import Library from "../data/library";
import { searchIcon } from "./icons";

interface LibraryMetadata {
    name: string;
    description: string;
    source: string;
    preview: string;
    id: string;
    authors: { name: string; url: string }[];
}

const LIBRARIES_ENDPOINT = "https://libraries.excalidraw.com/libraries.json";
const LIBRARIES_BASE_URL = "https://libraries.excalidraw.com/libraries/";

export const LibraryBrowser = ({
    onClose,
    library,
    theme,
}: {
    onClose: () => void;
    library: Library;
    theme: "light" | "dark";
}) => {
    const [libraries, setLibraries] = useState<LibraryMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [installingId, setInstallingId] = useState<string | null>(null);

    useEffect(() => {
        fetch(LIBRARIES_ENDPOINT)
            .then((res) => res.json())
            .then((data) => {
                setLibraries(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError("Failed to load libraries");
                setLoading(false);
            });
    }, []);

    const handleInstall = async (item: LibraryMetadata) => {
        setInstallingId(item.id);
        try {
            const response = await fetch(`${LIBRARIES_BASE_URL}${item.source}`);
            const blob = await response.blob();
            await library.updateLibrary({
                libraryItems: blob,
                merge: true,
                openLibraryMenu: true,
                prompt: true,
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to install library");
        } finally {
            setInstallingId(null);
        }
    };

    const filteredLibraries = libraries.filter(
        (lib) =>
            lib.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lib.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <Dialog
            onCloseRequest={onClose}
            title={t("labels.libraries")}
            className="LibraryBrowser"
        >
            <div className="LibraryBrowser__search">
                <TextField
                    placeholder={t("library.search.inputPlaceholder")}
                    value={searchTerm}
                    onChange={setSearchTerm}
                    fullWidth
                    icon={searchIcon}
                />
            </div>
            {loading ? (
                <div className="LibraryBrowser__loading">
                    <Spinner />
                </div>
            ) : error ? (
                <div className="LibraryBrowser__error">{error}</div>
            ) : (
                <div className="LibraryBrowser__list">
                    {filteredLibraries.map((lib) => (
                        <div key={lib.id} className="LibraryBrowser__item">
                            <div
                                className="LibraryBrowser__item-preview"
                                style={{
                                    backgroundImage: `url(${LIBRARIES_BASE_URL}${lib.preview})`,
                                }}
                            />
                            <div className="LibraryBrowser__item-info">
                                <div className="LibraryBrowser__item-title">{lib.name}</div>
                                <div className="LibraryBrowser__item-description">
                                    {lib.description}
                                </div>
                                <div className="LibraryBrowser__item-author">
                                    by {lib.authors.map((a) => a.name).join(", ")}
                                </div>
                            </div>
                            <div className="LibraryBrowser__item-actions">
                                <button
                                    className="start-button-filled"
                                    type="button"
                                    onClick={() => handleInstall(lib)}
                                    disabled={installingId === lib.id}
                                    style={{ padding: "8px 16px", fontSize: "0.9rem" }}
                                >
                                    {installingId === lib.id ? <Spinner /> : t("buttons.submit")}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Dialog>
    );
};

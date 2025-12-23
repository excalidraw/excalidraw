import { register } from "./register";
import { loadFromBlob, trackRecentFile } from "../data";
import { CaptureUpdateAction } from "@excalidraw/element";
import type { FileSystemHandle, CapacitorFileHandle } from "../data/filesystem";
import type { AppState } from "../types";

export const actionLoadRecentFile = register<{ handle: FileSystemHandle | CapacitorFileHandle }>({
    name: "loadRecentFile",
    label: "buttons.load",
    trackEvent: { category: "export", action: "loadRecent" },
    perform: async (elements, appState, data, app) => {
        const { handle } = data || {};
        if (!handle) {
            return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
        }
        try {
            let file: File | Blob;
            if ("uri" in handle) {
                // Capacitor handle
                const { Filesystem } = await import("@capacitor/filesystem");
                const res = await Filesystem.readFile({
                    path: handle.uri,
                });
                // Assuming the file content is base64
                const base64Content = res.data;
                const blob = await (await fetch(`data:application/json;base64,${base64Content}`)).blob();
                file = new File([blob], handle.name, { type: "application/json" });
            } else {
                // Web handle
                file = await (handle as any).getFile();
            }

            const {
                elements: loadedElements,
                appState: loadedAppState,
                files,
            } = await loadFromBlob(file, appState, elements, handle);

            // Re-track to update timestamp
            trackRecentFile(handle);

            return {
                elements: loadedElements,
                appState: {
                    ...loadedAppState,
                    fileHandle: handle,
                    toast: { message: `Loaded "${handle.name}"` }
                },
                files,
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            };
        } catch (error: any) {
            console.error(error);
            return {
                elements,
                appState: { ...appState, errorMessage: error.message },
                files: app.files,
                captureUpdate: CaptureUpdateAction.EVENTUALLY,
            };
        }
    },
});

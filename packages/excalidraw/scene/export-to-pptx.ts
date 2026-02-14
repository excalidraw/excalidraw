
import pptxgen from "pptxgenjs";
import {
    getNonDeletedElements,
    isFrameLikeElement,
    getFrameLikeTitle,
} from "@excalidraw/element";
import type {
    ExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";
import { exportToCanvas } from "./export";

export const exportToPPTX = async (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
) => {
    const pres = new pptxgen();

    const frames = getNonDeletedElements(elements).filter((element) =>
        isFrameLikeElement(element),
    ).sort((a, b) => {
        // Sort by y position then x position
        if (a.y === b.y) {
            return a.x - b.x;
        }
        return a.y - b.y;
    });

    if (frames.length === 0) {
        throw new Error("No frames found to export");
    }

    for (const frame of frames) {
        const canvas = await exportToCanvas(
            getNonDeletedElements(elements),
            appState,
            files,
            {
                exportBackground: appState.exportBackground,
                viewBackgroundColor: appState.viewBackgroundColor,
                exportingFrame: frame,
            },
        );

        // Convert pixels to inches (assuming 96 DPI)
        const widthInInches = frame.width / 96;
        const heightInInches = frame.height / 96;

        const slide = pres.addSlide();

        // Add slide title if available
        const name = getFrameLikeTitle(frame);
        if (name) {
            slide.addText(name, {
                x: 0,
                y: 0,
                w: widthInInches,
                h: 0.5,
                fontSize: 18,
                align: "center",
            });
        }

        // Convert canvas to data URL
        const imgData = canvas.toDataURL("image/png");

        slide.addImage({
            data: imgData,
            x: 0,
            y: 0,
            w: widthInInches,
            h: heightInInches,
        });
    }

    pres.writeFile({ fileName: `excalidraw-export-${Date.now()}.pptx` });
};

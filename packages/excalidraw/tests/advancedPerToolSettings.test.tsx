import React from "react";
import { Excalidraw } from "../index";
import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render, unmountComponent, act } from "./test-utils";
import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { actionChangeStrokeColor } from "../actions/actionProperties";

beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ height: 768, width: MQ_MIN_WIDTH_DESKTOP });
});

describe("advanced per-tool style settings (grouping & locking)", () => {
    it("should share styles within tool groups (shapes)", async () => {
        // 1. Rectangle -> Red
        await act(async () => {
            UI.clickTool("rectangle");
        });
        await act(async () => {
            window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", { currentItemStrokeColor: "#e03131" });
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

        // 2. Diamond -> should be Red (shared group 'shapes')
        await act(async () => {
            UI.clickTool("diamond");
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

        // 3. Pencil -> set to Blue (group 'pen')
        await act(async () => {
            UI.clickTool("freedraw");
        });
        await act(async () => {
            window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", { currentItemStrokeColor: "#1971c2" });
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");

        // 4. Rectangle -> should still be Red
        await act(async () => {
            UI.clickTool("rectangle");
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");
    });

    it("should bypass per-tool settings when locked (global sync)", async () => {
        // 1. Enable Lock
        await act(async () => {
            API.setAppState({ isStyleSettingsLocked: true });
        });

        // 2. Rectangle -> Red
        await act(async () => {
            UI.clickTool("rectangle");
        });
        await act(async () => {
            window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", { currentItemStrokeColor: "#e03131" });
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

        // 3. Switch to Pencil
        await act(async () => {
            UI.clickTool("freedraw");
        });
        // Should still be Red because it's locked/global
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

        // 4. Pencil -> Blue
        await act(async () => {
            window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", { currentItemStrokeColor: "#1971c2" });
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");

        // 5. Rectangle -> should be Blue now!
        await act(async () => {
            UI.clickTool("rectangle");
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");

        // 6. Disable Lock
        await act(async () => {
            API.setAppState({ isStyleSettingsLocked: false });
        });

        // 7. Rectangle -> Red
        await act(async () => {
            window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", { currentItemStrokeColor: "#e03131" });
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

        // 8. Pencil -> should be Blue (last used value when locked or default)
        await act(async () => {
            UI.clickTool("freedraw");
        });
        expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");
    });
});

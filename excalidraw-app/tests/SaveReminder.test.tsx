import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import {
  REMINDER_TIERS,
  SaveReminder,
} from "excalidraw-app/save-reminder/SaveReminder";
import { vi } from "vitest";
import { resolvablePromise } from "@excalidraw/common";
import { Excalidraw } from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { syncInvalidIndices } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const { h } = window;

describe("Save reminder", () => {
  let excalidrawAPI: ExcalidrawImperativeAPI;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2020-01-01T00:00:00Z");
  });

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    const { rerender } = await render(
      <Excalidraw
        excalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );

    excalidrawAPI = await excalidrawAPIPromise;
    rerender(
      <Excalidraw>
        <SaveReminder excalidrawAPI={excalidrawAPI} />
      </Excalidraw>,
    );
  });

  it("Should only fire after count threshold is exceeded if time threshold is already exceeded", async () => {
    for (const tier of REMINDER_TIERS) {
      const currentTime = vi.getMockedSystemTime();
      if (!currentTime) {
        throw new Error("No mocked date");
      }
      currentTime.setTime(currentTime.getTime() + tier.time);
      vi.setSystemTime(currentTime);
      act(() => {
        h.scene.triggerUpdate();
      });
      expect(h.state.toast).toBe(null);
      const elements: ExcalidrawElement[] = [];
      for (let i = 0; i < tier.elementsCount; ++i) {
        elements.push(
          API.createElement({
            id: i.toString(),
            type: "rectangle",
            height: 200,
            width: 100,
            x: i,
            y: i,
          }),
        );
      }
      API.updateScene({ elements: syncInvalidIndices(elements) });
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      API.setAppState({ toast: null });
      API.updateScene({ elements: [] });
    }
  });

  it("Should only fire after time threshold is exceeded if count threshold is already exceeded", async () => {
    for (const tier of REMINDER_TIERS) {
      const elements: ExcalidrawElement[] = [];
      for (let i = 0; i < tier.elementsCount; ++i) {
        elements.push(
          API.createElement({
            id: i.toString(),
            type: "rectangle",
            height: 200,
            width: 100,
            x: i,
            y: i,
          }),
        );
      }
      API.updateScene({ elements: syncInvalidIndices(elements) });
      expect(h.state.toast).toBe(null);
      const currentTime = vi.getMockedSystemTime();
      if (!currentTime) {
        throw new Error("No mocked date");
      }
      currentTime.setTime(currentTime.getTime() + tier.time);
      vi.setSystemTime(currentTime);
      act(() => {
        h.scene.triggerUpdate();
      });
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      API.setAppState({ toast: null });
      API.updateScene({ elements: [] });
    }
  });

  afterEach(() => {
    act(() => {
      excalidrawAPI.resetScene();
    });
  });

  afterAll(() => {
    vi.useRealTimers();
  });
});

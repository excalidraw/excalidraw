import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import { REMINDER_TIERS } from "excalidraw-app/save-reminder/SaveReminder";
import { vi } from "vitest";
import { t } from "@excalidraw/excalidraw/i18n";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { syncInvalidIndices } from "@excalidraw/element";
import ExcalidrawApp from "excalidraw-app/App";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const { h } = window;

describe("Save reminder", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2020-01-01T00:00:00Z");
  });

  beforeEach(async () => {
    localStorage.clear();
    await render(<ExcalidrawApp />);
  });

  const exceedTierTime = (tier: { time: number }) => {
    const currentTime = vi.getMockedSystemTime();
    if (!currentTime) {
      throw new Error("No mocked date");
    }
    currentTime.setTime(currentTime.getTime() + tier.time);
    vi.setSystemTime(currentTime);
    act(() => {
      h.scene.triggerUpdate();
    });
  };

  const exceedTierElements = (tier: { elementsCount: number }) => {
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
  };

  const clearToastAndElements = () => {
    API.setAppState({ toast: null });
    API.updateScene({ elements: [] });
  };

  it("Should only fire after count threshold is exceeded if time threshold is already exceeded", async () => {
    for (const tier of REMINDER_TIERS) {
      exceedTierTime(tier);
      expect(h.state.toast).toBe(null);
      exceedTierElements(tier);
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      clearToastAndElements();
    }
  });

  it("Should only fire after time threshold is exceeded if count threshold is already exceeded", async () => {
    for (const tier of REMINDER_TIERS) {
      exceedTierElements(tier);
      expect(h.state.toast).toBe(null);
      exceedTierTime(tier);
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      clearToastAndElements();
    }
  });

  afterAll(() => {
    vi.useRealTimers();
  });
});

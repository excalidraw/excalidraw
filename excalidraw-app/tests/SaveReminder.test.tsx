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

  it.each(REMINDER_TIERS)(
    "Should show reminder after time then count threshold (%o)",
    async (tier) => {
      exceedTierTime(tier);
      expect(h.state.toast).toBeNull();
      exceedTierElements(tier);
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      clearToastAndElements();
    },
  );

  it.each(REMINDER_TIERS)(
    "Should show reminder after count then time threshold (%o)",
    async (tier) => {
      exceedTierElements(tier);
      expect(h.state.toast).toBeNull();
      exceedTierTime(tier);
      expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
      clearToastAndElements();
    },
  );

  afterAll(() => {
    vi.useRealTimers();
  });
});

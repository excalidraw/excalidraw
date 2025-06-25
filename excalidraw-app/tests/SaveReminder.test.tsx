import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import { REMINDER_TIERS } from "excalidraw-app/save-reminder/SaveReminder";
import { vi } from "vitest";
import { t } from "@excalidraw/excalidraw/i18n";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { syncInvalidIndices } from "@excalidraw/element";
import ExcalidrawApp from "excalidraw-app/App";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const { h } = window;

vi.mock("@excalidraw/excalidraw/data", () => ({
  saveAsJSON: () => ({ fileHandle: null }),
}));

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

    const newTime = new Date(currentTime.getTime() + tier.time);
    vi.setSystemTime(newTime);
    act(() => {
      h.scene.triggerUpdate();
    });
  };

  const exceedTierElements = (tier: { elementsCount: number }) => {
    const elements: ExcalidrawElement[] = [];
    for (let i = 0; i < tier.elementsCount; ++i) {
      elements.push(
        API.createElement({
          id: randomId(),
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

  const clearToast = () => {
    API.setAppState({ toast: null });
  };

  const clearElements = () => {
    API.updateScene({ elements: [] });
  };

  const assertToastExists = () => {
    expect(h.state.toast?.message).toBe(t("toast.rememberToSave"));
  };

  const assertToastDoesNotExist = () => {
    expect(h.state.toast).toBeNull();
  };

  it("Should show reminder after time then count threshold", async () => {
    for (const tier of REMINDER_TIERS) {
      exceedTierTime(tier);
      assertToastDoesNotExist();
      exceedTierElements(tier);
      assertToastExists();
      clearToast();
    }
  });

  it("Should show reminder after count then time threshold", async () => {
    for (const tier of REMINDER_TIERS) {
      exceedTierElements(tier);
      assertToastDoesNotExist();
      exceedTierTime(tier);
      assertToastExists();
      clearToast();
    }
  });

  it("Should not fire after last threshold", async () => {
    for (const tier of REMINDER_TIERS) {
      exceedTierTime(tier);
      exceedTierElements(tier);
      clearToast();
    }
    exceedTierTime(REMINDER_TIERS[REMINDER_TIERS.length - 1]);
    exceedTierElements(REMINDER_TIERS[REMINDER_TIERS.length - 1]);
    assertToastDoesNotExist();
  });

  it("Should not reset the reminder state on remount", async () => {
    const firstTier = REMINDER_TIERS[0];
    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    clearElements();

    await render(<ExcalidrawApp />);

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    assertToastDoesNotExist();

    exceedTierElements(REMINDER_TIERS[1]);
    exceedTierTime(REMINDER_TIERS[1]);
    assertToastExists();
  });

  it.each([
    { emitter: () => h.app.onSaveEmitter.trigger(), title: "saving to a file" },
    {
      emitter: () =>
        h.app.onLoadEmitter.trigger(h.elements, h.state, h.app.files),
      title: "loading from a file",
    },
    {
      emitter: () => h.app.onResetEmitter.trigger(),
      title: "resetting the scene",
    },
  ])("Should reset the reminder state on $title", ({ emitter }) => {
    const firstTier = REMINDER_TIERS[0];

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    clearElements();
    clearToast();

    emitter();

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    assertToastExists();
  });

  it("Should use the last saved elements count as the base count for future reminders", () => {
    const firstTier = REMINDER_TIERS[0];

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    clearToast();

    h.app.onSaveEmitter.trigger();

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    assertToastDoesNotExist();

    exceedTierElements({
      elementsCount: firstTier.elementsCount * 2,
    });
    assertToastExists();
  });

  it("Should use an empty elements count as the base count for future reminders after resetting", () => {
    const firstTier = REMINDER_TIERS[0];

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    clearToast();

    h.app.onResetEmitter.trigger();

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    assertToastExists();
  });

  it("Should use the loaded elements count as the base count for future reminders", () => {
    const firstTier = REMINDER_TIERS[0];

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    clearToast();

    h.app.onLoadEmitter.trigger([], h.state, h.app.files);

    exceedTierElements(firstTier);
    exceedTierTime(firstTier);
    assertToastExists();
  });

  afterAll(() => {
    vi.useRealTimers();
  });
});

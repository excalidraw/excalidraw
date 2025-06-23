import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import {
  REMINDER_TIERS,
  SaveReminder,
} from "excalidraw-app/save-reminder/SaveReminder";
import { vi } from "vitest";
import { resolvablePromise } from "@excalidraw/common";
import { Excalidraw } from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";
import { Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { syncInvalidIndices } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("Save reminder", () => {
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

    const excalidrawAPI = await excalidrawAPIPromise;
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
        mouse.click();
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
});

afterAll(() => {
  vi.useRealTimers();
});

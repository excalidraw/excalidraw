import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";
import { render, queryByTestId, unmountComponent, waitFor } from "../tests/test-utils";

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

describe("Test <App/>", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
  });

  it("should show error modal when using brave and measureText API is not working", async () => {
    (global.navigator as any).brave = {
      isBrave: {
        name: "isBrave",
      },
    };

    const originalContext = global.HTMLCanvasElement.prototype.getContext("2d");
    //@ts-ignore
    global.HTMLCanvasElement.prototype.getContext = (contextId) => {
      return {
        ...originalContext,
        measureText: () => ({
          width: 0,
        }),
      };
    };

    await render(<Excalidraw />);

    const modalRoot = await waitFor(() => {
      const el = document.querySelector(".excalidraw-modal-container");
      if (!el) {
        throw new Error("modal not mounted");
      }
      return el;
    });

    expect(
      queryByTestId(modalRoot as HTMLElement, "brave-measure-text-error"),
    ).toMatchSnapshot();
  });
});

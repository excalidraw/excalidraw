import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";
import { render, queryByTestId, unmountComponent } from "../tests/test-utils";

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
    expect(
      queryByTestId(
        document.querySelector(".excalidraw-modal-container")!,
        "brave-measure-text-error",
      ),
    ).toMatchSnapshot();
  });

  it("should listen for pagehide instead of unload", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    await render(<Excalidraw />);

    expect(addEventListener).toHaveBeenCalledWith(
      "pagehide",
      expect.any(Function),
      false,
    );
    expect(addEventListener).not.toHaveBeenCalledWith(
      "unload",
      expect.any(Function),
      false,
    );

    addEventListener.mockRestore();
  });
});

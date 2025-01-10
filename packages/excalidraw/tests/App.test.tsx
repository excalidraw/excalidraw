import React from "react";
import ReactDOM from "react-dom";
import * as StaticScene from "../renderer/staticScene";
import { reseed } from "../random";
import { render, queryByTestId } from "../tests/test-utils";

import { Excalidraw } from "../index";
import { vi } from "vitest";

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

describe("Test <App/>", () => {
  beforeEach(async () => {
    // Unmount ReactDOM from root
    ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
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
});

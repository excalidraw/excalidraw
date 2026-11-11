import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";
import { render, queryByTestId, unmountComponent } from "../tests/test-utils";

import { API } from "./helpers/api";

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

  it("should render iframe elements with renderIframe", async () => {
    const iframe = API.createElement({
      type: "iframe",
      id: "iframe",
      width: 320,
      height: 180,
    });

    const { getByTestId, queryByTitle } = await render(
      <Excalidraw
        initialData={{ elements: [iframe] }}
        renderIframe={(element) => (
          <div data-testid="custom-iframe">{element.id}</div>
        )}
      />,
    );

    expect(getByTestId("custom-iframe")).toHaveTextContent("iframe");
    expect(queryByTitle("Excalidraw Embedded Content")).toBeNull();
  });
});

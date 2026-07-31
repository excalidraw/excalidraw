import React from "react";
import { createPortal } from "react-dom";

import { render } from "@testing-library/react";

import { ObsidianRadixPortal } from "./ObsidianRadixPortal";

const TestPortal = ({
  children,
  container,
}: React.PropsWithChildren<{ container?: HTMLElement }>) =>
  createPortal(children, container ?? document.body);

describe("ObsidianRadixPortal", () => {
  it("portals outside the Excalidraw container while preserving its theme", () => {
    const popoutDocument = document.implementation.createHTMLDocument();
    const container = popoutDocument.createElement("div");
    container.className = "excalidraw theme--dark";
    container.style.setProperty("--island-bg-color", "#232329");
    popoutDocument.body.append(container);

    render(
      <ObsidianRadixPortal portal={TestPortal} container={container}>
        <div data-testid="content" />
      </ObsidianRadixPortal>,
    );

    const content = popoutDocument.querySelector(
      '[data-testid="content"]',
    ) as HTMLElement;
    const bridge = content.parentElement;

    expect(container.contains(content)).toBe(false);
    expect(bridge?.parentElement).toBe(popoutDocument.body);
    expect(bridge?.className).toBe("excalidraw theme--dark");
    expect(bridge?.style.display).toBe("contents");
    expect(bridge?.style.getPropertyValue("--island-bg-color")).toBe("#232329");
  });
});

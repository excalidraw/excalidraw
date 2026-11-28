import { fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";

import { getDefaultAppState } from "../appState";

import { actionChangeFreedrawPointer } from "./actionProperties";

import type { AppClassProperties, AppProps, UIAppState } from "../types";

describe("actionChangeFreedrawPointer", () => {
  it("renders pointer options using the current stroke color", () => {
    const updateData = vi.fn();
    const PanelComponent = actionChangeFreedrawPointer.PanelComponent!;
    const appState: UIAppState = {
      ...getDefaultAppState(),
      width: 1000,
      height: 800,
      offsetTop: 0,
      offsetLeft: 0,
      currentItemStrokeColor: "#ff0000",
    };

    const { getByTestId } = render(
      <PanelComponent
        elements={[]}
        appState={appState}
        updateData={updateData}
        appProps={{} as AppProps}
        app={{} as AppClassProperties}
        renderAction={() => null}
      />,
    );

    const crosshairPointer = getByTestId("freedrawPointer-crosshair");
    const dotPointer = getByTestId("freedrawPointer-dot");

    expect(crosshairPointer).toBeChecked();
    expect(dotPointer).not.toBeChecked();
    expect(dotPointer.parentElement?.querySelector("circle")).toHaveAttribute(
      "fill",
      "#ff0000",
    );

    fireEvent.click(dotPointer);

    expect(updateData).toHaveBeenCalledWith("dot");
  });
});

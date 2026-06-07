import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { newTextElement } from "@excalidraw/element";

import { TerraformColorLegend } from "./TerraformColorLegend";

const terraformResource = newTextElement({
  x: 0,
  y: 0,
  text: "r",
  customData: { terraformVisibilityRole: "resource" },
});

const makeApp = () => {
  const elements = [terraformResource];
  return {
    scene: {
      getElementsIncludingDeleted: () => elements,
      replaceAllElements: vi.fn((next) => {
        elements.splice(0, elements.length, ...next);
      }),
    },
  };
};

describe("TerraformColorLegend", () => {
  it("is hidden when scene has no terraform resources", () => {
    render(<TerraformColorLegend app={makeApp() as any} elements={[]} />);
    expect(screen.queryByTestId("terraform-color-legend")).toBeNull();
  });

  it("shows category sections by default", () => {
    render(
      <TerraformColorLegend app={makeApp() as any} elements={[terraformResource]} />,
    );
    expect(screen.getByTestId("terraform-color-legend")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Hierarchy")).toBeTruthy();
    expect(screen.getByText("Compute")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
  });

  it("switches to plan action legend when toggled", () => {
    render(
      <TerraformColorLegend app={makeApp() as any} elements={[terraformResource]} />,
    );
    fireEvent.click(screen.getByTestId("terraform-color-mode-action"));
    expect(screen.getByText("Plan actions")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText("Changed")).toBeTruthy();
    expect(screen.queryByText("Hierarchy")).toBeNull();
  });
});

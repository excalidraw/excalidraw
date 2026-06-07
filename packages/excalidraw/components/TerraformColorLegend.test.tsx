import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { newTextElement } from "@excalidraw/element";

import { TerraformColorLegend } from "./TerraformColorLegend";

const terraformResource = newTextElement({
  x: 0,
  y: 0,
  text: "r",
  customData: { terraformVisibilityRole: "resource" },
});

describe("TerraformColorLegend", () => {
  it("is hidden when scene has no terraform resources", () => {
    render(<TerraformColorLegend elements={[]} />);
    expect(screen.queryByTestId("terraform-color-legend")).toBeNull();
  });

  it("shows resource and hierarchy sections on terraform scenes", () => {
    render(<TerraformColorLegend elements={[terraformResource]} />);
    expect(screen.getByTestId("terraform-color-legend")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Hierarchy")).toBeTruthy();
    expect(screen.getByText("Compute")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.getByText("Subnet · public")).toBeTruthy();
  });
});

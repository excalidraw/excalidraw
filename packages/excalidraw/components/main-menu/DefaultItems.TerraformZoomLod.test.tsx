import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { newTextElement } from "@excalidraw/element";

import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { clearTerraformImportSession } from "../terraformImportSession";

import { TerraformZoomLod } from "./DefaultItems";

const hoisted = vi.hoisted(() => ({
  setAppState: vi.fn(),
  elements: [] as ReturnType<typeof newTextElement>[],
  appState: {
    terraformLodEnabled: true,
    terraformLodPreset: "balanced" as const,
  },
}));

vi.mock("../App", () => ({
  useApp: () => ({
    scene: {
      getElementsIncludingDeleted: () => hoisted.elements,
    },
    state: hoisted.appState,
  }),
  useExcalidrawSetAppState: () => hoisted.setAppState,
  useExcalidrawElements: () => hoisted.elements,
  useEditorInterface: () => ({ formFactor: "desktop" }),
}));

const terraformResource = newTextElement({
  x: 0,
  y: 0,
  text: "r",
  customData: { terraformVisibilityRole: "resource" },
});

const renderZoomLodMenu = () =>
  render(
    <div className="excalidraw">
      <DropdownMenu open>
        <DropdownMenu.Trigger onToggle={() => {}}>Menu</DropdownMenu.Trigger>
        <DropdownMenu.Content onClickOutside={() => {}}>
          <TerraformZoomLod />
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>,
  );

const openZoomLodSubmenu = async () => {
  fireEvent.click(screen.getByTestId("terraform-zoom-lod-submenu"));
  await waitFor(() => {
    expect(screen.getByTestId("terraform-zoom-lod-enable")).toBeTruthy();
  });
};

describe("TerraformZoomLod", () => {
  beforeEach(() => {
    hoisted.setAppState.mockReset();
    hoisted.elements = [];
    hoisted.appState.terraformLodEnabled = true;
    hoisted.appState.terraformLodPreset = "balanced";
    clearTerraformImportSession();
  });

  it("is hidden when scene has no terraform resources", () => {
    renderZoomLodMenu();
    expect(screen.queryByTestId("terraform-zoom-lod-submenu")).toBeNull();
  });

  it("shows submenu trigger when terraform resources exist", () => {
    hoisted.elements = [terraformResource];
    renderZoomLodMenu();
    expect(screen.getByTestId("terraform-zoom-lod-submenu")).toHaveAttribute(
      "aria-label",
      "Zoom LOD settings",
    );
  });

  it("toggles terraformLodEnabled via setAppState", async () => {
    hoisted.elements = [terraformResource];
    renderZoomLodMenu();
    await openZoomLodSubmenu();

    fireEvent.click(screen.getByTestId("terraform-zoom-lod-enable"));

    expect(hoisted.setAppState).toHaveBeenCalledWith({
      terraformLodEnabled: false,
    });
  });

  it("changes terraformLodPreset via setAppState", async () => {
    hoisted.elements = [terraformResource];
    renderZoomLodMenu();
    await openZoomLodSubmenu();

    fireEvent.click(screen.getByTestId("terraform-lod-preset-performance"));

    expect(hoisted.setAppState).toHaveBeenCalledWith({
      terraformLodPreset: "performance",
    });
  });

  it("exposes accessible preset labels on radio inputs", async () => {
    hoisted.elements = [terraformResource];
    renderZoomLodMenu();
    await openZoomLodSubmenu();

    expect(
      screen.getByLabelText(
        "Performance — hide detail soonest when zoomed out",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Balanced — default detail when zoomed out"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Detailed — show labels and satellites from farther out",
      ),
    ).toBeTruthy();
  });

  it("shows helper note in submenu", async () => {
    hoisted.elements = [terraformResource];
    renderZoomLodMenu();
    await openZoomLodSubmenu();

    expect(
      screen.getByText("Hide labels and satellites when zoomed out."),
    ).toBeTruthy();
  });
});

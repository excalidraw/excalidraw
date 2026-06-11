import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BUILTIN_TERRAFORM_IMPORT_PRESETS } from "./terraformImportPresetsTypes";
import { TerraformImportModal } from "./TerraformImportDialog";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";
import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";

const hoisted = vi.hoisted(() => ({
  addFiles: vi.fn(),
  replaceAllElements: vi.fn(),
  scrollToContent: vi.fn(),
  setAppState: vi.fn(),
}));

vi.mock("./terraformLayoutWorkerClient", () => ({
  layoutTerraformViaWorkers: vi.fn(),
}));

vi.mock("./terraformImportPresetLoader", () => ({
  chooseTerraformImportPresetRootDirectory: vi.fn(),
  loadTerraformImportPresetSources: vi.fn(),
}));

vi.mock("./terraformImportPresets", () => ({
  BUILTIN_TERRAFORM_IMPORT_PRESETS,
  listTerraformImportPresets: vi.fn(async () =>
    BUILTIN_TERRAFORM_IMPORT_PRESETS.map((preset) => ({
      ...preset,
      hasContent: true,
    })),
  ),
  getTerraformImportPreset: vi.fn(),
  saveTerraformImportPreset: vi.fn(),
  updateTerraformImportPreset: vi.fn(),
  deleteTerraformImportPreset: vi.fn(),
}));

vi.mock("./App", () => ({
  useApp: () => ({
    addFiles: hoisted.addFiles,
    scene: { replaceAllElements: hoisted.replaceAllElements },
    scrollToContent: hoisted.scrollToContent,
    state: { viewBackgroundColor: "#ffffff" },
  }),
  useExcalidrawSetAppState: () => hoisted.setAppState,
}));

function textFileLike(contents: string, name = "file"): File {
  return {
    name,
    text: async () => contents,
  } as File;
}

function fillFirstBundle(planJson = "{}", dot = "digraph {}") {
  const planInputs = screen.getAllByLabelText(/plan file/i);
  const dotInputs = screen.getAllByLabelText(/graph file/i);
  fireEvent.change(planInputs[0], {
    target: {
      files: [textFileLike(planJson, "p.json")],
    },
  });
  fireEvent.change(dotInputs[0], {
    target: {
      files: [textFileLike(dot, "g.dot")],
    },
  });
}

describe("TerraformImportModal", () => {
  beforeEach(() => {
    vi.mocked(layoutTerraformViaWorkers).mockReset();
    vi.mocked(loadTerraformImportPresetSources).mockReset();
    hoisted.addFiles.mockReset();
    hoisted.replaceAllElements.mockReset();
    hoisted.scrollToContent.mockReset();
    hoisted.setAppState.mockReset();
  });

  it("disables import when only one of plan or dot is selected", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const planInputs = screen.getAllByLabelText(/plan file/i);
    fireEvent.change(planInputs[0], {
      target: {
        files: [textFileLike("{}", "p.json")],
      },
    });
    expect(
      screen.getByRole("button", { name: /import & open/i }),
    ).toBeDisabled();
  });

  it("disables semantic view radio until plan and dot are present", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const semantic = screen.getByRole("radio", { name: /semantic view/i });
    expect(semantic).toBeDisabled();
    fillFirstBundle();
    expect(semantic).not.toBeDisabled();
  });

  it("calls layoutTerraformViaWorkers with semanticLayout when semantic view is active", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    const onClose = vi.fn();
    render(<TerraformImportModal onCloseRequest={onClose} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: true,
      moduleLayoutOptions: undefined,
      colorMode: "category",
    });
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("passes layoutMode pipeline when Pipeline view is active", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /pipeline view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: false,
      layoutMode: "pipeline",
      pipelineCompact: true,
      pipelineLayoutVariant: "classic",
      pipelinePacked: false,
      moduleLayoutOptions: undefined,
      colorMode: "category",
    });
  });

  it("passes pipelineLayoutVariant compound when Compound layout is selected", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /pipeline view/i }));
    fireEvent.click(screen.getByRole("button", { name: /^compound$/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: false,
      layoutMode: "pipeline",
      pipelineCompact: true,
      pipelineLayoutVariant: "compound",
      pipelinePacked: false,
      moduleLayoutOptions: undefined,
      colorMode: "category",
    });
  });

  it("passes semanticLayout false for module view", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: false,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      colorMode: "category",
    });
  });

  it("shows module packing settings when module view is selected", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    expect(
      screen.queryByTestId("terraform-module-packing-settings"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    expect(
      screen.getByTestId("terraform-module-packing-settings"),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: /default grid/i })).toBeChecked();
  });

  it("passes selected rectpacking mode on module import", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("radio", { name: /elk rectpacking/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const options = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1];
    expect(options?.semanticLayout).toBe(false);
    expect(options?.moduleLayoutOptions?.mode).toBe("rectpacking");
  });

  it("passes semanticLayout false for module view with active preset manifest", async () => {
    vi.mocked(loadTerraformImportPresetSources).mockResolvedValue({
      planDotBundles: [
        {
          plan: { resource_changes: [] },
          dotText: "digraph {}",
          label: "00-east-network",
        },
      ],
      states: [],
      stateLabels: [],
      tfdTexts: [],
      tfdLabels: [],
      warnings: [],
    });
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /use preset manifest/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /use preset manifest/i }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: false,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      colorMode: "category",
    });
  });

  it("enables import with state file only", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/state \(/i), {
      target: {
        files: [textFileLike(JSON.stringify({ resources: [] }), "state.json")],
      },
    });
    expect(
      screen.getByRole("button", { name: /import & open/i }),
    ).not.toBeDisabled();
  });

  it("calls layoutTerraformViaWorkers with multiple states", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/state \(/i), {
      target: {
        files: [
          textFileLike(JSON.stringify({ resources: [] }), "a.json"),
          textFileLike(JSON.stringify({ resources: [] }), "b.json"),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const sources = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][0];
    expect(sources.states).toHaveLength(2);
    expect(sources.stateLabels).toEqual(["a.json", "b.json"]);
  });

  it("passes multiple tfd files to layoutTerraformViaWorkers", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.change(document.getElementById("terraform-import-links")!, {
      target: {
        files: [
          textFileLike("a -> b", "a.tfd"),
          textFileLike("b -> c", "b.tfd"),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const sources = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][0];
    expect(sources.tfdTexts).toHaveLength(2);
    expect(sources.tfdLabels).toEqual(["a.tfd", "b.tfd"]);
    expect(hoisted.setAppState).toHaveBeenCalledWith(
      expect.objectContaining({
        terraformEdgeLayerPins: expect.objectContaining({
          declaredDataFlow: true,
        }),
      }),
    );
  });

  it("imports with tfd overlay on semantic view", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.change(document.getElementById("terraform-import-links")!, {
      target: {
        files: [textFileLike("a -> b", "pipeline.tfd")],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual({
      semanticLayout: true,
      moduleLayoutOptions: undefined,
      colorMode: "category",
    });
  });

  it("shows Done and warnings when import succeeds with warnings", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      meta: {
        importWarnings: [
          {
            code: "duplicate_address",
            message: 'Address "x" overwritten.',
          },
        ],
      },
    });
    const onClose = vi.fn();
    render(<TerraformImportModal onCloseRequest={onClose} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() =>
      expect(screen.getByText(/overwritten/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows preset manifest table when Use preset manifest is clicked", async () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /use preset manifest/i }),
    );
    expect(
      screen.getByText(
        /packages\/backend\/terraform\/staging-multi-state\/00-east-network\/plan\.json/i,
      ),
    ).toBeInTheDocument();
  });

  it("loads selected preset and imports parsed sources", async () => {
    vi.mocked(loadTerraformImportPresetSources).mockResolvedValue({
      planDotBundles: [
        {
          plan: { resource_changes: [] },
          dotText: "digraph {}",
          label: "00-east-network",
        },
      ],
      states: [],
      stateLabels: [],
      tfdTexts: ["a -> b"],
      tfdLabels: ["pipeline.tfd"],
      warnings: [],
    });
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });

    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /load & import/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /load & import/i }));

    await waitFor(() =>
      expect(loadTerraformImportPresetSources).toHaveBeenCalled(),
    );
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const sources = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][0];
    expect(sources.planDotBundles).toHaveLength(1);
    expect(sources.tfdLabels).toEqual(["pipeline.tfd"]);
  });
});

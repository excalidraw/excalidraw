import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

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
      pipelinePackedPullLeft: false,
      pipelineIncludeAncillary: false,
      pipelineSemanticPlacement: false,
      pipelineSwimlaneLaneRise: false,
      pipelineReorder: false,
      pipelineSubnetDeBand: false,
      pipelineRankSeparate: false,
      pipelineStraighten: false,
      pipelineDeDensify: false,
      pipelineColumnPacking: "none",
      pipelineStaircaseBandOverlap: true,
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
      pipelinePackedPullLeft: false,
      pipelineIncludeAncillary: false,
      pipelineSemanticPlacement: false,
      pipelineSwimlaneLaneRise: false,
      pipelineReorder: false,
      pipelineSubnetDeBand: false,
      pipelineRankSeparate: false,
      pipelineStraighten: false,
      pipelineDeDensify: false,
      pipelineColumnPacking: "none",
      pipelineStaircaseBandOverlap: true,
      moduleLayoutOptions: undefined,
      colorMode: "category",
    });
  });

  it("RCLL view: imports as layoutMode rcll + hides the Layout variant control", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();

    // The Classic/Compound/V2 control is present under Pipeline view...
    fireEvent.click(screen.getByRole("radio", { name: /pipeline view/i }));
    expect(
      screen.queryByRole("button", { name: /^compound$/i }),
    ).toBeInTheDocument();

    // ...and hidden under RCLL view (the view forces its own variant).
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));
    expect(
      screen.queryByRole("button", { name: /^compound$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    // Routes as the rcll family + compact on. pipelineLayoutVariant is NOT
    // pinned here: the dialog may pass a stale variant and the layout core
    // forces "rcll" at context build (covered by terraformPipelineRcll.test.ts).
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        semanticLayout: false,
        layoutMode: "rcll",
        pipelineCompact: true,
      }),
    );
  });

  it("RCLL view: Swimlanes · Compact threads pipelineSwimlaneLaneRise true", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // The RCLL-only Lane height control is present; flip it to Risen (rise on).
    // Scoped to the Lane height group — "Risen" also appears under Cycle height.
    const swimlanes = screen.getByRole("group", {
      name: /pipeline lane height/i,
    });
    const risenBtn = within(swimlanes).getByRole("button", {
      name: /^risen$/i,
    });
    expect(risenBtn).toBeInTheDocument();
    fireEvent.click(risenBtn);

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineSwimlaneLaneRise: true,
      }),
    );
  });

  it("RCLL view: Ordering · On threads pipelineReorder true", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // The RCLL-only Ordering control is present; flip it On (M6 reorder).
    // Scoped to the Ordering group — "On" also appears under the new toggles.
    const ordering = screen.getByRole("group", { name: /pipeline ordering/i });
    const onBtn = within(ordering).getByRole("button", { name: /^on$/i });
    expect(onBtn).toBeInTheDocument();
    fireEvent.click(onBtn);

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineReorder: true,
      }),
    );
  });

  it("RCLL view: Subnets · De-banded threads pipelineSubnetDeBand true", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // The RCLL-only Subnets control is present; flip it to De-banded.
    const debandBtn = screen.getByRole("button", { name: /^de-banded$/i });
    expect(debandBtn).toBeInTheDocument();
    fireEvent.click(debandBtn);

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineSubnetDeBand: true,
      }),
    );
  });

  it("RCLL view: Lane split 'On' is disabled until Lane height = Risen, then threads pipelineRankSeparate true", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // Footgun guard: Lane split alone is a regression (taller/wider). Its "On"
    // is aria-disabled (focusable, so its help stays keyboard-reachable) until
    // the lane-rise is on.
    const separation = screen.getByRole("group", {
      name: /pipeline lane split/i,
    });
    const sepOn = within(separation).getByRole("button", { name: /^on$/i });
    expect(sepOn).toHaveAttribute("aria-disabled", "true");

    // Clicking it while gated does NOT flip rankSeparate (onClick suppressed).
    fireEvent.click(sepOn);
    expect(sepOn).toHaveAttribute("aria-pressed", "false");

    // Enable the lane-rise → Lane split "On" becomes available.
    const swimlanes = screen.getByRole("group", {
      name: /pipeline lane height/i,
    });
    fireEvent.click(within(swimlanes).getByRole("button", { name: /^risen$/i }));
    expect(
      within(separation).getByRole("button", { name: /^on$/i }),
    ).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(separation).getByRole("button", { name: /^on$/i }));

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineSwimlaneLaneRise: true,
        pipelineRankSeparate: true,
      }),
    );
  });

  it("RCLL view: turning Lane height back to Stacked clears a set Lane split", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    const swimlanes = screen.getByRole("group", {
      name: /pipeline lane height/i,
    });
    const separation = screen.getByRole("group", {
      name: /pipeline lane split/i,
    });
    // Risen → Lane split On → then back to Stacked (should clear Lane split).
    fireEvent.click(within(swimlanes).getByRole("button", { name: /^risen$/i }));
    fireEvent.click(within(separation).getByRole("button", { name: /^on$/i }));
    fireEvent.click(
      within(swimlanes).getByRole("button", { name: /^stacked$/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const opts = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(opts.pipelineSwimlaneLaneRise).toBe(false);
    expect(opts.pipelineRankSeparate).toBe(false);
  });

  it("RCLL view: Straighten · On threads pipelineStraighten true", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    const straighten = screen.getByRole("group", {
      name: /pipeline straighten/i,
    });
    fireEvent.click(within(straighten).getByRole("button", { name: /^on$/i }));

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineStraighten: true,
      }),
    );
  });

  it("RCLL view: Column packing · Spread threads pipelineColumnPacking spread", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    const packing = screen.getByRole("group", {
      name: /pipeline column packing/i,
    });
    fireEvent.click(within(packing).getByRole("button", { name: /^spread$/i }));

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineColumnPacking: "spread",
      }),
    );
  });

  it("RCLL view: Column packing · Compact threads pipelineColumnPacking compact (M5c)", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    const packing = screen.getByRole("group", {
      name: /pipeline column packing/i,
    });
    fireEvent.click(within(packing).getByRole("button", { name: /^compact$/i }));

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineColumnPacking: "compact",
      }),
    );
  });

  it("RCLL view: Cycle height defaults to Risen (true) and threads false when set to Stacked", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    const cycleBands = screen.getByRole("group", {
      name: /pipeline cycle height/i,
    });
    // Default is Risen (on) — flip it to Stacked.
    fireEvent.click(
      within(cycleBands).getByRole("button", { name: /^stacked$/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineStaircaseBandOverlap: false,
      }),
    );
  });

  it("RCLL view: hovering a geometry option shows a schematic figure in the help panel", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // The side help panel renders a decorative before/after <svg> for geometry
    // toggles. Hover the Lane height "Risen" arm → its schematic appears.
    const laneHeight = screen.getByRole("group", {
      name: /pipeline lane height/i,
    });
    fireEvent.mouseEnter(
      within(laneHeight).getByRole("button", { name: /^risen$/i }),
    );
    const help = screen.getByLabelText("Option explanation");
    expect(help.querySelector("svg")).toBeInTheDocument();
  });

  it("RCLL view: 'All resources' is disabled (ancillary not yet drawn in RCLL)", async () => {
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [],
      files: {},
    });
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /rcll view/i }));

    // RCLL is dataflow-only: "All resources" is inert, so it renders disabled and
    // "Dataflow only" reads active regardless of stored state — the toggle can't
    // mislead. (The full reserved-band feature is a deferred RFC milestone.)
    const allResources = screen.getByRole("button", { name: /^all resources$/i });
    expect(allResources).toHaveAttribute("aria-disabled", "true");
    const dataflowOnly = screen.getByRole("button", { name: /^dataflow only$/i });
    expect(dataflowOnly).toHaveAttribute("aria-pressed", "true");

    // Clicking the disabled option does NOT flip includeAncillary on the import.
    fireEvent.click(allResources);
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    expect(vi.mocked(layoutTerraformViaWorkers).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineIncludeAncillary: false,
      }),
    );
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
        screen.getByRole("button", { name: /edit before import/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /edit before import/i }),
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

  it("shows preset manifest table when Edit before import is clicked", async () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /edit before import/i }),
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
        screen.getByRole("button", { name: /import preset/i }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /import preset/i }));

    await waitFor(() =>
      expect(loadTerraformImportPresetSources).toHaveBeenCalled(),
    );
    await waitFor(() => expect(layoutTerraformViaWorkers).toHaveBeenCalled());
    const sources = vi.mocked(layoutTerraformViaWorkers).mock.calls[0][0];
    expect(sources.planDotBundles).toHaveLength(1);
    expect(sources.tfdLabels).toEqual(["pipeline.tfd"]);
  });

  it("keeps preset management and developer tools collapsed by default", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);

    expect(
      screen.getByText("Manage presets").closest("details"),
    ).not.toHaveAttribute("open");
    expect(
      screen.getByText("Developer tools").closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("shows selected state file names", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/state \(/i), {
      target: {
        files: [
          textFileLike(JSON.stringify({ resources: [] }), "prod.tfstate"),
        ],
      },
    });

    expect(screen.getByText("prod.tfstate")).toBeInTheDocument();
  });

  it("shows pipeline settings only when Pipeline view is selected", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();

    expect(screen.queryByText("Pipeline settings")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /pipeline view/i }));
    expect(screen.getByText("Pipeline settings")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /pipeline height packing/i }),
    ).toBeInTheDocument();
  });
});

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TerraformImportModal } from "./TerraformImportDialog";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

const hoisted = vi.hoisted(() => ({
  addFiles: vi.fn(),
  replaceAllElements: vi.fn(),
  scrollToContent: vi.fn(),
  setAppState: vi.fn(),
}));

vi.mock("./terraformPlanParsing", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./terraformPlanParsing")>();
  return {
    ...mod,
    terraformPlanParsingFromSources: vi.fn(),
  };
});

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
    vi.mocked(terraformPlanParsingFromSources).mockReset();
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

  it("calls terraformPlanParsingFromSources with semanticLayout when semantic view is active", async () => {
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onClose = vi.fn();
    render(<TerraformImportModal onCloseRequest={onClose} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() =>
      expect(terraformPlanParsingFromSources).toHaveBeenCalled(),
    );
    expect(vi.mocked(terraformPlanParsingFromSources).mock.calls[0][1]).toEqual(
      {
        semanticLayout: true,
      },
    );
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("passes semanticLayout false for module view", async () => {
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fillFirstBundle();
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() =>
      expect(terraformPlanParsingFromSources).toHaveBeenCalled(),
    );
    expect(vi.mocked(terraformPlanParsingFromSources).mock.calls[0][1]).toEqual(
      {
        semanticLayout: false,
      },
    );
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

  it("calls terraformPlanParsingFromSources with multiple states", async () => {
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
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
    await waitFor(() =>
      expect(terraformPlanParsingFromSources).toHaveBeenCalled(),
    );
    const sources = vi.mocked(terraformPlanParsingFromSources).mock.calls[0][0];
    expect(sources.states).toHaveLength(2);
    expect(sources.stateLabels).toEqual(["a.json", "b.json"]);
  });

  it("passes multiple tfd files to terraformPlanParsingFromSources", async () => {
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
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
    await waitFor(() =>
      expect(terraformPlanParsingFromSources).toHaveBeenCalled(),
    );
    const sources = vi.mocked(terraformPlanParsingFromSources).mock.calls[0][0];
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

  it("shows Done and warnings when import succeeds with warnings", async () => {
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [],
          meta: {
            importWarnings: [
              {
                code: "duplicate_address",
                message: 'Address "x" overwritten.',
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
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
});

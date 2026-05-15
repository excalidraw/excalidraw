import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TerraformImportModal } from "./TerraformImportDialog";
import { terraformPlanParsing } from "./terraformPlanParsing";

const hoisted = vi.hoisted(() => ({
  addFiles: vi.fn(),
  replaceAllElements: vi.fn(),
  scrollToContent: vi.fn(),
  setAppState: vi.fn(),
}));

vi.mock("./terraformPlanParsing", () => ({
  terraformPlanParsing: vi.fn(),
}));

vi.mock("./App", () => ({
  useApp: () => ({
    addFiles: hoisted.addFiles,
    scene: { replaceAllElements: hoisted.replaceAllElements },
    scrollToContent: hoisted.scrollToContent,
  }),
  useExcalidrawSetAppState: () => hoisted.setAppState,
}));

describe("TerraformImportModal", () => {
  beforeEach(() => {
    vi.mocked(terraformPlanParsing).mockReset();
    hoisted.addFiles.mockReset();
    hoisted.replaceAllElements.mockReset();
    hoisted.scrollToContent.mockReset();
    hoisted.setAppState.mockReset();
  });

  it("disables import when only one of plan or dot is selected", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const planInput = screen.getByLabelText(/plan file/i);
    fireEvent.change(planInput, {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    expect(
      screen.getByRole("button", { name: /import & open/i }),
    ).toBeDisabled();
  });

  it("disables semantic view radio until both plan and dot are present", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const semantic = screen.getByRole("radio", { name: /semantic view/i });
    expect(semantic).toBeDisabled();
    const planInput = screen.getByLabelText(/plan file/i);
    const dotInput = screen.getByLabelText(/graph file/i);
    fireEvent.change(planInput, {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    expect(semantic).toBeDisabled();
    fireEvent.change(dotInput, {
      target: {
        files: [new File(["digraph {}"], "g.dot", { type: "text/plain" })],
      },
    });
    expect(semantic).not.toBeDisabled();
  });

  it("calls terraformPlanParsing with semanticLayout when semantic view is active", async () => {
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onClose = vi.fn();
    render(<TerraformImportModal onCloseRequest={onClose} />);
    fireEvent.change(screen.getByLabelText(/plan file/i), {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/graph file/i), {
      target: {
        files: [new File(["digraph {}"], "g.dot", { type: "text/plain" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(terraformPlanParsing).toHaveBeenCalled());
    expect(vi.mocked(terraformPlanParsing).mock.calls[0][3]).toEqual({
      semanticLayout: true,
    });
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
    expect(hoisted.setAppState).toHaveBeenCalledWith({
      terraformEdgeLayerPins: {
        dependency: false,
        dataFlow: false,
        networking: false,
      },
      terraformEdgeHoverPeekKey: null,
    });
    expect(hoisted.scrollToContent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("passes semanticLayout false for module view", async () => {
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/plan file/i), {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/graph file/i), {
      target: {
        files: [new File(["digraph {}"], "g.dot", { type: "text/plain" })],
      },
    });
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(terraformPlanParsing).toHaveBeenCalled());
    expect(vi.mocked(terraformPlanParsing).mock.calls[0][3]).toEqual({
      semanticLayout: false,
    });
  });

  it("surfaces API errors in the error banner", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ error: "bad plan" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/plan file/i), {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/graph file/i), {
      target: {
        files: [new File(["digraph {}"], "g.dot", { type: "text/plain" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() =>
      expect(screen.getByText(/bad plan/)).toBeInTheDocument(),
    );
    errSpy.mockRestore();
  });

  it("enables state file input", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    expect(screen.getByLabelText(/state file/i)).not.toBeDisabled();
  });

  it("enables import with state file only", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/state file/i), {
      target: {
        files: [
          new File([JSON.stringify({ resources: [] })], "state.json", {
            type: "application/json",
          }),
        ],
      },
    });
    expect(
      screen.getByRole("button", { name: /import & open/i }),
    ).not.toBeDisabled();
  });

  it("enables semantic view radio when state file only is selected", () => {
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    expect(
      screen.getByRole("radio", { name: /semantic view/i }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/state file/i), {
      target: {
        files: [
          new File([JSON.stringify({ resources: [] })], "state.json", {
            type: "application/json",
          }),
        ],
      },
    });
    expect(
      screen.getByRole("radio", { name: /semantic view/i }),
    ).not.toBeDisabled();
  });

  it("calls terraformPlanParsing with state only and semantic view by default", async () => {
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const stateFile = new File(
      [JSON.stringify({ resources: [] })],
      "state.json",
      { type: "application/json" },
    );
    fireEvent.change(screen.getByLabelText(/state file/i), {
      target: { files: [stateFile] },
    });
    expect(screen.getByRole("radio", { name: /semantic view/i })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(terraformPlanParsing).toHaveBeenCalled());
    expect(vi.mocked(terraformPlanParsing).mock.calls[0]).toEqual([
      null,
      null,
      stateFile,
      { semanticLayout: true },
    ]);
  });

  it("calls terraformPlanParsing with state only and module view when selected", async () => {
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const stateFile = new File(
      [JSON.stringify({ resources: [] })],
      "state.json",
      { type: "application/json" },
    );
    fireEvent.change(screen.getByLabelText(/state file/i), {
      target: { files: [stateFile] },
    });
    fireEvent.click(screen.getByRole("radio", { name: /module view/i }));
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(terraformPlanParsing).toHaveBeenCalled());
    expect(vi.mocked(terraformPlanParsing).mock.calls[0]).toEqual([
      null,
      null,
      stateFile,
      { semanticLayout: false },
    ]);
  });

  it("passes state file when plan, dot, and state are selected", async () => {
    vi.mocked(terraformPlanParsing).mockResolvedValue(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    const planFile = new File(["{}"], "p.json", { type: "application/json" });
    const dotFile = new File(["digraph {}"], "g.dot", { type: "text/plain" });
    const stateFile = new File(
      [JSON.stringify({ resources: [] })],
      "state.json",
      { type: "application/json" },
    );
    fireEvent.change(screen.getByLabelText(/plan file/i), {
      target: { files: [planFile] },
    });
    fireEvent.change(screen.getByLabelText(/graph file/i), {
      target: { files: [dotFile] },
    });
    fireEvent.change(screen.getByLabelText(/state file/i), {
      target: { files: [stateFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    await waitFor(() => expect(terraformPlanParsing).toHaveBeenCalled());
    expect(vi.mocked(terraformPlanParsing).mock.calls[0]).toEqual([
      planFile,
      dotFile,
      stateFile,
      { semanticLayout: true },
    ]);
  });

  it("shows Importing while the parse request is in flight", async () => {
    let resolveReq!: (v: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveReq = resolve;
    });
    vi.mocked(terraformPlanParsing).mockReturnValue(pending);
    render(<TerraformImportModal onCloseRequest={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/plan file/i), {
      target: {
        files: [new File(["{}"], "p.json", { type: "application/json" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/graph file/i), {
      target: {
        files: [new File(["digraph {}"], "g.dot", { type: "text/plain" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import & open/i }));
    expect(await screen.findByText(/importing/i)).toBeInTheDocument();
    resolveReq(
      new Response(JSON.stringify({ elements: [], files: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText(/importing/i)).not.toBeInTheDocument(),
    );
  });
});

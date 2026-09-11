import React from "react";

import { Excalidraw } from "../index";
import {
  fireEvent,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../tests/test-utils";

describe("HelpDialog", () => {
  const renderHelpDialog = async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: { openDialog: { name: "help" } },
        }}
      />,
    );
    await withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {});
  };

  beforeEach(async () => {
    localStorage.clear();
    await renderHelpDialog();
  });

  it("renders the help dialog with search input", async () => {
    const searchInput = document.querySelector(
      'input[placeholder="Search shortcuts..."]',
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("focuses search input on mount", async () => {
    const searchInput = document.querySelector(
      'input[placeholder="Search shortcuts..."]',
    ) as HTMLInputElement;
    expect(searchInput).toHaveFocus();
  });

  it("filters shortcuts when searching", async () => {
    const searchInput = document.querySelector(
      'input[placeholder="Search shortcuts..."]',
    ) as HTMLInputElement;

    // Type in search box
    fireEvent.change(searchInput, { target: { value: "zoom" } });

    // Wait for filtering
    await waitFor(() => {
      // Should show zoom related shortcuts
      expect(document.body.textContent).toContain("Zoom in");
      expect(document.body.textContent).toContain("Zoom out");
      expect(document.body.textContent).toContain("Reset zoom");
    });
  });

  it("captures Ctrl+F and focuses search input", async () => {
    const searchInput = document.querySelector(
      'input[placeholder="Search shortcuts..."]',
    ) as HTMLInputElement;
    expect(searchInput).toHaveFocus();

    // Simulate Ctrl+F - it should refocus the search input
    fireEvent.keyDown(document, { key: "f", ctrlKey: true });

    // Search input should still be focused
    expect(searchInput).toHaveFocus();
  });

  it("shows all shortcuts when search is empty", async () => {
    // Should see tools section
    expect(document.body.textContent).toContain("Keyboard shortcuts");
    expect(document.body.textContent).toContain("Tools");
    expect(document.body.textContent).toContain("View");
    expect(document.body.textContent).toContain("Editor");

    // Should see some specific shortcuts
    expect(document.body.textContent).toContain("Hand");
    expect(document.body.textContent).toContain("Selection");
    expect(document.body.textContent).toContain("Rectangle");
  });

  it("filters correctly for partial matches", async () => {
    const searchInput = document.querySelector(
      'input[placeholder="Search shortcuts..."]',
    ) as HTMLInputElement;

    // Search for "copy"
    fireEvent.change(searchInput, { target: { value: "copy" } });

    await waitFor(() => {
      expect(document.body.textContent).toContain("Copy");
      expect(document.body.textContent).toContain("Copy styles");
    });
    // "Paste styles" doesn't match "copy" — its label and shortcut lack it
    expect(document.body.textContent).not.toContain("Paste styles");
  });
});
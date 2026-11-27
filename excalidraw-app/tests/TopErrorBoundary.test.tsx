import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { TopErrorBoundary } from "../components/TopErrorBoundary";

vi.mock("@sentry/browser", () => ({
  withScope: (callback: (scope: { setExtras: () => void }) => void) =>
    callback({ setExtras: vi.fn() }),
  captureException: () => "test-event-id",
}));

it("renders recovery controls without the editor provider after an error", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const ThrowingComponent = () => {
    throw new Error("Editor failed");
  };

  localStorage.setItem("excalidraw-boundary-test", "saved scene");
  try {
    render(
      <TopErrorBoundary>
        <ThrowingComponent />
      </TopErrorBoundary>,
    );

    expect(
      screen.getByRole("button", { name: "reloading the page" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(localStorage.getItem("excalidraw-boundary-test")).toBe(
      "saved scene",
    );
  } finally {
    consoleError.mockRestore();
    localStorage.removeItem("excalidraw-boundary-test");
  }
});

import { render, screen, fireEvent } from "@testing-library/react";
import { AppMainMenu } from "../components/AppMainMenu";
import type { Theme } from "@excalidraw/element/types";

describe("AppMainMenu", () => {
  it("should show a confirmation dialog and clear the canvas when confirmed", () => {
    const mockUpdateScene = jest.fn();
    const mockExcalidrawAPI = { updateScene: mockUpdateScene };

    render(<AppMainMenu excalidrawAPI={mockExcalidrawAPI} onCollabDialogOpen={function () {
        throw new Error("Function not implemented.");
    } } isCollaborating={false} isCollabEnabled={false} theme={"light"} setTheme={function (theme: Theme | "system"): void {
        throw new Error("Function not implemented.");
    } } refresh={function (): void {
        throw new Error("Function not implemented.");
    } } />);

    // Click the "Clear Canvas" button
    const clearCanvasButton = screen.getByText("Clear Canvas");
    fireEvent.click(clearCanvasButton);

    // Verify the confirmation dialog appears
    expect(screen.getByText("Clear Canvas")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to clear the canvas?")
    ).toBeInTheDocument();

    // Confirm the action
    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);

    // Verify the canvas is cleared
    expect(mockUpdateScene).toHaveBeenCalledWith({ elements: [] });
  });
});
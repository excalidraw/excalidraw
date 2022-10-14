import React from "react";
import { Excalidraw, Sidebar } from "../../packages/excalidraw/index";
import {
  fireEvent,
  queryAllByTestId,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

describe("Sidebar", () => {
  it("should render custom sidebar", async () => {
    const { container } = await render(
      <Excalidraw
        renderSidebar={() => (
          <Sidebar>
            <div id="test-sidebar-content">42</div>
          </Sidebar>
        )}
      />,
    );

    const node = container.querySelector("#test-sidebar-content");
    expect(node).not.toBe(null);
  });

  it("should render custom sidebar header", async () => {
    const { container } = await render(
      <Excalidraw
        renderSidebar={() => (
          <Sidebar>
            <Sidebar.Header>
              <div id="test-sidebar-header-content">42</div>
            </Sidebar.Header>
          </Sidebar>
        )}
      />,
    );

    const node = container.querySelector("#test-sidebar-header-content");
    expect(node).not.toBe(null);
    // make sure we don't render the default fallback header,
    // just the custom one
    expect(queryAllByTestId(container, "sidebar-header").length).toBe(1);
  });

  it("should render only one sidebar and prefer the custom one", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{ appState: { isLibraryOpen: true } }}
        renderSidebar={() => (
          <Sidebar>
            <div id="test-sidebar-content">42</div>
          </Sidebar>
        )}
      />,
    );

    await waitFor(() => {
      // make sure the custom sidebar is rendered
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);

      // make sure only one sidebar is rendered
      const sidebars = container.querySelectorAll(".layer-ui__sidebar");
      expect(sidebars.length).toBe(1);
    });
  });

  it("should render custom sidebar with close button when onClose passed", async () => {
    const CustomExcalidraw = () => {
      const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

      return (
        <Excalidraw
          renderSidebar={() => {
            return isSidebarOpen ? (
              <Sidebar
                className="test-sidebar"
                onClose={() => {
                  setIsSidebarOpen(false);
                }}
              >
                hello
              </Sidebar>
            ) : null;
          }}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
    expect(sidebar).not.toBe(null);
    const closeButton = queryByTestId(sidebar!, "sidebar-close");
    expect(closeButton).not.toBe(null);

    fireEvent.click(closeButton!.querySelector("button")!);
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(null);
    });
  });

  it("should render custom sidebar with dock button when onDock passed", async () => {
    const CustomExcalidraw = () => {
      const [isDocked, setIsDocked] = React.useState(true);

      return (
        <Excalidraw
          renderSidebar={() => (
            <Sidebar
              className="test-sidebar"
              docked={isDocked}
              onDock={() => setIsDocked(false)}
            >
              hello
            </Sidebar>
          )}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    // should show dock button when the sidebar fits to be docked
    // -------------------------------------------------------------------------

    withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {
      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-dock");
      expect(closeButton).not.toBe(null);
    });

    // should not show dock button when the sidebar does not fit to be docked
    // -------------------------------------------------------------------------

    withExcalidrawDimensions({ width: 400, height: 1080 }, () => {
      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-dock");
      expect(closeButton).toBe(null);
    });
  });
});

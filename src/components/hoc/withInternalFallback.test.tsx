import { render, queryAllByTestId } from "../../tests/test-utils";
import { Excalidraw, MainMenu } from "../../packages/excalidraw/index";

describe("Test internal component fallback rendering", () => {
  it("should render only one menu per excalidraw instance (custom menu first scenario)", async () => {
    const { container } = await render(
      <div>
        <Excalidraw>
          <MainMenu>test</MainMenu>
        </Excalidraw>
        <Excalidraw />
      </div>,
    );

    expect(queryAllByTestId(container, "dropdown-menu-button")?.length).toBe(2);

    const excalContainers = container.querySelectorAll<HTMLDivElement>(
      ".excalidraw-container",
    );

    expect(
      queryAllByTestId(excalContainers[0], "dropdown-menu-button")?.length,
    ).toBe(1);
    expect(
      queryAllByTestId(excalContainers[1], "dropdown-menu-button")?.length,
    ).toBe(1);
  });

  it("should render only one menu per excalidraw instance (default menu first scenario)", async () => {
    const { container } = await render(
      <div>
        <Excalidraw />
        <Excalidraw>
          <MainMenu>test</MainMenu>
        </Excalidraw>
      </div>,
    );

    expect(queryAllByTestId(container, "dropdown-menu-button")?.length).toBe(2);

    const excalContainers = container.querySelectorAll<HTMLDivElement>(
      ".excalidraw-container",
    );

    expect(
      queryAllByTestId(excalContainers[0], "dropdown-menu-button")?.length,
    ).toBe(1);
    expect(
      queryAllByTestId(excalContainers[1], "dropdown-menu-button")?.length,
    ).toBe(1);
  });

  it("should render only one menu per excalidraw instance (two custom menus scenario)", async () => {
    const { container } = await render(
      <div>
        <Excalidraw>
          <MainMenu>test</MainMenu>
        </Excalidraw>
        <Excalidraw>
          <MainMenu>test</MainMenu>
        </Excalidraw>
      </div>,
    );

    expect(queryAllByTestId(container, "dropdown-menu-button")?.length).toBe(2);

    const excalContainers = container.querySelectorAll<HTMLDivElement>(
      ".excalidraw-container",
    );

    expect(
      queryAllByTestId(excalContainers[0], "dropdown-menu-button")?.length,
    ).toBe(1);
    expect(
      queryAllByTestId(excalContainers[1], "dropdown-menu-button")?.length,
    ).toBe(1);
  });

  it("should render only one menu per excalidraw instance (two default menus scenario)", async () => {
    const { container } = await render(
      <div>
        <Excalidraw />
        <Excalidraw />
      </div>,
    );

    expect(queryAllByTestId(container, "dropdown-menu-button")?.length).toBe(2);

    const excalContainers = container.querySelectorAll<HTMLDivElement>(
      ".excalidraw-container",
    );

    expect(
      queryAllByTestId(excalContainers[0], "dropdown-menu-button")?.length,
    ).toBe(1);
    expect(
      queryAllByTestId(excalContainers[1], "dropdown-menu-button")?.length,
    ).toBe(1);
  });
});

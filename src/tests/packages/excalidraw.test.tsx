import { fireEvent, GlobalTestState, render } from "../test-utils";
import { Excalidraw, Footer } from "../../packages/excalidraw/index";
import { queryByText, queryByTestId } from "@testing-library/react";
import { GRID_SIZE, THEME } from "../../constants";
import { t } from "../../i18n";

const { h } = window;

describe("<Excalidraw/>", () => {
  describe("Test zenModeEnabled prop", () => {
    it('should show exit zen mode button when zen mode is set and zen mode option in context menu when zenModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(false);

      fireEvent.contextMenu(GlobalTestState.canvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Zen mode")!);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(1);
    });

    it("should not show exit zen mode button and zen mode option in context menu when zenModeEnabled is set", async () => {
      const { container } = await render(<Excalidraw zenModeEnabled={true} />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(true);

      fireEvent.contextMenu(GlobalTestState.canvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Zen mode")).toBe(null);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
    });
  });

  it("should render the footer only when Footer is passed as children", async () => {
    //Footer not passed hence it will not render the footer
    let { container } = await render(
      <Excalidraw>
        <div>This is a custom footer</div>
      </Excalidraw>,
    );
    expect(
      container.querySelector(".layer-ui__wrapper__footer-center"),
    ).toBeEmptyDOMElement();

    // Footer passed hence it will render the footer
    ({ container } = await render(
      <Excalidraw>
        <Footer>
          <div>This is a custom footer</div>
        </Footer>
      </Excalidraw>,
    ));
    expect(
      container.querySelector(".layer-ui__wrapper__footer-center")?.innerHTML,
    ).toMatchInlineSnapshot(
      `"<div class=\\"layer-ui__wrapper__footer-center zen-mode-transition\\"><div>This is a custom footer</div></div>"`,
    );
  });
  describe("Test gridModeEnabled prop", () => {
    it('should show grid mode in context menu when gridModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(h.state.gridSize).toBe(null);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.canvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Show grid")!);
      expect(h.state.gridSize).toBe(GRID_SIZE);
    });

    it('should not show grid mode in context menu when gridModeEnabled is not "undefined"', async () => {
      const { container } = await render(
        <Excalidraw gridModeEnabled={false} />,
      );
      expect(h.state.gridSize).toBe(null);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.canvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Show grid")).toBe(null);
      expect(h.state.gridSize).toBe(null);
    });
  });

  describe("Test theme prop", () => {
    it("should show the theme toggle by default", async () => {
      const { container } = await render(<Excalidraw />);

      expect(h.state.theme).toBe(THEME.LIGHT);

      queryByTestId(container, "menu-button")!.click();
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when the theme prop is defined", async () => {
      const { container } = await render(<Excalidraw theme="dark" />);
      expect(h.state.theme).toBe(THEME.DARK);
      expect(queryByTestId(container, "toggle-dark-mode")).toBe(null);
    });

    it("should show theme mode toggle when `UIOptions.canvasActions.toggleTheme` is true", async () => {
      const { container } = await render(
        <Excalidraw
          theme={THEME.DARK}
          UIOptions={{ canvasActions: { toggleTheme: true } }}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when `UIOptions.canvasActions.toggleTheme` is false", async () => {
      const { container } = await render(
        <Excalidraw
          UIOptions={{ canvasActions: { toggleTheme: false } }}
          theme={THEME.DARK}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeFalsy();
    });
  });

  describe("Test name prop", () => {
    it('should allow editing name when the name prop is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);

      fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput: HTMLInputElement | null = document.querySelector(
        ".ExportDialog .ProjectName .TextInput",
      );
      expect(textInput?.value).toContain(`${t("labels.untitled")}`);
      expect(textInput?.nodeName).toBe("INPUT");
    });

    it('should set the name and not allow editing when the name prop is present"', async () => {
      const name = "test";
      const { container } = await render(<Excalidraw name={name} />);

      await fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput = document.querySelector(
        ".ExportDialog .ProjectName .TextInput--readonly",
      );
      expect(textInput?.textContent).toEqual(name);
      expect(textInput?.nodeName).toBe("SPAN");
    });
  });

  describe("Test UIOptions prop", () => {
    it('should not hide any UI element when the UIOptions prop is "undefined"', async () => {
      await render(<Excalidraw />);

      const canvasActions = document.querySelector(
        'section[aria-labelledby="test-id-canvasActions-title"]',
      );

      expect(canvasActions).toMatchSnapshot();
    });

    describe("Test canvasActions", () => {
      it('should not hide any UI element when canvasActions is "undefined"', async () => {
        await render(<Excalidraw UIOptions={{}} />);
        const canvasActions = document.querySelector(
          'section[aria-labelledby="test-id-canvasActions-title"]',
        );
        expect(canvasActions).toMatchSnapshot();
      });

      it("should hide clear canvas button when clearCanvas is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { clearCanvas: false } }} />,
        );

        expect(queryByTestId(container, "clear-canvas-button")).toBeNull();
      });

      it("should hide export button when export is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { export: false } }} />,
        );

        expect(queryByTestId(container, "json-export-button")).toBeNull();
      });

      it("should hide 'Save as image' button when 'saveAsImage' is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { saveAsImage: false } }} />,
        );

        expect(queryByTestId(container, "image-export-button")).toBeNull();
      });

      it("should hide load button when loadScene is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
        );

        expect(queryByTestId(container, "load-button")).toBeNull();
      });

      it("should hide save as button when saveFileToDisk is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { export: { saveFileToDisk: false } } }}
          />,
        );

        expect(queryByTestId(container, "save-as-button")).toBeNull();
      });

      it("should hide save button when saveToActiveFile is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { saveToActiveFile: false } }}
          />,
        );

        expect(queryByTestId(container, "save-button")).toBeNull();
      });

      it("should hide the canvas background picker when changeViewBackgroundColor is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }}
          />,
        );

        expect(queryByTestId(container, "canvas-background-picker")).toBeNull();
      });

      it("should hide the theme toggle when theme is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { toggleTheme: false } }} />,
        );

        expect(queryByTestId(container, "toggle-dark-mode")).toBeNull();
      });
    });
  });

  describe("Test autoFocus prop", () => {
    it("should not focus when autoFocus is false", async () => {
      const { container } = await render(<Excalidraw />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(false);
    });

    it("should focus when autoFocus is true", async () => {
      const { container } = await render(<Excalidraw autoFocus={true} />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(true);
    });
  });
});

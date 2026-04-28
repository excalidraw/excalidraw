import { Excalidraw } from "../index";

import { Pointer } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { ExcalidrawProps } from "../types";

describe("embeddable interactions", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");

  const renderGoogleDriveEmbeddable = async (
    excalidrawProps: Partial<ExcalidrawProps> = {},
  ) => {
    const renderResult = await render(<Excalidraw {...excalidrawProps} />);
    const fileId = "1AbCdEfGhIjKlMnOpQrStUvWxYz123456";
    const src = `https://drive.google.com/file/d/${fileId}/preview`;
    let embeddable!: NonNullable<
      ReturnType<typeof h.app.insertEmbeddableElement>
    >;

    act(() => {
      const insertedEmbeddable = h.app.insertEmbeddableElement({
        sceneX: 40,
        sceneY: 40,
        link: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
      });

      if (!insertedEmbeddable) {
        throw new Error("Google Drive embeddable not inserted");
      }

      embeddable = insertedEmbeddable;
    });

    (
      h.app as unknown as {
        embedsValidationStatus: Map<string, boolean>;
      }
    ).embedsValidationStatus.set(embeddable.id, true);

    act(() => {
      h.setState({ width: 1000, height: 1000 });
      h.app.scene.triggerUpdate();
    });

    const getIframe = () => {
      const iframe = renderResult.container.querySelector<HTMLIFrameElement>(
        "iframe.excalidraw__embeddable",
      );

      if (!iframe) {
        throw new Error("Google Drive iframe not rendered");
      }

      return iframe;
    };

    await waitFor(() => {
      expect(getIframe().src).toBe(src);
    });

    return {
      ...renderResult,
      embeddable,
      getIframe,
      src,
    };
  };

  it("lets the initial Google Drive video click land in the iframe center", async () => {
    const { container, embeddable, getIframe, src } =
      await renderGoogleDriveEmbeddable();

    mouse.moveTo(
      embeddable.x + embeddable.width / 2,
      embeddable.y + embeddable.height / 2,
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          ".excalidraw__embeddable-container__inner",
        )?.style.pointerEvents,
      ).toBe("all");
      expect(h.state.activeEmbeddable?.element.id).toBe(embeddable.id);
      expect(h.state.activeEmbeddable?.state).toBe("active");
      expect(
        container.querySelectorAll(".excalidraw__embeddable-canvas-guard"),
      ).toHaveLength(4);
      expect(
        container.querySelector(".excalidraw__embeddable-hint"),
      ).toBeNull();
      expect(getIframe().src).toBe(src);
    });
  });

  it("returns Drive embeddable edge interactions to the canvas", async () => {
    const { container, embeddable } = await renderGoogleDriveEmbeddable();

    act(() => {
      h.setState({
        activeEmbeddable: { element: embeddable, state: "active" },
      });
    });

    const guard = container.querySelector<HTMLElement>(
      ".excalidraw__embeddable-canvas-guard",
    );
    expect(guard).not.toBeNull();

    fireEvent.pointerMove(guard!, {
      clientX: embeddable.x + 1,
      clientY: embeddable.y + 1,
    });

    await waitFor(() => {
      expect(h.state.activeEmbeddable).toBeNull();
      expect(
        container.querySelector<HTMLElement>(
          ".excalidraw__embeddable-container__inner",
        )?.style.pointerEvents,
      ).toBe("none");
    });
  });

  it("deactivates an interactive embeddable on Ctrl/Cmd keydown", async () => {
    const { embeddable } = await renderGoogleDriveEmbeddable({
      handleKeyboardGlobally: true,
    });

    mouse.moveTo(
      embeddable.x + embeddable.width / 2,
      embeddable.y + embeddable.height / 2,
    );

    await waitFor(() => {
      expect(h.state.activeEmbeddable?.state).toBe("active");
    });

    fireEvent.keyDown(document, {
      key: "Control",
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(h.state.activeEmbeddable).toBeNull();
    });
  });

  it("handles Ctrl/Cmd wheel on Drive embeddable guards", async () => {
    const { container, embeddable } = await renderGoogleDriveEmbeddable();

    act(() => {
      h.setState({
        activeEmbeddable: { element: embeddable, state: "active" },
      });
    });

    const guard = container.querySelector<HTMLElement>(
      ".excalidraw__embeddable-canvas-guard",
    );
    expect(guard).not.toBeNull();

    const prevZoom = h.state.zoom.value;

    fireEvent.wheel(guard!, {
      clientX: embeddable.x + 1,
      clientY: embeddable.y + 1,
      ctrlKey: true,
      deltaY: -100,
    });

    await waitFor(() => {
      expect(h.state.activeEmbeddable).toBeNull();
      expect(h.state.zoom.value).toBeGreaterThan(prevZoom);
    });
  });
});

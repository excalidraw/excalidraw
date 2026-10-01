import { isInputLike, KEYS } from "@excalidraw/common";

import {
  isFrameLikeElement,
  sortFramesInReadingOrder,
} from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import type React from "react";
import type { AppState } from "../types";
import type App from "./App";

const SLIDE_TRANSITION_DURATION = 400;

type RestoreState = Pick<
  AppState,
  "viewModeEnabled" | "frameRendering" | "scrollX" | "scrollY" | "zoom"
>;

/**
 * Presents frames as slides: each frame is fit into the viewport (fullscreen
 * when the browser allows it), the editor UI is hidden, and the keyboard or
 * on-screen controls step between frames.
 */
export class AppPresentation {
  private restoreState: RestoreState | null = null;
  private enteredFullscreen = false;
  /** frame version the viewport was last fit to, so edits (e.g. from
   * collaborators) to the current frame re-fit it */
  private fittedVersion: number | null = null;

  constructor(private app: App) {}

  getSlides = () =>
    sortFramesInReadingOrder(this.app.scene.getNonDeletedFramesLikes());

  private getFrame = (frameId: ExcalidrawFrameLikeElement["id"]) => {
    const frame = this.app.scene.getNonDeletedElementsMap().get(frameId);
    return frame && isFrameLikeElement(frame) ? frame : null;
  };

  getCurrentFrame = () => {
    const frameId = this.app.state.presentation?.frameId;
    return frameId ? this.getFrame(frameId) : null;
  };

  /** starts presenting from `frameId`, or from the first slide */
  start = (frameId?: ExcalidrawFrameLikeElement["id"]) => {
    const slides = this.getSlides();

    if (!slides.length) {
      this.app.setToast({ message: t("presentation.noFrames") });
      return;
    }

    const frame = slides.find((slide) => slide.id === frameId) ?? slides[0];

    if (!this.restoreState) {
      const { viewModeEnabled, frameRendering, scrollX, scrollY, zoom } =
        this.app.state;
      this.restoreState = {
        viewModeEnabled,
        frameRendering,
        scrollX,
        scrollY,
        zoom,
      };
    }

    this.app.setState({
      viewModeEnabled: true,
      frameRendering: {
        ...this.app.state.frameRendering,
        enabled: true,
        clip: true,
        name: false,
        outline: false,
      },
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
      openMenu: null,
      openPopup: null,
      openSidebar: null,
      openDialog: null,
      contextMenu: null,
      showHyperlinkPopup: false,
      toast: null,
    });

    this.requestFullscreen();
    this.goTo(frame.id, { animate: false });
  };

  stop = () => {
    if (!this.app.state.presentation) {
      return;
    }

    const restoreState = this.restoreState;
    this.restoreState = null;
    this.fittedVersion = null;

    this.app.viewport.setViewport(null);
    if (restoreState) {
      this.app.setState({
        ...restoreState,
        presentation: null,
        viewModeEnabled:
          this.app.props.viewModeEnabled ?? restoreState.viewModeEnabled,
      });
    } else {
      this.app.setState({ presentation: null });
    }

    this.exitFullscreen();
  };

  goTo = (
    frameId: ExcalidrawFrameLikeElement["id"],
    opts?: { animate?: boolean },
  ) => {
    const frame = this.getFrame(frameId);
    if (!frame) {
      return;
    }

    this.fittedVersion = frame.version;

    if (this.app.state.presentation?.frameId !== frame.id) {
      this.app.setState({ presentation: { frameId: frame.id } });
    }

    this.app.viewport.setViewport({
      target: frame,
      fit: "contain",
      lock: { scroll: true, zoom: true, overscroll: false },
      animation: opts?.animate
        ? { duration: SLIDE_TRANSITION_DURATION }
        : false,
    });
  };

  next = () => this.step(1);

  prev = () => this.step(-1);

  private step = (delta: number) => {
    const slides = this.getSlides();
    const index = slides.findIndex(
      (slide) => slide.id === this.app.state.presentation?.frameId,
    );
    this.goToIndex(index === -1 ? 0 : index + delta, slides);
  };

  private goToIndex = (
    index: number,
    slides: NonDeleted<ExcalidrawFrameLikeElement>[] = this.getSlides(),
  ) => {
    const slide = slides[index];
    if (slide && slide.id !== this.app.state.presentation?.frameId) {
      this.goTo(slide.id, { animate: true });
    }
  };

  /** returns `true` if the event was handled */
  handleKeyEvent = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    if (
      !this.app.state.presentation ||
      isInputLike(event.target) ||
      event[KEYS.CTRL_OR_CMD] ||
      event.altKey
    ) {
      return false;
    }

    switch (event.key) {
      case KEYS.ARROW_RIGHT:
      case KEYS.ARROW_DOWN:
      case KEYS.PAGE_DOWN:
      case KEYS.SPACE:
      case KEYS.ENTER:
      case KEYS.N:
        this.next();
        break;
      case KEYS.ARROW_LEFT:
      case KEYS.ARROW_UP:
      case KEYS.PAGE_UP:
      case KEYS.BACKSPACE:
      case KEYS.P:
        this.prev();
        break;
      case KEYS.HOME:
        this.goToIndex(0);
        break;
      case KEYS.END:
        this.goToIndex(this.getSlides().length - 1);
        break;
      case KEYS.ESCAPE:
        this.stop();
        break;
      default:
        return false;
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  /** keeps the current slide fit to the viewport as the canvas resizes or
   * the frame changes, and moves on if the frame gets deleted */
  onUpdate = (prevState: AppState) => {
    if (!this.app.state.presentation) {
      return;
    }

    const frame = this.getCurrentFrame();

    if (!frame) {
      const [slide] = this.getSlides();
      if (slide) {
        this.goTo(slide.id, { animate: false });
      } else {
        this.stop();
      }
      return;
    }

    if (
      prevState.width !== this.app.state.width ||
      prevState.height !== this.app.state.height ||
      frame.version !== this.fittedVersion
    ) {
      this.goTo(frame.id, { animate: false });
    }
  };

  /** ends the presentation when the user leaves fullscreen (browsers consume
   * the Escape key in fullscreen, so we never get its keydown) */
  onFullscreenChange = () => {
    if (this.enteredFullscreen && !this.app.ownerDocument.fullscreenElement) {
      this.enteredFullscreen = false;
      this.stop();
    }
  };

  private requestFullscreen = () => {
    const container = this.app.excalidrawContainerValue.container;
    if (
      this.app.ownerDocument.fullscreenElement ||
      typeof container?.requestFullscreen !== "function"
    ) {
      return;
    }
    container
      .requestFullscreen()
      .then(() => {
        this.enteredFullscreen = true;
        // presentation may have ended while the request was pending
        if (!this.app.state.presentation) {
          this.exitFullscreen();
        }
      })
      .catch(() => {
        // fullscreen is a nicety: e.g. without a user gesture, or inside an
        // iframe without `allowfullscreen`, we present inside the container
      });
  };

  private exitFullscreen = () => {
    if (!this.enteredFullscreen) {
      return;
    }
    this.enteredFullscreen = false;
    if (this.app.ownerDocument.fullscreenElement) {
      this.app.ownerDocument.exitFullscreen().catch(() => {});
    }
  };
}

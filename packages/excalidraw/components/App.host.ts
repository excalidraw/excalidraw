import { isDevEnv, isTestEnv } from "@excalidraw/common";

import type { RenderEnvironment } from "@excalidraw/element";

import {
  hideHyperlinkToolip,
  type HyperlinkTooltipOwner,
} from "./hyperlink/Hyperlink";
import { startLinkImgDecoding } from "./hyperlink/helpers";

import type { AppProps } from "../types";
import type App from "./App";

/**
 * Owns everything that ties this editor to the document/window it renders
 * into (cross-document runtime ownership): the render environment the
 * canvases, images and paths are minted from, and the state that has to be
 * re-primed whenever that environment is swapped.
 */
export class AppHost {
  constructor(private app: App) {}

  /**
   * Identity token for the hyperlink tooltip, which is a module-level
   * singleton shared by every editor in the process — the owner tells it
   * which editor the currently shown tooltip belongs to, so one editor never
   * hides (or leaks a timer into) another's tooltip.
   */
  readonly hyperlinkTooltipOwner: HyperlinkTooltipOwner = {};

  /**
   * Render environment scoped to this editor's owner window, so that the
   * canvases, images and paths created during rendering live in the owner
   * document. Memoized keyed on the resolved document because render caches
   * are keyed by environment identity: the identity must not survive a
   * document switch, or caches would mix canvases and images from two realms
   * under one bucket.
   */
  private _renderEnvironment: RenderEnvironment | null = null;
  private _renderEnvironmentDocument: Document | null = null;
  public get renderEnvironment(): RenderEnvironment {
    if (this.app.props.renderEnvironment) {
      return this.app.props.renderEnvironment;
    }
    const ownerDocument = this.app.ownerDocument;
    if (
      !this._renderEnvironment ||
      this._renderEnvironmentDocument !== ownerDocument
    ) {
      this._renderEnvironmentDocument = ownerDocument;
      this._renderEnvironment = {
        createCanvas: () => this.app.ownerDocument.createElement("canvas"),
        createImage: () => new this.app.ownerWindow.Image(),
        // Browsers accept a `Path2D` minted in another realm, but taking it
        // from the owner window keeps runtime ownership complete. Falls back
        // to the global for realms without one (e.g. jsdom iframes).
        createPath: (svgPath: string) =>
          new (this.app.ownerWindow.Path2D ?? Path2D)(svgPath),
      };
    }
    return this._renderEnvironment;
  }

  /**
   * Re-primes whatever the render environment owns. Called on mount and on
   * every update, so an environment swap is picked up wherever it happens.
   */
  public sync(prevProps?: AppProps) {
    this.ensureLinkImgDecoding();
    if (prevProps) {
      this.warnOnUnstableRenderEnvironment(prevProps);
    }
  }

  /**
   * Releases the tooltip ownership so we don't retain the (soon detached)
   * document/window, or leave a pending tooltip timer around.
   */
  public destroy() {
    hideHyperlinkToolip(this.hyperlinkTooltipOwner);
  }

  /**
   * Link icons decode asynchronously and the static scene skips an icon that
   * is not decoded yet, so start the decode on mount rather than on the
   * first render that happens to have a link, so the decode is settled long
   * before there is a link element to draw an icon for.
   *
   * Re-run on an environment swap: the images are keyed by env identity, so
   * a new environment starts with none.
   */
  private _linkImgDecodingEnvironment: RenderEnvironment | null = null;
  private ensureLinkImgDecoding() {
    const renderEnvironment = this.renderEnvironment;
    if (this._linkImgDecodingEnvironment === renderEnvironment) {
      return;
    }
    this._linkImgDecodingEnvironment = renderEnvironment;
    startLinkImgDecoding(renderEnvironment);
  }

  /**
   * Every render cache is keyed by environment identity, so a host passing an
   * inline `renderEnvironment` literal re-mints the identity on each render
   * and re-rasterizes everything, with no visible symptom other than being
   * slow. Detected by the factories' source being unchanged across the swap:
   * a genuine environment switch (e.g. a document change) reads differently.
   */
  private _warnedUnstableRenderEnvironment = false;
  private warnOnUnstableRenderEnvironment(prevProps: AppProps) {
    if (
      (!isDevEnv() && !isTestEnv()) ||
      this._warnedUnstableRenderEnvironment
    ) {
      return;
    }
    const prev = prevProps.renderEnvironment;
    const next = this.app.props.renderEnvironment;
    if (
      !prev ||
      !next ||
      prev === next ||
      String(prev.createCanvas) !== String(next.createCanvas) ||
      String(prev.createImage) !== String(next.createImage)
    ) {
      return;
    }
    this._warnedUnstableRenderEnvironment = true;
    console.warn(
      "Excalidraw: the `renderEnvironment` prop changed identity while its " +
        "implementation stayed the same. Render caches are keyed by this " +
        "object's identity, so a new identity per render defeats all of them " +
        "(elements are re-rasterized every frame). Hoist the object to a " +
        "module constant or memoize it (e.g. `useMemo`).",
    );
  }
}

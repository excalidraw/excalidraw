import { isDevEnv, isTestEnv } from "@excalidraw/common";

import type { RenderEnvironment } from "@excalidraw/element";

import { editorJotaiStore } from "../editor-jotai";

import { activeEyeDropperAtom, type EyeDropperProperties } from "./EyeDropper";
import {
  hideHyperlinkToolip,
  type HyperlinkTooltipOwner,
} from "./hyperlink/Hyperlink";
import { startLinkImgDecoding } from "./hyperlink/helpers";

import type { AppProps } from "../types";
import type App from "./App";

/**
 * The pointerup handler of whichever editor is mid-interaction. Shared by
 * every editor in the process; `AppHost.ownedPointerUp` says whose it is.
 */
let activePointerUp: (() => void) | null = null;

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
   * The process-wide interaction slots this editor currently owns: the
   * pointerup handler of the interaction in flight, and the eye dropper (one
   * atom in the editor-wide store). Both hold closures over this editor, so a
   * teardown that leaves one set retains the editor -- and with it its owner
   * window and document, e.g. a closed popout.
   *
   * @see releaseOwnedInteractionState
   */
  private ownedPointerUp: (() => void) | null = null;
  private ownedEyeDropper: EyeDropperProperties | null = null;

  /** Takes over the pointerup slot (or clears it, on `null`). */
  public setPointerUp(handler: (() => void) | null) {
    activePointerUp = handler;
    this.ownedPointerUp = handler;
  }

  /**
   * Runs the pending pointerup, whoever owns it -- pointerup does not always
   * fire (the user tabs away), so interactions are settled manually.
   */
  public runPendingPointerUp() {
    activePointerUp?.();
  }

  /** Opens the eye dropper (or closes it, on `null`), taking ownership. */
  public setActiveEyeDropper(eyeDropper: EyeDropperProperties | null) {
    this.ownedEyeDropper = eyeDropper;
    this.app.updateEditorAtom(activeEyeDropperAtom, eyeDropper);
  }

  /**
   * Drops the ownership token without touching the atom -- for callers that
   * have just closed the eye dropper themselves.
   */
  public releaseEyeDropperOwnership() {
    this.ownedEyeDropper = null;
  }

  /**
   * Releases the process-wide slots this editor owns, so nothing outside it
   * keeps it alive once it is torn down. Ownership-checked: a sibling
   * editor's in-flight interaction must survive our teardown.
   */
  private releaseOwnedInteractionState() {
    // an unmount mid-drag never reaches the pointerup that would clear this
    if (this.ownedPointerUp && activePointerUp === this.ownedPointerUp) {
      activePointerUp = null;
    }
    this.ownedPointerUp = null;

    if (
      this.ownedEyeDropper &&
      editorJotaiStore.get(activeEyeDropperAtom) === this.ownedEyeDropper
    ) {
      editorJotaiStore.set(activeEyeDropperAtom, null);
    }
    this.ownedEyeDropper = null;
  }

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
   * Releases what this editor owns outside itself, so we don't retain the
   * (soon detached) document/window, or leave a pending tooltip timer around.
   */
  public destroy() {
    this._destroyed = true;
    hideHyperlinkToolip(this.hyperlinkTooltipOwner);
    this.releaseOwnedInteractionState();
  }
  private _destroyed = false;

  /**
   * Link icons decode asynchronously and the static scene skips an icon that
   * is not decoded yet, so start the decode on mount rather than on the
   * first render that happens to have a link, so the decode is settled long
   * before there is a link element to draw an icon for.
   *
   * Re-run on an environment swap: the images are keyed by env identity, so
   * a new environment starts with none.
   *
   * The decode landing only flips a status, which invalidates nothing, so the
   * scene is nudged once when an icon becomes drawable -- otherwise a scene
   * that paints before the decode settles and is then left alone (an initial
   * scene with links, never scrolled or edited) keeps its icons missing until
   * something unrelated repaints. Same shape as a font or an image file
   * landing: repaint only when there is something new to draw.
   */
  private _linkImgDecodingEnvironment: RenderEnvironment | null = null;
  private ensureLinkImgDecoding() {
    const renderEnvironment = this.renderEnvironment;
    if (this._linkImgDecodingEnvironment === renderEnvironment) {
      return;
    }
    this._linkImgDecodingEnvironment = renderEnvironment;
    startLinkImgDecoding(renderEnvironment).then((didDecode) => {
      if (
        !didDecode ||
        this._destroyed ||
        // the environment was swapped while we waited; that swap started its
        // own decode, and this one's images are no longer the ones drawn
        this._linkImgDecodingEnvironment !== renderEnvironment ||
        // nothing in the scene draws a link icon, so there is nothing to
        // repaint for; an element gaining a link repaints on its own
        !this.app.scene
          .getNonDeletedElements()
          .some((element) => !!element.link)
      ) {
        return;
      }
      this.app.scene.triggerUpdate();
    });
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

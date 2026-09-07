import throttle from "lodash.throttle";

import { isCustomFontFamily, isSafari } from "@excalidraw/common";

import {
  getContainerElement,
  isBoundToContainer,
  isTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import type { FontFamily } from "@excalidraw/common";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Fonts } from "../fonts";

import type { FontResolvers } from "../fonts";
import type { AppProps, AppState, FontProviders, SceneData } from "../types";
import type App from "./App";

type AppFontsDependencies = {
  /**
   * Called right before a font reflow mutates the scene, so the mutation can
   * be kept out of the next user action's undo delta.
   */
  onBeforeSceneMutation: () => void;
};

/**
 * Narrow the host-facing `FontProviders` down to what the font layer needs,
 * keeping it free of UI concerns. Bound, as a provider may legitimately be a
 * class instance resolving against its own `this`.
 */
const toFontResolvers = (
  fontProviders: FontProviders | undefined,
): FontResolvers | undefined =>
  fontProviders &&
  Object.fromEntries(
    Object.entries(fontProviders).map(([id, provider]) => [
      id,
      provider.resolve.bind(provider),
    ]),
  );

/**
 * Owns the App-bound font workflows: the lifecycle of the editor's `Fonts`
 * instance (including swapping it when `fontProviders` changes), loading the
 * faces a scene needs as elements arrive, and the geometry repairs those loads
 * trigger.
 *
 * The font machinery itself — resolution, registration, caching, the repair
 * queue — lives in `../fonts` and knows nothing about `App`.
 */
export class AppFonts {
  /**
   * The editor's `Fonts` registry, read by actions and the picker as
   * `app.fonts.instance`. Swapped wholesale when `fontProviders` changes, so
   * work spanning an `await` must capture it up front rather than re-read it
   * afterwards - otherwise it would settle against a different instance.
   */
  public instance: Fonts;

  /**
   * Families the scene walk alone would miss - i.e. an incoming default font
   * no element uses yet - to pass along with the next throttled font load.
   */
  private pendingSceneFontFamilies = new Set<FontFamily>();

  constructor(private app: App, private dependencies: AppFontsDependencies) {
    this.instance = this.createFonts();
  }

  private createFonts = () =>
    new Fonts(
      this.app.scene,
      toFontResolvers(this.app.props.fontProviders),
      undefined,
      {
        onBeforeSceneMutation: this.dependencies.onBeforeSceneMutation,
        // a reflow must wait out any in-flight gesture: `NEVER` wins the commit
        // over the gesture's `EVENTUALLY`, corrupting its undo entry (flushed
        // by `onStateUpdated` once the gesture ends)
        shouldDeferSceneMutation: () => this.isGestureInFlight(this.app.state),
        ownerDocument: this.app.ownerDocument,
      },
    );

  private isGestureInFlight = (state: AppState) =>
    state.selectedElementsAreBeingDragged ||
    state.isResizing ||
    state.isRotating ||
    state.cursorButton === "down";

  private loadSceneFontFamilies = (additionalFamilies: FontFamily[]) => {
    // captured, as a `fontProviders` swap replaces the instance mid-flight
    const fonts = this.instance;

    fonts
      .loadSceneFonts(additionalFamilies)
      .then((fontFaces) => fonts.onLoaded(fontFaces));
  };

  /**
   * Load the faces the scene needs, plus `additionalFamily` - the current
   * default font may not be used by any element yet, so the element walk alone
   * wouldn't get it registered.
   *
   * Unlike `Fonts.loadSceneFonts`, this applies `onLoaded` itself - the caller
   * has nothing left to await.
   */
  public refreshSceneFonts = (additionalFamily?: FontFamily) =>
    this.loadSceneFontFamilies(
      additionalFamily === undefined ? [] : [additionalFamily],
    );

  /**
   * rerender text elements on font load to fix #637 && #1553
   */
  public onDocumentFontsLoaded = (event: Event) => {
    this.instance.onLoaded((event as FontFaceSetLoadEvent).fontfaces);
  };

  /**
   * A `fontProviders` change may make previously-unresolvable families
   * resolvable, so the whole instance is rebuilt around the new resolvers.
   */
  public onPropsUpdated = (prevProps: AppProps) => {
    if (prevProps.fontProviders === this.app.props.fontProviders) {
      return;
    }

    // per the `FontProviders` contract a key always denotes the same font
    // source, so only the key set matters - which also keeps an inline
    // `fontProviders` object from churning the instance every render
    const prevProviders = prevProps.fontProviders ?? {};
    const nextProviders = this.app.props.fontProviders ?? {};
    const addedKeys = Object.keys(nextProviders).filter(
      (key) => !Object.hasOwn(prevProviders, key),
    );
    const removedKeys = Object.keys(prevProviders).filter(
      (key) => !Object.hasOwn(nextProviders, key),
    );

    if (!addedKeys.length && !removedKeys.length) {
      return;
    }

    // resolvers are captured by the instance, so swap the whole instance -
    // the page-global registry & failure set are unaffected
    this.instance = this.createFonts();

    // an instance-field mutation - force a render so readers of
    // `app.fonts.instance` (i.e. the picker) observe it
    this.app.setState({});

    if (addedKeys.length) {
      // new providers may make previously-unsupported families resolvable;
      // removals add nothing resolvable, so they need no pass
      this.refreshSceneFonts(this.app.state.currentItemFontFamily);
    }
  };

  /**
   * Deferred font repairs run once the gesture fully ends - and only after the
   * whole pointer-up chain, which schedules the gesture's capture *later* than
   * the flags observed in `componentDidUpdate` flip. A repair's `NEVER` commit
   * running first would eat the uncaptured gesture delta into the snapshot.
   */
  public onStateUpdated = (prevState: AppState) => {
    if (
      !this.isGestureInFlight(prevState) ||
      this.isGestureInFlight(this.app.state) ||
      // no timer per gesture end when nothing is pending - the common
      // (no custom fonts) case must stay free
      !this.instance.hasPendingSceneRepairs()
    ) {
      return;
    }

    setTimeout(() => {
      if (!this.app.unmounted) {
        // no-ops if a new gesture started meanwhile - its end reschedules
        this.instance.flushDeferredSceneRepairs();
      }
    });
  };

  /**
   * Throttled, as `updateScene` runs on every remote collab increment and a
   * scene using custom fonts would otherwise pay the character walk +
   * `document.fonts.check` per family on each call. Leading edge keeps the
   * first update immediate, trailing edge keeps the last one correct.
   */
  private loadUpdatedSceneFontsThrottled = throttle(() => {
    const additionalFamilies = Array.from(this.pendingSceneFontFamilies);
    this.pendingSceneFontFamilies.clear();

    this.loadSceneFontFamilies(additionalFamilies);
  }, 1000);

  public onSceneUpdated = (
    elements: SceneData["elements"],
    appState: Pick<AppState, "currentItemFontFamily"> | null | undefined,
  ) => {
    // keeps `updateScene` (i.e. every collab increment) free of font work
    // when no custom fonts can exist, matching master
    if (!this.instance.mayHaveCustomFonts()) {
      return;
    }

    // the incoming default font may not be used by any element yet
    const currentItemFontFamily = appState?.currentItemFontFamily;
    const additionalFamily =
      currentItemFontFamily !== undefined &&
      this.instance.shouldLoadCustomFamily(currentItemFontFamily)
        ? currentItemFontFamily
        : undefined;

    const shouldLoadFonts =
      additionalFamily !== undefined ||
      // unlike built-ins, custom families aren't lazily loadable by the
      // browser until resolved
      !!elements?.some(
        (element) =>
          isTextElement(element) &&
          this.instance.shouldLoadCustomFamily(element.fontFamily),
      );

    if (shouldLoadFonts) {
      if (additionalFamily !== undefined) {
        // accumulated, so the next (possibly leading-edge) pass picks it up
        this.pendingSceneFontFamilies.add(additionalFamily);
      }
      this.loadUpdatedSceneFontsThrottled();
    }
  };

  /**
   * Redraw the bound text of freshly inserted (pasted / library) elements,
   * loading their fonts first where that is needed.
   *
   * Bound text in an unresolved custom family can't be measured yet - it would
   * bake in the fallback font's metrics - so its redraw is deferred until the
   * load below settles.
   */
  public onElementsInserted = (
    insertedElements: readonly ExcalidrawElement[],
  ) => {
    const deferredBoundTextElements = new Map<
      ExcalidrawElement["id"],
      FontFamily
    >();
    let hasCustomFontText = false;

    for (const element of insertedElements) {
      if (!isTextElement(element)) {
        continue;
      }

      const isDeferred = isCustomFontFamily(element.fontFamily);
      hasCustomFontText ||= isDeferred;

      if (!isBoundToContainer(element)) {
        continue;
      }

      if (isDeferred) {
        deferredBoundTextElements.set(element.id, element.fontFamily);
      } else {
        const container = getContainerElement(
          element,
          this.app.scene.getElementsMapIncludingDeleted(),
        );
        redrawTextBoundingBox(element, container, this.app.scene);
      }
    }

    // paste event may not fire FontFace loadingdone event in Safari, hence loading font faces manually
    // we also need to resolve & load custom fonts for pasted text elements,
    // otherwise they would render with the fallback font indefinitely
    if (!isSafari && !hasCustomFontText) {
      return;
    }

    const fonts = this.instance;
    Fonts.loadElementsFonts(insertedElements, fonts).then((fontFaces) => {
      // a `fontProviders` swap replaces `this.instance` but keeps the scene, so
      // the deferred redraws stay valid - only unmount bails
      if (this.app.unmounted) {
        return;
      }

      fonts.onLoaded(fontFaces);

      if (deferredBoundTextElements.size) {
        fonts.runSceneRepair(() => {
          const elementsMap = this.app.scene.getNonDeletedElementsMap();
          for (const [elementId, fontFamily] of deferredBoundTextElements) {
            const latestElement = elementsMap.get(elementId);
            // redraw whether or not the font resolved - the pasted
            // dimensions came from the source scene, so leaving them be on
            // a failure keeps the text overflowing indefinitely
            if (
              !latestElement ||
              !isTextElement(latestElement) ||
              !isBoundToContainer(latestElement) ||
              latestElement.fontFamily !== fontFamily
            ) {
              continue;
            }

            const container = getContainerElement(latestElement, elementsMap);
            if (container) {
              redrawTextBoundingBox(latestElement, container, this.app.scene);
            }
          }
        });
      }
    });
  };

  /**
   * `onDuplicate` may have swapped a duplicate to a custom family the page
   * hasn't loaded yet (mirrors the paste path). TRADE-OFF: load-only - a swap
   * to an already-loaded family keeps the original geometry, which the host
   * owns (`onDuplicate` JSDoc).
   */
  public onElementsDuplicated = (
    insertedElements: readonly ExcalidrawElement[],
  ) => {
    if (
      !insertedElements.some(
        (element) =>
          isTextElement(element) && isCustomFontFamily(element.fontFamily),
      )
    ) {
      return;
    }

    const fonts = this.instance;
    Fonts.loadElementsFonts(insertedElements, fonts).then((fontFaces) =>
      fonts.onLoaded(fontFaces),
    );
  };

  public destroy = () => {
    this.loadUpdatedSceneFontsThrottled.cancel();
    // deliberately built without the options bag: this instance only exists so
    // lingering references don't crash, and a repair running past unmount must
    // not reach back into the store
    this.instance = new Fonts(
      this.app.scene,
      toFontResolvers(this.app.props.fontProviders),
      undefined,
      { ownerDocument: this.app.ownerDocument },
    );
  };
}

import { Emitter } from "@excalidraw/common";

import type { CustomFontFamily } from "@excalidraw/common";

import type { FontDefinition, FontResolver } from "./Fonts";
import type { FontRegistry } from "./FontRegistry";

/**
 * `initial` - never handed to a resolver; `loading` - resolution in flight;
 * `failed` - the resolver rejected (and the attempt was user-visible);
 * `registered` - definition available, in {@link Fonts.registered}.
 */
export type FontResolutionStatus =
  | "initial"
  | "loading"
  | "failed"
  | "registered";

/**
 * A {@link FontRegistry}'s custom font resolution state, in two separate
 * layers:
 *
 * - the *dedup* layer (`pending`) tracks in-flight resolutions, so concurrent
 *   callers hand a family to its resolver once. Shared unconditionally.
 * - the *verdict* layer (`failures`) records rejections, but only from
 *   attempts whose outcome the user sees (see `recordFailure`).
 *
 * Keeping them apart is what makes `recordFailure` expressible: a
 * non-recording attempt still dedupes while `failures` stays untouched.
 * Failures are advisory - they exclude a family from automatic loading and
 * paint its picker row, never block a deliberate re-attempt - and clear as
 * soon as the family resolves anywhere.
 *
 * Scoped to its registry, and so shared by every editor on it: a resolution is
 * a fact about the family, not about the editor that asked.
 */
export class FontsCache {
  constructor(private readonly registry: FontRegistry) {}

  /** dedup layer: in-flight resolutions, keyed by qualified family */
  private readonly pending = new Map<string, Promise<FontDefinition>>();

  /** verdict layer: families whose resolver rejected, with the rejection */
  private failures: ReadonlyMap<string, unknown> = new Map();

  public readonly onFailuresChangeEmitter = new Emitter<
    [ReadonlyMap<string, unknown>]
  >();

  public get failedResolutions(): ReadonlyMap<string, unknown> {
    return this.failures;
  }

  public getStatus(family: CustomFontFamily): FontResolutionStatus {
    if (this.registry.registered.has(family)) {
      return "registered";
    }
    if (this.pending.has(family)) {
      return "loading";
    }
    if (this.failures.has(family)) {
      return "failed";
    }
    return "initial";
  }

  /**
   * How long a resolver may stay pending before the attempt is abandoned - a
   * hanging one would otherwise poison `pending` forever, every retry joining
   * the dead promise. The entry clears on timeout, so the next attempt runs
   * afresh. Measured from invocation, not from time spent queued.
   */
  private static readonly RESOLUTION_TIMEOUT = 30_000;

  /**
   * At most this many resolvers run at once, registry-wide - scrolling a large
   * catalog dispatches many *distinct* families (`useVisibleFontRegistration`)
   * and resolvers are arbitrary network code.
   *
   * Best-effort: a timed-out resolver keeps running (promises can't be
   * cancelled) while its slot is released, so a wave of timeouts can
   * transiently exceed the cap - better than letting it starve the queue.
   */
  private static readonly RESOLVER_CONCURRENCY = 6;
  private activeResolvers = 0;
  private readonly resolverQueue: Array<() => void> = [];

  private acquireResolverSlot(): Promise<void> {
    if (this.activeResolvers < FontsCache.RESOLVER_CONCURRENCY) {
      this.activeResolvers++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.resolverQueue.push(resolve));
  }

  private releaseResolverSlot() {
    const next = this.resolverQueue.shift();
    if (next) {
      // hand the slot over directly - `activeResolvers` stays constant
      next();
    } else {
      this.activeResolvers--;
    }
  }

  /** join an in-flight resolution, or start one */
  public resolve(
    family: string,
    familyName: string,
    resolver: FontResolver,
  ): Promise<FontDefinition> {
    const pendingResolution = this.pending.get(family);
    if (pendingResolution) {
      return pendingResolution;
    }

    let timeoutId!: ReturnType<typeof setTimeout>;
    const resolution = this.acquireResolverSlot()
      .then(() =>
        Promise.race([
          Promise.resolve().then(() => resolver(familyName)),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () =>
                reject(
                  new Error(`Timed out resolving custom font "${family}"`),
                ),
              FontsCache.RESOLUTION_TIMEOUT,
            );
          }),
        ]),
      )
      .finally(() => {
        clearTimeout(timeoutId);
        this.releaseResolverSlot();
        if (this.pending.get(family) === resolution) {
          this.pending.delete(family);
        }
      });
    this.pending.set(family, resolution);
    return resolution;
  }

  /**
   * Record a rejection. Only call from settle paths of user-visible attempts -
   * see `RegistrationOptions.recordFailure`.
   */
  public setFailed(family: string, error: unknown) {
    if (this.failures.has(family)) {
      return;
    }

    const failures = new Map(this.failures);
    failures.set(family, error);
    this.failures = failures;
    this.onFailuresChangeEmitter.trigger(this.failures);
  }

  /** Only call from success paths - a resolved family has nothing to fail. */
  public clearFailed(family: string) {
    if (!this.failures.has(family)) {
      return;
    }

    const failures = new Map(this.failures);
    failures.delete(family);
    this.failures = failures;
    this.onFailuresChangeEmitter.trigger(this.failures);
  }
}

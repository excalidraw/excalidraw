/**
 * Font resolvers registered for image exports.
 *
 * WARN: no runtime imports of editor code here - a host registers its
 * resolvers at startup, and that must not load the editor along.
 */
import { validateFontProviderKey } from "./providerKey";

import type { FontResolvers } from "./Fonts";

/**
 * Kept on the global object rather than in this module, so that every copy of
 * the package in the realm (a page, a worker, a server process) reads the
 * same registrations: the editor, `@excalidraw/utils`, a second bundle of
 * either. Whichever copy an export runs in, and whenever that copy got
 * loaded, it finds what the host registered.
 */
const REGISTRY_KEY = Symbol.for("excalidraw.fontResolvers");

const getRegisteredFontResolvers = (): FontResolvers =>
  ((globalThis as { [REGISTRY_KEY]?: FontResolvers })[REGISTRY_KEY] ??= {});

/**
 * Register font resolvers for every image export, so that no export call has
 * to remember `config.fontResolvers` - without a resolver, text in a custom
 * font is exported in a fallback font.
 *
 * Call it once in each realm which exports - a page, a worker, a server
 * process - as early as its code starts. It doesn't need the editor loaded
 * (import it from `@excalidraw/excalidraw/fonts/google` to keep it that
 * way), and an export only looks the resolvers up when it runs, so nothing
 * depends on what else got loaded first.
 *
 * - A resolver passed to an export in `config.fontResolvers` wins over a
 *   registered one for the same provider.
 * - The editor's own exports already use its `fontProviders`. Those aren't
 *   registered here on mount: an export elsewhere on the page would then
 *   work or not depending on whether an editor happened to mount first.
 *
 * @returns a function taking back what this call registered
 */
export const registerFontResolvers = (
  resolvers: FontResolvers,
): (() => void) => {
  for (const provider of Object.keys(resolvers)) {
    validateFontProviderKey(provider);
  }
  const registered = getRegisteredFontResolvers();
  Object.assign(registered, resolvers);

  return () => {
    for (const [provider, resolver] of Object.entries(resolvers)) {
      // unless registered over since
      if (registered[provider] === resolver) {
        delete registered[provider];
      }
    }
  };
};

/** the resolvers an export goes by: the registered ones, overridden per call */
export const getExportFontResolvers = (
  resolvers?: FontResolvers,
): FontResolvers => ({ ...getRegisteredFontResolvers(), ...resolvers });

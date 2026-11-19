/**
 * The rule for font provider keys.
 *
 * WARN: no imports here - this is also loaded on its own, without the editor
 * (see `./resolvers`).
 */

/**
 * The provider key of Google Fonts, i.e. "google:Roboto" - the one key we
 * define ourselves. It names the catalog rather than whoever serves the
 * files: the family of that exact name, in its regular face.
 */
export const GOOGLE_FONT_PROVIDER_KEY = "google";

/** provider keys without a dot are reserved for us - hosts can't register others */
const RESERVED_FONT_PROVIDER_KEYS: ReadonlySet<string> = new Set([
  GOOGLE_FONT_PROVIDER_KEY,
]);

/** reverse DNS, i.e. "com.acme.fonts" - lowercase, at least one dot */
const HOST_FONT_PROVIDER_KEY_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * Whether the key can be registered as a font provider. A key is persisted
 * into every `fontFamily` it resolves (i.e. "com.acme.fonts:Brand Sans") and
 * travels with the document, so it can never change and has to mean the same
 * thing everywhere:
 *
 * - {@link GOOGLE_FONT_PROVIDER_KEY}, or
 * - a reverse-DNS key under a domain the host owns, i.e. "com.acme.fonts".
 *   Requiring the dot is what keeps the rest of the dotless namespace free
 *   for us to define later.
 *
 * Lowercase only: provider keys are compared verbatim, and "Google" next to
 * "google" would be two providers for what reads as one.
 */
export const isValidFontProviderKey = (providerKey: string): boolean =>
  RESERVED_FONT_PROVIDER_KEYS.has(providerKey) ||
  HOST_FONT_PROVIDER_KEY_REGEX.test(providerKey);

/** throws for a key which can't be registered - see `isValidFontProviderKey` */
export const validateFontProviderKey = (providerKey: string) => {
  if (!isValidFontProviderKey(providerKey)) {
    throw new Error(
      `Invalid font provider key "${providerKey}": expected "${GOOGLE_FONT_PROVIDER_KEY}", or a lowercase reverse-DNS key containing a dot, i.e. "com.example.fonts"`,
    );
  }
};

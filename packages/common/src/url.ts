import { sanitizeUrl } from "@braintree/sanitize-url";

import { escapeDoubleQuotes } from "./utils";

export const normalizeLink = (link: string) => {
  link = link.trim();
  if (!link) {
    return link;
  }
  return sanitizeUrl(escapeDoubleQuotes(link));
};

export const isLocalLink = (link: string | null) => {
  if (!link) {
    return false;
  }

  // Protocol-relative URLs (e.g. `//example.com`) point to another origin, so
  // they must not be treated as local even though they start with a slash.
  if (link.startsWith("//")) {
    return false;
  }

  // Root-relative links always stay on the current origin.
  if (link.startsWith("/")) {
    return true;
  }

  // For absolute links, compare the actual origin. A plain `includes` check
  // would wrongly match external links that merely contain the origin
  // somewhere (e.g. `https://evil.com/?next=<origin>`) or look-alike hosts
  // (e.g. `<origin>.evil.com`).
  try {
    return new URL(link).origin === location.origin;
  } catch {
    return false;
  }
};

/**
 * Returns URL sanitized and safe for usage in places such as
 * iframe's src attribute or <a> href attributes.
 */
export const toValidURL = (link: string) => {
  link = normalizeLink(link);

  // make relative links into fully-qualified urls
  if (link.startsWith("/")) {
    return `${location.origin}${link}`;
  }

  try {
    new URL(link);
  } catch {
    // if link does not parse as URL, assume invalid and return blank page
    return "about:blank";
  }

  return link;
};

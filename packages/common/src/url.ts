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
  try {
    // compare origins so `//other.host` or links that merely contain our
    // origin (e.g. in a query string) aren't treated as local
    return new URL(link, location.origin).origin === location.origin;
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

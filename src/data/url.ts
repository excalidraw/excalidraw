import { sanitizeUrl } from "@braintree/sanitize-url";

export const normalizeLink = (link: string) => {
  link = link.trim();
  if (!link) {
    return link;
  }
  return sanitizeUrl(link);
};

export const isLocalLink = (link: string | null) => {
  if (!link) {
    return false;
  }
  try {
    const current = new URL(location.href);
    const target = new URL(link, location.origin);
    return current.origin === target.origin;
  } catch {
    return false; // parse error, assume external link
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

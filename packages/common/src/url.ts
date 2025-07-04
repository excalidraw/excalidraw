import { sanitizeUrl } from "@braintree/sanitize-url";

import { escapeDoubleQuotes } from "./utils";

export const normalizeLink = (link: string) => {
  link = link.trim();
  if (!link) {
    return link;
  }
  return sanitizeUrl(escapeDoubleQuotes(link));
};

import { sanitizeUrl } from "@braintree/sanitize-url";

export const normalizeLink = (link: string) => {
  link = link.trim();
  if (!link) {
    return link;
  }
  return sanitizeUrl(link);
};

export const isLocalLink = (link: string | null) => {
  return !!(link?.includes(location.origin) || link?.startsWith("/"));
};

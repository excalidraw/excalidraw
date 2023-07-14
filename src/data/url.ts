import { sanitizeUrl } from "@braintree/sanitize-url";

export const normalizeLink = (link: string) => {
  return sanitizeUrl(link);
};

export const isLocalLink = (link: string | null) => {
  return !!(link?.includes(location.origin) || link?.startsWith("/"));
};

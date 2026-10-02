/**
 * Share-link tokens are capabilities: anyone holding one can open the scene. They travel in
 * URL paths, so request logs must never contain them.
 */
export const scrubUrl = (url: string) =>
  url
    .replace(/(\/share\/)[A-Za-z0-9_-]{20,}/g, "$1[token]")
    .replace(/([?&](?:token|key|secret|access_token)=)[^&]*/gi, "$1[redacted]");

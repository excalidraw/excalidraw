/**
 * Loads an external script into the given document, once. Callers should
 * cache the returned promise to dedupe concurrent loads.
 */
export const loadScript = (
  ownerDocument: Document,
  src: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = ownerDocument.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = ownerDocument.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    ownerDocument.head.appendChild(script);
  });
};

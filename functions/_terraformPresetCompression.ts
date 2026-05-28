export const GZIP_PREFIX = "gz:b64:";

export async function decompressPresetText(
  value: string | null,
): Promise<string | null> {
  if (value === null || value === undefined) {
    return null;
  }
  if (!value.startsWith(GZIP_PREFIX)) {
    return value;
  }
  const payload = value.slice(GZIP_PREFIX.length);
  const binary = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  const stream = new Blob([binary])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

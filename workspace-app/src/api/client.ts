export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public body?: any,
  ) {
    super(message || code);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

const CSRF = { "x-requested-with": "excalidraw-workspace" };

export const api = async <T = any>(
  method: string,
  path: string,
  body?: unknown,
  opts: { signal?: AbortSignal } = {},
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...CSRF,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw e;
    }
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error ?? "error",
      json?.message ?? json?.error,
      json,
    );
  }
  return json as T;
};

export const get = <T = any>(p: string, signal?: AbortSignal) =>
  api<T>("GET", p, undefined, { signal });
export const post = <T = any>(p: string, b?: unknown) =>
  api<T>("POST", p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) =>
  api<T>("PUT", p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) =>
  api<T>("PATCH", p, b ?? {});
export const del = <T = any>(p: string) => api<T>("DELETE", p);

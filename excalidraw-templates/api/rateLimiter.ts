export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying. Only set when !allowed. */
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

/**
 * Fixed-window in-memory limiter. Fine for a single-process prototype;
 * swap the implementation behind RateLimiter (e.g. Redis/Upstash-backed)
 * before running more than one server instance.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count < this.limit) {
      entry.count += 1;
      return { allowed: true };
    }

    const retryAfterSeconds = Math.ceil(
      (entry.windowStart + this.windowMs - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }
}

export const generateRateLimiter: RateLimiter = new InMemoryRateLimiter(
  10,
  60_000,
);

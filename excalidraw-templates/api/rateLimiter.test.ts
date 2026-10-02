import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter } from "./rateLimiter";

describe("InMemoryRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    expect(limiter.check("a")).toEqual({ allowed: true });
    expect(limiter.check("a")).toEqual({ allowed: true });
    expect(limiter.check("a")).toEqual({ allowed: true });
  });

  it("blocks the request past the limit within the same window", () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    limiter.check("a");
    limiter.check("a");
    const result = limiter.check("a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports a retryAfterSeconds that matches the remaining window", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    limiter.check("a");
    vi.setSystemTime(25_000);
    const result = limiter.check("a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(35);
  });

  it("resets the count once the window has fully elapsed", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    vi.setSystemTime(60_001);
    expect(limiter.check("a")).toEqual({ allowed: true });
  });

  it("tracks separate keys independently", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    expect(limiter.check("a")).toEqual({ allowed: true });
    expect(limiter.check("b")).toEqual({ allowed: true });
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(false);
  });

  it("does not allow a request exactly at the limit boundary to sneak through", () => {
    const limiter = new InMemoryRateLimiter(10, 60_000);
    for (let i = 0; i < 10; i++) {
      expect(limiter.check("a").allowed).toBe(true);
    }
    expect(limiter.check("a").allowed).toBe(false);
  });
});

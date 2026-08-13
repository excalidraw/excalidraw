import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("GET /health", () => {
  it("returns ok without requiring database or GCS connectivity", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

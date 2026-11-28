import { vi } from "vitest";

import {
  exportToBackend,
  importFromBackend,
  isEncryptionAvailable,
} from "../data";

const MESSAGE = /only allows over HTTPS/;

describe("without WebCrypto (page not served over HTTPS)", () => {
  const fetchSpy = vi.fn();
  const alertSpy = vi.fn();

  beforeAll(() => {
    // what browsers expose in insecure contexts: `crypto` without `subtle`
    vi.stubGlobal("crypto", { getRandomValues: () => {} });
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("alert", alertSpy);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("should detect that encryption is unavailable", () => {
    expect(isEncryptionAvailable()).toBe(false);
  });

  it("should explain why a shareable link can't be created", async () => {
    const result = await exportToBackend([], {}, {});

    expect(result.url).toBeNull();
    expect(result.errorMessage).toMatch(MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should explain why a shareable link can't be opened", async () => {
    expect(await importFromBackend("id", "key")).toEqual({});

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(MESSAGE));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

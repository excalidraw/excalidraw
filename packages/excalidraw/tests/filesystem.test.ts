import * as browserFsAccess from "browser-fs-access";
import { vi } from "vitest";

import { fileSave } from "../data/filesystem";

// Mock browser-fs-access
vi.mock("browser-fs-access", () => ({
  fileSave: vi.fn(),
  fileOpen: vi.fn(),
  supported: true,
}));

describe("fileSave fallback", () => {
  let createObjectURLSpy: any;
  let createElementSpy: any;
  let consoleWarnSpy: any;
  let mockAnchor: HTMLAnchorElement;

  beforeEach(() => {
    vi.resetAllMocks();

    mockAnchor = {
      click: vi.fn(),
      download: "",
      href: "",
    } as unknown as HTMLAnchorElement;

    createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        if (tag === "a") {
          return mockAnchor;
        }
        return document.createElement(tag);
      });

    createObjectURLSpy = vi
      .spyOn(window.URL, "createObjectURL")
      .mockReturnValue("blob:test");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the file handle successfully when native fileSave works", async () => {
    const mockFileHandle = {
      kind: "file",
      name: "test.png",
    } as FileSystemFileHandle;
    vi.mocked(browserFsAccess.fileSave).mockResolvedValue(mockFileHandle);

    const blob = new Blob(["test"], { type: "image/png" });
    const result = await fileSave(blob, {
      name: "test",
      extension: "png",
      description: "Test PNG",
    });

    expect(result).toBe(mockFileHandle);
    expect(browserFsAccess.fileSave).toHaveBeenCalled();
    expect(mockAnchor.click).not.toHaveBeenCalled();
  });

  it("should propagate AbortError without fallback when user cancels", async () => {
    const abortError = new Error("The user aborted a request.");
    abortError.name = "AbortError";
    vi.mocked(browserFsAccess.fileSave).mockRejectedValue(abortError);

    const blob = new Blob(["test"], { type: "image/png" });
    await expect(
      fileSave(blob, {
        name: "test",
        extension: "png",
        description: "Test PNG",
      }),
    ).rejects.toThrow("The user aborted a request.");

    expect(browserFsAccess.fileSave).toHaveBeenCalled();
    expect(mockAnchor.click).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("should trigger fallback download when native fileSave throws SecurityError or NotAllowedError", async () => {
    const securityError = new Error(
      "Failed to execute 'showSaveFilePicker' on 'Window': The request is not allowed by the user agent or the platform in the current context.",
    );
    securityError.name = "NotAllowedError";
    vi.mocked(browserFsAccess.fileSave).mockRejectedValue(securityError);

    const blob = new Blob(["test"], { type: "image/png" });
    const result = await fileSave(blob, {
      name: "test",
      extension: "png",
      description: "Test PNG",
    });

    expect(result).toBeNull();
    expect(browserFsAccess.fileSave).toHaveBeenCalled();

    // Fallback checks
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(mockAnchor.download).toBe("test.png");
    expect(mockAnchor.href).toBe("blob:test");
    expect(mockAnchor.click).toHaveBeenCalled();

    // Warning logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("falling back to regular download"),
    );
  });
});

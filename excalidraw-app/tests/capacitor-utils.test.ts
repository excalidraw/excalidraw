import { describe, it, expect, vi } from "vitest";
import { parseLibraryDeepLink } from "../capacitor-utils";

// Mock Capacitor plugins to avoid errors during test execution
vi.mock("@capacitor/core", () => ({
    Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
    },
}));

vi.mock("@capacitor/browser", () => ({
    Browser: {
        open: vi.fn(),
        close: vi.fn(),
    },
}));

vi.mock("@capacitor/app", () => ({
    App: {
        addListener: vi.fn(),
    },
}));

describe("parseLibraryDeepLink", () => {
    it("should parse library URL from query string", () => {
        const url = "excalidraw://library/?addLibrary=https%3A%2F%2Fexample.com&token=123";
        const result = parseLibraryDeepLink(url);
        expect(result).toEqual({
            libraryUrl: "https://example.com",
            token: "123",
        });
    });

    it("should parse library URL from hash", () => {
        const url = "excalidraw://library/#addLibrary=https%3A%2F%2Fexample.com&token=456";
        const result = parseLibraryDeepLink(url);
        expect(result).toEqual({
            libraryUrl: "https://example.com",
            token: "456",
        });
    });

    it("should parse library URL when mixed in query and hash", () => {
        const url = "excalidraw://library/?token=789#addLibrary=https%3A%2F%2Fexample.com";
        const result = parseLibraryDeepLink(url);
        expect(result).toEqual({
            libraryUrl: "https://example.com",
            token: "789",
        });
    });

    it("should return null for invalid protocol", () => {
        const url = "https://library?addLibrary=https%3A%2F%2Fexample.com";
        const result = parseLibraryDeepLink(url);
        expect(result).toBeNull();
    });

    it("should return null for invalid host", () => {
        const url = "excalidraw://other?addLibrary=https%3A%2F%2Fexample.com";
        const result = parseLibraryDeepLink(url);
        expect(result).toBeNull();
    });

    it("should return null when addLibrary is missing", () => {
        const url = "excalidraw://library?token=123";
        const result = parseLibraryDeepLink(url);
        expect(result).toBeNull();
    });
});

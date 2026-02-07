import { act, queryByTestId, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { fireEvent, render } from "./test-utils";

import type { LibraryItems } from "../types";

const { h } = window;

describe("library collections", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    await act(() => {
      return h.app.library.resetLibrary();
    });
    // Clear collections
    await act(async () => {
      const collections = await h.app.library.getCollections();
      for (const collection of collections) {
        await h.app.library.deleteLibraryCollection(collection.id);
      }
    });
    localStorage.clear();
  });

  afterEach(async () => {
    await act(() => {
      return h.app.library.resetLibrary();
    });
    localStorage.clear();
  });

  describe("creating collections", () => {
    it("should create a new collection", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Test Collection",
      );

      expect(collection).toMatchObject({
        id: expect.any(String),
        name: "Test Collection",
        created: expect.any(Number),
        color: expect.any(String),
      });
      expect(collection.items).toEqual([]);

      const collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].id).toBe(collection.id);
      expect(collections[0].name).toBe("Test Collection");
    });

    it("should create multiple collections", async () => {
      await h.app.library.createLibraryCollection("Collection 1");
      await h.app.library.createLibraryCollection("Collection 2");

      const collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(2);
      expect(collections.map((c) => c.name)).toEqual(
        expect.arrayContaining(["Collection 1", "Collection 2"]),
      );
    });
  });

  describe("deleting collections", () => {
    it("should delete a collection", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "To Delete",
      );

      let collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(1);

      await h.app.library.deleteLibraryCollection(collection.id);

      collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(0);
    });

    it("should delete collection and its items", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Collection with Items",
      );

      // Create library items with collectionId
      const rectangle = API.createElement({
        id: "rect1",
        type: "rectangle",
      });
      const circle = API.createElement({
        id: "circle1",
        type: "ellipse",
      });

      const libraryItems: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [rectangle],
          created: Date.now(),
          collectionId: collection.id,
        },
        {
          id: "item2",
          status: "unpublished",
          elements: [circle],
          created: Date.now(),
          collectionId: collection.id,
        },
        {
          id: "item3",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          // No collectionId - should remain
        },
      ];

      await h.app.library.setLibrary(libraryItems);

      let allItems = await h.app.library.getLatestLibrary();
      expect(allItems).toHaveLength(3);

      // Delete the collection
      await h.app.library.deleteLibraryCollection(collection.id);

      // Collection should be deleted
      const collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(0);

      // Items with collectionId should be deleted
      allItems = await h.app.library.getLatestLibrary();
      expect(allItems).toHaveLength(1);
      expect(allItems[0].id).toBe("item3");
      expect(allItems[0].collectionId).toBeUndefined();
    });

    it("should handle deleting non-existent collection gracefully", async () => {
      // Should not throw
      await expect(
        h.app.library.deleteLibraryCollection("non-existent-id"),
      ).resolves.not.toThrow();
    });
  });

  describe("adding items to collections", () => {
    it("should add item to collection with collectionId", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "My Collection",
      );

      const rectangle = API.createElement({
        type: "rectangle",
      });

      const libraryItems: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [rectangle],
          created: Date.now(),
          collectionId: collection.id,
        },
      ];

      await h.app.library.setLibrary(libraryItems);

      const items = await h.app.library.getLatestLibrary();
      expect(items).toHaveLength(1);
      expect(items[0].collectionId).toBe(collection.id);
    });

    it("should add multiple items to same collection", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Shared Collection",
      );

      const items: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          collectionId: collection.id,
        },
        {
          id: "item2",
          status: "unpublished",
          elements: [API.createElement({ type: "ellipse" })],
          created: Date.now(),
          collectionId: collection.id,
        },
      ];

      await h.app.library.setLibrary(items);

      const allItems = await h.app.library.getLatestLibrary();
      expect(allItems).toHaveLength(2);
      expect(
        allItems.every((item) => item.collectionId === collection.id),
      ).toBe(true);
    });
  });

  describe("getting collections", () => {
    it("should return empty array when no collections exist", async () => {
      const collections = await h.app.library.getCollections();
      expect(collections).toEqual([]);
    });

    it("should return all collections", async () => {
      await h.app.library.createLibraryCollection("Collection 1");
      await h.app.library.createLibraryCollection("Collection 2");
      await h.app.library.createLibraryCollection("Collection 3");

      const collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(3);
    });
  });

  describe("collection persistence", () => {
    it("should persist collections across app re-renders", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Persistent Collection",
      );

      // Simulate re-render by getting collections again
      const collections = await h.app.library.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].id).toBe(collection.id);
      expect(collections[0].name).toBe("Persistent Collection");
    });

    it("should persist items with collectionId", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Collection",
      );

      const items: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          collectionId: collection.id,
        },
      ];

      await h.app.library.setLibrary(items);

      // Get items again to verify persistence
      const allItems = await h.app.library.getLatestLibrary();
      expect(allItems).toHaveLength(1);
      expect(allItems[0].collectionId).toBe(collection.id);
    });
  });

  describe("UI integration", () => {
    it("should create collection via UI dropdown menu", async () => {
      const { container } = await render(<Excalidraw />);

      // Open library sidebar
      const libraryButton = container.querySelector(".sidebar-trigger");
      fireEvent.click(libraryButton!);

      // Wait for library menu to be visible
      await waitFor(() => {
        expect(container.querySelector(".layer-ui__library")).toBeTruthy();
      });

      // Click dropdown menu button in the header (not collection headers)
      const libraryHeader = container.querySelector(
        ".library-menu-dropdown-container--in-heading",
      ) as HTMLElement;
      const dropdownButton = queryByTestId(
        libraryHeader,
        "dropdown-menu-button",
      );
      fireEvent.click(dropdownButton!);

      // Mock window.prompt to return a collection name
      const originalPrompt = window.prompt;
      window.prompt = vi.fn(() => "UI Test Collection");

      // Click "Create library" option
      const createButton = queryByTestId(container, "lib-dropdown--create");
      fireEvent.click(createButton!);

      // Restore prompt
      window.prompt = originalPrompt;

      // Wait for collection to be created
      await waitFor(async () => {
        const collections = await h.app.library.getCollections();
        expect(collections.length).toBeGreaterThan(0);
        expect(collections.some((c) => c.name === "UI Test Collection")).toBe(
          true,
        );
      });
    });
  });

  describe("collection and items relationship", () => {
    it("should filter items by collection", async () => {
      const collection1 = await h.app.library.createLibraryCollection(
        "Collection 1",
      );
      const collection2 = await h.app.library.createLibraryCollection(
        "Collection 2",
      );

      const items: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          collectionId: collection1.id,
        },
        {
          id: "item2",
          status: "unpublished",
          elements: [API.createElement({ type: "ellipse" })],
          created: Date.now(),
          collectionId: collection1.id,
        },
        {
          id: "item3",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          collectionId: collection2.id,
        },
        {
          id: "item4",
          status: "unpublished",
          elements: [API.createElement({ type: "diamond" })],
          created: Date.now(),
          // No collectionId
        },
      ];

      await h.app.library.setLibrary(items);

      const allItems = await h.app.library.getLatestLibrary();
      const collection1Items = allItems.filter(
        (item) => item.collectionId === collection1.id,
      );
      const collection2Items = allItems.filter(
        (item) => item.collectionId === collection2.id,
      );
      const unassignedItems = allItems.filter((item) => !item.collectionId);

      expect(collection1Items).toHaveLength(2);
      expect(collection2Items).toHaveLength(1);
      expect(unassignedItems).toHaveLength(1);
    });

    it("should handle items when collection is deleted", async () => {
      const collection = await h.app.library.createLibraryCollection(
        "Temp Collection",
      );

      const items: LibraryItems = [
        {
          id: "item1",
          status: "unpublished",
          elements: [API.createElement({ type: "rectangle" })],
          created: Date.now(),
          collectionId: collection.id,
        },
        {
          id: "item2",
          status: "unpublished",
          elements: [API.createElement({ type: "ellipse" })],
          created: Date.now(),
          collectionId: collection.id,
        },
      ];

      await h.app.library.setLibrary(items);

      // Delete collection
      await h.app.library.deleteLibraryCollection(collection.id);

      // Items should be deleted
      const allItems = await h.app.library.getLatestLibrary();
      expect(allItems).toHaveLength(0);
    });
  });
});

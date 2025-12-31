import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { IndexSection } from "./IndexSection";
import { getDefaultAppState } from "../../appState";
import type { AppClassProperties, IndexItem } from "../../types";

// Mock the actions
jest.mock("../../actions/actionIndex", () => ({
  actionAddIndexItem: {
    perform: jest.fn(() => ({ captureUpdate: "UPDATE" })),
  },
  actionRemoveIndexItem: {
    perform: jest.fn(() => ({ captureUpdate: "UPDATE" })),
  },
  actionUpdateIndexItem: {
    perform: jest.fn(() => ({ captureUpdate: "UPDATE" })),
  },
}));

const mockApp = {
  scene: {
    getElements: jest.fn(() => []),
    getSelectedElements: jest.fn(() => []),
    getNonDeletedElementsMap: jest.fn(() => new Map()),
  },
  syncActionResult: jest.fn(),
} as unknown as AppClassProperties;

const mockAppState = {
  ...getDefaultAppState(),
  width: 800,
  height: 600,
  scrollX: 0,
  scrollY: 0,
  indexItems: [] as IndexItem[],
};

describe("IndexSection", () => {
  it("renders empty state correctly", () => {
    render(
      <IndexSection
        app={mockApp}
        appState={mockAppState}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("No pins added yet")).toBeInTheDocument();
  });

  it("shows add pin form when button is clicked", () => {
    render(
      <IndexSection
        app={mockApp}
        appState={mockAppState}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Add Pin"));
    expect(screen.getByPlaceholderText("Enter pin name...")).toBeInTheDocument();
  });
});
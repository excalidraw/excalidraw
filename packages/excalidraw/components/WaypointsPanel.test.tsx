import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaypointsPanel } from "./WaypointsSidebar";
import type { Waypoint } from "@excalidraw/excalidraw/types";

const makeWp = (id: string, name: string): Waypoint => ({
  id,
  name,
  x: 0,
  y: 0,
  zoom: 1,
});

describe("WaypointsPanel", () => {
  test("shows empty text when there are no waypoints", () => {
    render(
      <WaypointsPanel
        waypoints={[]}
        onAdd={jest.fn()}
        onJump={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/No waypoints yet\. Use “Add current view”\./),
    ).toBeInTheDocument();
  });

  test("renders waypoints and calls onJump when a name is clicked", () => {
    const onJump = jest.fn();
    const waypoints = [makeWp("1", "Intro"), makeWp("2", "Details")];

    render(
      <WaypointsPanel
        waypoints={waypoints}
        onAdd={jest.fn()}
        onJump={onJump}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Intro"));
    expect(onJump).toHaveBeenCalledWith("1");
  });

  test("clicking + Add current view calls onAdd", () => {
    const onAdd = jest.fn();

    render(
      <WaypointsPanel
        waypoints={[]}
        onAdd={onAdd}
        onJump={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText("+ Add current view"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  test("rename flow (click pencil → type → Enter) calls onRename", () => {
    const onRename = jest.fn();
    const wp = makeWp("1", "Intro");

    render(
      <WaypointsPanel
        waypoints={[wp]}
        onAdd={jest.fn()}
        onJump={jest.fn()}
        onRename={onRename}
        onDelete={jest.fn()}
      />,
    );

    const renameBtn = screen.getByLabelText("Rename waypoint");
    fireEvent.click(renameBtn);

    const input = screen.getByDisplayValue("Intro");
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("1", "New name");
  });

  test("clicking delete icon calls onDelete with waypoint id", () => {
    const onDelete = jest.fn();
    const wp = makeWp("1", "Intro");

    render(
      <WaypointsPanel
        waypoints={[wp]}
        onAdd={jest.fn()}
        onJump={jest.fn()}
        onRename={jest.fn()}
        onDelete={onDelete}
      />,
    );

    const deleteBtn = screen.getByLabelText("Delete waypoint");
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith("1");
  });
});

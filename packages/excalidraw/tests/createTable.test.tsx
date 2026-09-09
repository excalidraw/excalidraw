import { fireEvent, screen } from "@testing-library/react";
import { expect, describe, it } from "vitest";

import { isLineElement } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { TABLE_CELL_HEIGHT, TABLE_CELL_WIDTH } from "../tables/createTable";

import { API } from "./helpers/api";
import { render } from "./test-utils";

const { h } = window;

describe("create table from toolbar", () => {
  it("inserts a grouped table of a rectangle and lines", async () => {
    await render(<Excalidraw />);

    fireEvent.click(screen.getByTestId("toolbar-table"));
    expect(h.state.openDialog).toEqual({ name: "createTable" });

    const colsInput = screen
      .getByTestId("create-table-cols")
      .querySelector("input")!;
    const rowsInput = screen
      .getByTestId("create-table-rows")
      .querySelector("input")!;

    fireEvent.change(colsInput, { target: { value: "3" } });
    fireEvent.change(rowsInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert table" }));

    expect(h.state.openDialog).toBeNull();

    const elements = API.getSelectedElements();
    expect(elements).toHaveLength(4);

    const rectangle = elements.find((element) => element.type === "rectangle");
    const lines = elements.filter(isLineElement);

    expect(rectangle).toBeDefined();
    expect(rectangle!.width).toBe(3 * TABLE_CELL_WIDTH);
    expect(rectangle!.height).toBe(2 * TABLE_CELL_HEIGHT);
    expect(lines).toHaveLength(3);

    const groupId = rectangle!.groupIds[0];
    expect(
      elements.every((element) => element.groupIds.includes(groupId)),
    ).toBe(true);
  });
});

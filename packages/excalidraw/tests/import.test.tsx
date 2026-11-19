import React from "react";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { t } from "../i18n";

import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

const { h } = window;

const dropScene = (elements: readonly unknown[]) =>
  API.drop([
    {
      kind: "file",
      file: new Blob(
        [
          JSON.stringify({
            type: EXPORT_DATA_TYPES.excalidraw,
            version: 2,
            source: "https://excalidraw.com",
            elements,
            appState: {},
            files: {},
          }),
        ],
        { type: MIME_TYPES.json },
      ),
    },
  ]);

describe("importing a scene file", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    API.setElements([API.createElement({ type: "rectangle", id: "existing" })]);
  });

  it("shows an error when no element of the file can be restored", async () => {
    await dropScene([{ cor: "azul" }, { id: "elem_incompleto" }]);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(t("alerts.couldNotLoadInvalidFile"));
    });
    expect(h.elements).toEqual([expect.objectContaining({ id: "existing" })]);
  });

  it("loads a file with at least one restorable element", async () => {
    await dropScene([
      API.createElement({ type: "rectangle", id: "A" }),
      { cor: "azul" },
    ]);

    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
    });
    expect(h.state.errorMessage).toBe(null);
  });

  it("loads a file without elements as an empty scene", async () => {
    await dropScene([]);

    await waitFor(() => {
      expect(h.elements).toEqual([]);
    });
    expect(h.state.errorMessage).toBe(null);
  });

  it("loads a file whose elements are all deleted", async () => {
    await dropScene([
      API.createElement({ type: "rectangle", id: "A", isDeleted: true }),
    ]);

    await waitFor(() => {
      expect(h.elements.every((element) => element.isDeleted)).toBe(true);
    });
    expect(h.state.errorMessage).toBe(null);
  });
});

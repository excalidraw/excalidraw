import { API } from "../tests/helpers/api";
import { restoreElements } from "./restore";

describe("repairing bindings", () => {
  it("should repair container boundElements", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
    });

    expect(container.boundElements).toEqual([]);

    const restoredElements = restoreElements([container, boundElement], null);

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should repair containerId of boundElements", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: null,
    });
    const container = API.createElement({
      type: "rectangle",
      boundElements: [{ type: boundElement.type, id: boundElement.id }],
    });

    const restoredElements = restoreElements([container, boundElement], null);

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should ignore bound element if deleted", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });

    expect(container.boundElements).toEqual([]);

    const restoredElements = restoreElements([container, boundElement], null);

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove bindings of deleted elements from boundElements", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });
    const invisibleBoundElement = API.createElement({
      type: "text",
      containerId: container.id,
      width: 0,
      height: 0,
    });

    const obsoleteBinding = { type: boundElement.type, id: boundElement.id };
    const invisibleBinding = {
      type: invisibleBoundElement.type,
      id: invisibleBoundElement.id,
    };
    const nonExistentBinding = { type: "text", id: "non-existent" };
    // @ts-ignore
    container.boundElements = [
      obsoleteBinding,
      invisibleBinding,
      nonExistentBinding,
    ];

    expect(container.boundElements).toEqual([
      obsoleteBinding,
      invisibleBinding,
      nonExistentBinding,
    ]);

    const restoredElements = restoreElements(
      [container, invisibleBoundElement, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove containerId if container not exists", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: "non-existent",
    });
    const boundElementDeleted = API.createElement({
      type: "text",
      containerId: "non-existent",
      isDeleted: true,
    });

    const restoredElements = restoreElements(
      [boundElement, boundElementDeleted],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: boundElement.id,
        containerId: null,
      }),
      expect.objectContaining({
        id: boundElementDeleted.id,
        containerId: null,
      }),
    ]);
  });
});

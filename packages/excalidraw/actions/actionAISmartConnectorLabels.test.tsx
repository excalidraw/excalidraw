import { waitFor } from "@testing-library/react";

import { Excalidraw, AISmartConnectorLabelsPlugin } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionAISmartConnectorLabels } from "./actionAISmartConnectorLabels";

describe("actionAISmartConnectorLabels", () => {
  it("creates bound text for selected arrows without labels", async () => {
    const suggest = vi.fn(async ({ selectedArrows }) => ({
      labels: selectedArrows.map((arrow: (typeof selectedArrows)[number]) => ({
        arrowId: arrow.id,
        text: "Approves",
      })),
    }));

    await render(
      <Excalidraw>
        <AISmartConnectorLabelsPlugin suggest={suggest} />
      </Excalidraw>,
    );

    const start = API.createElement({ id: "start", type: "rectangle" });
    const end = API.createElement({ id: "end", type: "rectangle", x: 240 });
    const arrow = API.createElement({
      id: "arrow-1",
      type: "arrow",
    });

    API.setElements([start, end, arrow]);
    API.setSelectedElements([arrow]);
    API.executeAction(actionAISmartConnectorLabels);

    await waitFor(() => {
      const createdText = API.getSnapshot().find(
        (element) => element.type === "text" && element.containerId === arrow.id,
      ) as { text: string } | undefined;
      expect(createdText?.text).toBe("Approves");
    });

    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it("updates existing bound text for selected arrows", async () => {
    const suggest = vi.fn(async () => ({
      labels: [{ arrowId: "arrow-1", text: "Triggers sync" }],
    }));

    await render(
      <Excalidraw>
        <AISmartConnectorLabelsPlugin suggest={suggest} />
      </Excalidraw>,
    );

    const arrow = API.createElement({
      id: "arrow-1",
      type: "arrow",
      boundElements: [{ id: "label-1", type: "text" }],
    });
    const label = API.createElement({
      id: "label-1",
      type: "text",
      containerId: "arrow-1",
      text: "Old label",
    });

    API.setElements([arrow, label]);
    API.setSelectedElements([arrow]);
    API.executeAction(actionAISmartConnectorLabels);

    await waitFor(() => {
      expect(API.getElement(label).text).toBe("Triggers sync");
    });
  });
});

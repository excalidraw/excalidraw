import {
  createPasteEvent,
  parseClipboard,
  parseDataTransferEvent,
  serializeAsClipboardJSON,
} from "./clipboard";
import { API } from "./tests/helpers/api";

describe("serializeAsClipboardJSON()", () => {
  it("removes singleton groups without changing the original element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      groupIds: ["inner", "outer"],
    });
    const { elements } = JSON.parse(
      serializeAsClipboardJSON({ elements: [rectangle], files: null }),
    );

    expect(elements[0].groupIds).toEqual([]);
    expect(rectangle.groupIds).toEqual(["inner", "outer"]);
  });

  it("preserves shared groups while removing singleton nested groups", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      groupIds: ["inner", "outer"],
    });
    const ellipse = API.createElement({
      type: "ellipse",
      groupIds: ["outer"],
    });
    const { elements } = JSON.parse(
      serializeAsClipboardJSON({ elements: [rectangle, ellipse], files: null }),
    );

    expect(
      elements.map((element: { groupIds: string[] }) => element.groupIds),
    ).toEqual([["outer"], ["outer"]]);
    expect(rectangle.groupIds).toEqual(["inner", "outer"]);
    expect(ellipse.groupIds).toEqual(["outer"]);
  });
});

describe("parseClipboard()", () => {
  it("should parse JSON as plaintext if not excalidraw-api/clipboard data", async () => {
    let text;
    let clipboardData;
    // -------------------------------------------------------------------------

    text = "123";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = "[123]";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = JSON.stringify({ val: 42 });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);
  });

  it("should parse valid excalidraw JSON if inside text/plain", async () => {
    const rect = API.createElement({ type: "rectangle" });

    const json = serializeAsClipboardJSON({ elements: [rect], files: null });
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/plain": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
  });

  it("should parse valid excalidraw JSON if inside text/html", async () => {
    const rect = API.createElement({ type: "rectangle" });

    let json;
    let clipboardData;
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div> ${json}</div>`,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
  });

  it("should parse <image> `src` urls out of text/html", async () => {
    let clipboardData;
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<img src="https://example.com/image.png" />`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
    ]);
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div><img src="https://example.com/image.png" /></div><a><img src="https://example.com/image2.png" /></a>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image2.png",
      },
    ]);
  });

  it("should parse text content alongside <image> `src` urls out of text/html", async () => {
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<a href="https://example.com">hello </a><div><img src="https://example.com/image.png" /></div><b>my friend!</b>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "text",
        // trimmed
        value: "hello",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "text",
        value: "my friend!",
      },
    ]);
  });
});
